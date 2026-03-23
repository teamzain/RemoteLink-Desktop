const { app, shell, BrowserWindow, ipcMain, safeStorage } = require('electron')
import { join } from 'path'

// Support multiple instances for testing
const userDataSuffix = process.env.REMOTE_LINK_USER_DATA || process.argv.find(arg => arg.startsWith('--user-data-dir='))?.split('=')[1];
if (userDataSuffix) {
  app.name = 'RemoteLinkViewer'; // Change name to prevent default profile conflicts
  app.setPath('userData', userDataSuffix);
}
import { spawn, ChildProcess } from 'child_process'
import * as fs from 'fs/promises'
import WebSocket from 'ws'
import * as os from 'os'

// Use dynamic imports/requires inside functions to prevent unnecessary module loading in viewer instances
let datachannel: any = null;
let ffmpegPath: any = null;
let capture: any = null;

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
  if (!capture) capture = require('@remotelink/native-capture');
  if (!ffmpegPath) ffmpegPath = require('ffmpeg-static');
  
  console.log('[Host] STARTING STREAMING LOOP...');
  stopStreaming();
  
  let firstFrame = capture.captureFrame();
  if (!firstFrame) {
    console.log('[Host] No frame captured yet, retrying...');
    setTimeout(startStreaming, 100);
    return;
  }
  const { width, height } = firstFrame;
  console.log(`[Host] Capture dimensions: ${width}x${height}`);

  ffmpegProcess = spawn(ffmpegPath, [
    '-f', 'rawvideo',
    '-pixel_format', 'bgra',
    '-video_size', `${width}x${height}`,
    '-i', '-',
    '-c:v', 'libx264',
    '-profile:v', 'baseline', // Max compatibility with WebCodecs
    '-level', '4.1', // Level 4.1 for 1080p
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-g', '30',
    '-f', 'h264',
    '-'
  ]);

  ffmpegProcess.stderr?.on('data', (data: Buffer) => {
    if (Math.random() < 0.01) console.log(`[Host-FFmpeg] ${data.toString()}`);
  });

  ffmpegProcess.on('error', (err: any) => {
    console.error('[Host-FFmpeg] Process error:', err);
  });

  ffmpegProcess.on('exit', (code: number) => {
    if (code !== 0 && code !== null) console.warn(`[Host-FFmpeg] Exited with code: ${code}`);
  });

  ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
    if (videoDataChannel && videoDataChannel.isOpen()) {
      if (Math.random() < 0.1) console.log(`[Host] Sending chunk: ${chunk.length} bytes`);
      const header = Buffer.alloc(8);
      header.writeBigUInt64LE(BigInt(Date.now()));
      videoDataChannel.sendMessageBinary(Buffer.concat([header, chunk]));
    }
  });

  let isDraining = false;
  streamInterval = setInterval(() => {
    if (isDraining) return;
    const frame = capture.captureFrame();
    if (frame && frame.data) {
      if (ffmpegProcess?.stdin?.write(frame.data) === false) {
        isDraining = true;
        ffmpegProcess.stdin.once('drain', () => { isDraining = false; });
      }
    }
  }, 1000 / 30);
}

function stopStreaming() {
  if (streamInterval) clearInterval(streamInterval);
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
  
  if (!datachannel) datachannel = require('node-datachannel');
  
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
