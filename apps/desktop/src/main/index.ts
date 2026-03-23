import { app, shell, BrowserWindow, ipcMain, safeStorage } from 'electron';
import { join } from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import { WebSocket } from 'ws';
import * as os from 'os';
import * as datachannel from 'node-datachannel';

// --- FFmpeg Path Discovery ---
const getFFmpegPath = () => {
    // In production, we assume it's bundled or in a specific location
    if (app.isPackaged) {
        return join(process.resourcesPath, 'ffmpeg.exe');
    }
    // In development (Vite), we look in the monorepo root node_modules
    // since @remotelink/desktop is in apps/desktop/
    return join(app.getAppPath(), '../../node_modules/ffmpeg-static/ffmpeg.exe');
};

const AUTH_PATH = () => join(app.getPath('userData'), 'auth_encrypted.json');

async function getAuthTokens() {
  try {
    const data = await fs.readFile(AUTH_PATH(), 'utf8');
    const { encToken, encRefresh } = JSON.parse(data);
    return {
      token: safeStorage.decryptString(Buffer.from(encToken, 'hex')),
      refresh: safeStorage.decryptString(Buffer.from(encRefresh, 'hex'))
    };
  } catch (e) {
    return { token: null, refresh: null };
  }
}

async function setAuthTokens(token: string, refresh: string) {
  try {
    if (!safeStorage.isEncryptionAvailable()) return false;
    const encrypted = {
      encToken: safeStorage.encryptString(token).toString('hex'),
      encRefresh: safeStorage.encryptString(refresh).toString('hex')
    };
    await fs.writeFile(AUTH_PATH(), JSON.stringify(encrypted));
    return true;
  } catch (e) {
    return false;
  }
}

let mainWindow: any = null;
let signalingWs: WebSocket | null = null;
let viewerWs: WebSocket | null = null;
let peerConnection: any = null;
let dataChannel: any = null;
let videoDataChannel: any = null;
let currentViewerId: string | null = null;
let ffmpegProcess: ChildProcess | null = null;
let streamInterval: NodeJS.Timeout | null = null;
let iceCandidatesQueue: any[] = [];
let hasRemoteDescription = false;

function cleanUpWebRTC() {
  console.log('[Host] Performing full WebRTC cleanup...');
  stopStreaming();
  if (dataChannel) {
    try { dataChannel.close(); } catch {}
    dataChannel = null;
  }
  if (videoDataChannel) {
    try { videoDataChannel.close(); } catch {}
    videoDataChannel = null;
  }
  if (peerConnection) {
    try { peerConnection.close(); } catch {}
    peerConnection = null;
  }
  iceCandidatesQueue = [];
  hasRemoteDescription = false;
  currentViewerId = null;
}

function startStreaming() {
  console.log('[Host] STARTING STREAMING LOOP (Native GDI Capture)...');
  stopStreaming();

  // Use FFmpeg's built-in gdigrab to capture the desktop directly at 1080p.
  // We use repeat-headers=1 and a short keyframe interval (g=30) so new viewers join fast.
  ffmpegProcess = spawn(getFFmpegPath(), [
    '-f', 'gdigrab',
    '-framerate', '30',
    '-video_size', '1920x1080',
    '-i', 'desktop',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'baseline',
    '-level', '4.1',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-x264-params', 'repeat-headers=1:keyint=30:min-keyint=30',
    '-g', '30',
    '-f', 'h264',
    '-'
  ]);

  ffmpegProcess.stderr?.on('data', (data: Buffer) => {
    console.log(`[Host-FFmpeg-Stderr] ${data.toString()}`);
  });

  ffmpegProcess.on('error', (err: any) => {
    console.error('[Host-FFmpeg] Process error:', err);
  });

  ffmpegProcess.on('exit', (code: number) => {
    if (code !== 0 && code !== null) console.warn(`[Host-FFmpeg] Exited with code: ${code}`);
  });

  // --- Annex-B NAL Unit Splitter ---
  let bufferAccumulator = Buffer.alloc(0);
  const START_CODE_4 = Buffer.from([0x00, 0x00, 0x00, 0x01]);
  const START_CODE_3 = Buffer.from([0x00, 0x00, 0x01]);

  ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
    if (!videoDataChannel || !videoDataChannel.isOpen()) return;
    const DEBUG_NO_SEND = process.env.REMOTE_LINK_DEBUG_NO_SEND === 'true';
    if (DEBUG_NO_SEND) return;

    bufferAccumulator = Buffer.concat([bufferAccumulator, chunk]);

    while (bufferAccumulator.length > 4) {
      // Find the NEXT start code (skipping the one at index 0)
      let nextStartIdx = -1;
      for (let i = 1; i <= bufferAccumulator.length - 3; i++) {
        if (bufferAccumulator[i] === 0 && bufferAccumulator[i+1] === 0) {
          if (bufferAccumulator[i+2] === 1) { // 3-byte
            nextStartIdx = i;
            break;
          } else if (i <= bufferAccumulator.length - 4 && bufferAccumulator[i+2] === 0 && bufferAccumulator[i+3] === 1) { // 4-byte
            nextStartIdx = i;
            break;
          }
        }
      }

      if (nextStartIdx === -1) break; // Need more data

      // Extract one complete NAL unit
      const nalUnit = bufferAccumulator.subarray(0, nextStartIdx);
      bufferAccumulator = bufferAccumulator.subarray(nextStartIdx);

      try {
        const header = Buffer.alloc(8);
        header.writeBigUInt64LE(BigInt(Date.now()));
        const fullPacket = Buffer.concat([header, nalUnit]);
        videoDataChannel.sendMessageBinary(fullPacket);
        
        if (Math.random() < 0.05) console.log(`[Host] Sent NAL Unit: ${nalUnit.length} bytes`);
      } catch (err) {
        console.error('[Host] Failed to send NAL Unit:', err);
      }
    }
  });
}

function stopStreaming() {
  if (ffmpegProcess) {
    ffmpegProcess.stdin?.end();
    ffmpegProcess.kill();
    ffmpegProcess = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function setupSignalingHandlers(ws: WebSocket) {
  ws.removeAllListeners('message');
  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    console.log(`[Host] Received SIGNALING: ${data.type}`);
    if (data.type === 'registered') {
      mainWindow?.webContents.send('host:status', 'Registered: ' + data.sessionId);
    } else if (data.type === 'viewer-joined') {
      currentViewerId = data.viewerId;
      initiateHostWebRTC();
    } else if (data.type === 'answer') {
      peerConnection?.setRemoteDescription(data.sdp, 'answer');
      hasRemoteDescription = true;
      iceCandidatesQueue.forEach(c => {
        if (c.candidate) peerConnection?.addRemoteCandidate(c.candidate, c.mid);
      });
      iceCandidatesQueue = [];
    } else if (data.type === 'ice-candidate' && currentViewerId) {
      if (data.candidate) {
        if (hasRemoteDescription) {
          peerConnection?.addRemoteCandidate(data.candidate, data.mid);
        } else {
          iceCandidatesQueue.push(data);
        }
      }
    }
  });
}

function initiateHostWebRTC() {
  const viewerId = currentViewerId;
  if (!viewerId) return;
  console.log(`[Host] Initializing WebRTC for viewer: ${viewerId}`);
  
  // Full reset before new session
  cleanUpWebRTC();
  currentViewerId = viewerId; // Restore ID after cleanup reset

  peerConnection = new datachannel.PeerConnection("Host", {
    iceServers: ["stun:stun.l.google.com:19302"]
  });

  peerConnection.onLocalDescription((sdp: string, _type: string) => {
    signalingWs?.send(JSON.stringify({ type: 'offer', sdp, targetId: currentViewerId }));
  });

  peerConnection.onLocalCandidate((candidate: string, mid: string) => {
    signalingWs?.send(JSON.stringify({ type: 'ice-candidate', candidate, mid, targetId: currentViewerId }));
  });

  peerConnection.onStateChange((state: string) => {
    console.log(`[Host] PC State: ${state}`);
    mainWindow?.webContents.send('host:status', `WebRTC: ${state}`);
  });

  dataChannel = peerConnection.createDataChannel("control");
  videoDataChannel = peerConnection.createDataChannel("video");

  videoDataChannel.onOpen(() => {
    console.log('[Host] Video DataChannel OPENED. Starting encoder...');
    startStreaming();
  });
  videoDataChannel.onClosed(() => {
    console.log('[Host] Video DataChannel CLOSED');
    stopStreaming();
  });
}

// --- Signaling Proxy for Viewer ---
function setupViewerSignalingProxy(sessionId: string) {
  console.log(`[Proxy] Initializing Signaling Proxy for session: ${sessionId}`);
  viewerWs?.removeAllListeners('message');
  viewerWs?.on('message', (message) => {
    const data = JSON.parse(message.toString());
    console.log(`[Proxy] Received FROM SERVER: ${data.type}`);
    // Forward all incoming signaling messages to the Renderer
    mainWindow?.webContents.send('viewer:signaling-message', data);
  });
}

ipcMain.on('viewer:send-signaling', (_event: any, msg: any) => {
  console.log(`[Proxy] Sending TO SERVER: ${msg.type}`);
  viewerWs?.send(JSON.stringify(msg));
});

ipcMain.handle('host:start', async () => {
  return new Promise(async (resolve, reject) => {
    try {
      const { token } = await getAuthTokens();
      if (!token) return reject(new Error('Auth failed'));
      
      const serverIP = process.env.REMOTE_LINK_SERVER_IP || '127.0.0.1';
      console.log(`[Host] Connecting to signaling server at: ${serverIP}:3002`);
      
      signalingWs = new WebSocket(`ws://${serverIP}:3002`);
      setupSignalingHandlers(signalingWs);
      signalingWs.on('open', () => {
        signalingWs?.send(JSON.stringify({ type: 'register', token, role: 'host' }));
      });
      signalingWs.on('message', (message) => {
        const data = JSON.parse(message.toString());
        if (data.type === 'registered') resolve(data.sessionId);
      });
    } catch (e: any) { reject(e); }
  });
});

ipcMain.handle('host:stop', () => {
  if (signalingWs) { signalingWs.close(); signalingWs = null; }
  cleanUpWebRTC();
  return { success: true };
});

ipcMain.handle('viewer:connect', async (_event: any, rawSessionId: string, serverIP: string = '127.0.0.1') => {
  const sessionId = rawSessionId.replace(/\s/g, '');
  return new Promise(async (resolve, reject) => {
    try {
      const { token } = await getAuthTokens();
      console.log(`[Viewer] Connecting to signaling server at: ${serverIP}:3002`);
      viewerWs = new WebSocket(`ws://${serverIP}:3002`);
      viewerWs.removeAllListeners('message'); 
      viewerWs.once('open', () => {
        viewerWs?.send(JSON.stringify({ type: 'join', sessionId, token }));
      });
      viewerWs.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'joined') {
          if (msg.success) { 
            console.log('[Viewer] JOIN SUCCESS (Proxy initialized)');
            setupViewerSignalingProxy(sessionId); 
            resolve(true); 
          }
          else reject(new Error(msg.error));
        }
      });
      viewerWs.on('error', (err) => reject(err));
    } catch (e: any) { reject(e); }
  });
});

ipcMain.handle('system:getLocalIP', () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      // Return first IPv4 non-internal address
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return '127.0.0.1';
});

ipcMain.handle('auth:getToken', () => getAuthTokens());
ipcMain.handle('auth:setToken', (_event: any, t: string, r: string) => setAuthTokens(t, r));
ipcMain.handle('auth:deleteToken', async () => {
  try { await fs.unlink(AUTH_PATH()); return true; } catch { return false; }
});
ipcMain.handle('system:ping', () => 'pong');
