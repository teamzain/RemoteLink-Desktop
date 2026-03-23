import { app, shell, BrowserWindow, ipcMain, safeStorage, clipboard, screen, Notification } from 'electron';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import { WebSocket } from 'ws';
import * as os from 'os';
import * as datachannel from 'node-datachannel';
import * as input from '@remotelink/native-input';

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
let lastClipboardText = '';
let clipboardInterval: NodeJS.Timeout | null = null;

// --- Global Streaming State for Diagnostics ---
let bufferAccumulator = Buffer.alloc(0);
let nalAccumulator = Buffer.alloc(0); // For grouping SPS+PPS+IDR
let hasVCLInAccumulator = false; // To track if we have a frame to send
let nalsCaptured = 0;
const START_CODE_3 = Buffer.from([0x00, 0x00, 0x01]);

// --- File Transfer State ---
const fileTransfers = new Map<string, { buffer: Buffer, received: number, total: number, chunks: number }>();

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

  if (clipboardInterval) {
    clearInterval(clipboardInterval);
    clipboardInterval = null;
  }
}

function startStreaming() {
  console.log('[Host] STARTING STREAMING LOOP (Native GDI Capture)...');
  stopStreaming();

  // Use FFmpeg's built-in gdigrab. Scale to 1080p to support high-res displays.
  ffmpegProcess = spawn(getFFmpegPath(), [
    '-f', 'gdigrab',
    '-framerate', '30',
    '-draw_mouse', '1',
    '-i', 'desktop',
    // Simple scaling for better compatibility and performance
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'baseline',
    '-level', '4.1',
    '-preset', 'ultrafast',
    '-tune', 'zerolatency',
    '-x264-params', 'repeat-headers=1:keyint=30:min-keyint=30:aud=1:sei=0',
    '-g', '30',
    '-f', 'h264',
    '-'
  ]);

  // RESET state for new stream
  bufferAccumulator = Buffer.alloc(0);
  nalAccumulator = Buffer.alloc(0);
  hasVCLInAccumulator = false;
  nalsCaptured = 0;

  ffmpegProcess.stderr?.on('data', (data: Buffer) => {
    // console.log(`[Host-FFmpeg-Stderr] ${data.toString()}`);
  });

  ffmpegProcess.on('error', (err: any) => {
    console.error('[Host-FFmpeg] Process error:', err);
  });

  const heartbeat = setInterval(() => {
    if (videoDataChannel && videoDataChannel.isOpen()) {
       console.log(`[Host] HEARTBEAT: NALs: ${nalsCaptured}, Buf: ${bufferAccumulator.length}`);
    }
  }, 5000);

  ffmpegProcess.on('close', () => {
    clearInterval(heartbeat);
  });

  ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
    if (!videoDataChannel || !videoDataChannel.isOpen()) return;

    bufferAccumulator = Buffer.concat([bufferAccumulator, chunk]);

    // NAL Splitter (Annex-B)
    while (true) {
      let foundStartIdx = bufferAccumulator.indexOf(START_CODE_3);
      if (foundStartIdx === -1) break;

      // Handle 4-byte start codes
      if (foundStartIdx > 0 && bufferAccumulator[foundStartIdx - 1] === 0) {
        foundStartIdx--;
      }

      // Discard garbage before first start code
      if (foundStartIdx > 0) {
        bufferAccumulator = bufferAccumulator.subarray(foundStartIdx);
        continue;
      }

      // Find the next NAL. We must skip the current start code (3-4 bytes)
      let nextIdx = bufferAccumulator.indexOf(START_CODE_3, 3);
      if (nextIdx !== -1 && nextIdx > 0 && bufferAccumulator[nextIdx - 1] === 0) {
        nextIdx--;
      }

      if (nextIdx === -1) break; // Incomplete NAL

      const nalUnit = bufferAccumulator.subarray(0, nextIdx);
      bufferAccumulator = bufferAccumulator.subarray(nextIdx);

      try {
        // Safe NAL type detection: Ensure we have enough data to read type byte
        const nalType = (nalUnit.length > 4) ? 
          ((nalUnit[2] === 1) ? (nalUnit[3] & 0x1F) : (nalUnit[4] & 0x1F)) : 0;
        
        // --- VCL-AWARE AUD GROUPING ---
        // A new frame starts with AUD(9), SPS(7), PPS(8), or SEI(6)
        const isHeader = (nalType === 7 || nalType === 8 || nalType === 6 || nalType === 9);
        const isVCL = (nalType === 1 || nalType === 5);

        // Transition: If we see a new header and already have VCL data, then send the previous frame now.
        if (isHeader && hasVCLInAccumulator && nalAccumulator.length > 0) {
          sendAccessUnit(nalAccumulator, videoDataChannel);
          nalAccumulator = Buffer.alloc(0);
          hasVCLInAccumulator = false;
        }

        // Accumulate this NAL into the current Access Unit
        nalAccumulator = Buffer.concat([nalAccumulator, nalUnit]);
        if (isVCL) hasVCLInAccumulator = true;

      } catch (err) {
        console.error('[Host] Failed to process NAL Unit:', err);
      }
    }

    if (bufferAccumulator.length > 2 * 1024 * 1024) {
      bufferAccumulator = Buffer.alloc(0);
    }
  });
}

function sendAccessUnit(data: Buffer, channel: any) {
  if (!channel || !channel.isOpen()) return;

  nalsCaptured++;
  // Smaller chunks for better network traversal and internal buffer management
  const MAX_CHUNK = 8192; 
  const totalFrags = Math.ceil(data.length / MAX_CHUNK);
  const timestamp = BigInt(Date.now()) * 1000n + BigInt(nalsCaptured % 1000);

  // If the internal buffer is too full, skip this unit to avoid crashing the connection
  if (channel.bufferedAmount() > 5 * 1024 * 1024) {
    if (Math.random() < 0.1) console.warn(`[Host] DataChannel buffer full (${channel.bufferedAmount()} bytes). Skipping AU.`);
    return;
  }

  for (let i = 0; i < totalFrags; i++) {
    const start = i * MAX_CHUNK;
    const end = Math.min(start + MAX_CHUNK, data.length);
    const fragPayload = data.subarray(start, end);

    const packet = Buffer.alloc(10 + fragPayload.length);
    packet.writeBigUInt64LE(timestamp, 0);
    packet.writeUInt8(i, 8);
    packet.writeUInt8(totalFrags, 9);
    fragPayload.copy(packet, 10);

    channel.sendMessageBinary(packet);
  }
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
      if (currentViewerId === data.viewerId && peerConnection && (peerConnection.state() === 'connected' || peerConnection.state() === 'connecting')) {
        console.log('[Host] Viewer rejoined but session exists. Skipping re-init.');
        return;
      }
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

  dataChannel.onMessage(async (msg: string | Buffer) => {
    try {
      const event = JSON.parse(msg.toString());
      switch (event.type) {
        case 'mousemove':
          input.injectMouseMove(event.x, event.y);
          break;
        case 'mousedown':
        case 'mouseup':
          // button: 0=left, 1=middle, 2=right
          const btnMap: Record<number, string> = { 0: 'left', 1: 'middle', 2: 'right' };
          const btnName = btnMap[event.button] || 'left';
          input.injectMouseAction(btnName as 'left' | 'middle' | 'right', event.type === 'mousedown' ? 'down' : 'up');
          break;
        case 'keydown':
        case 'keyup':
          input.injectKeyAction(event.keyCode, event.type === 'keydown' ? 'down' : 'up');
          break;
        case 'clipboard':
          if (event.text && event.text !== lastClipboardText) {
            lastClipboardText = event.text;
            clipboard.writeText(event.text);
          }
          break;
      }
    } catch (e) {
      // If it's not JSON, it might be a binary file chunk prefixed with JSON header size
      if (Buffer.isBuffer(msg)) {
        try {
          const jsonSize = msg.readUInt32LE(0);
          const headerJson = msg.subarray(4, 4 + jsonSize).toString();
          const header = JSON.parse(headerJson);
          
          if (header.type === 'file-chunk') {
            const chunkData = msg.subarray(4 + jsonSize);
            let transfer = fileTransfers.get(header.name);
            if (!transfer) {
              transfer = { buffer: Buffer.alloc(header.totalSize), received: 0, total: header.totalSize, chunks: 0 };
              fileTransfers.set(header.name, transfer);
            }
            
            chunkData.copy(transfer.buffer, header.offset);
            transfer.received += chunkData.length;
            transfer.chunks++;
            
            // Progress Update
            const progress = Math.round((transfer.received / transfer.total) * 100);
            mainWindow?.webContents.send('host:status', `Receiving ${header.name}: ${progress}%`);
            
            if (transfer.received >= transfer.total) {
              const savePath = join(app.getPath('downloads'), header.name);
              await fs.writeFile(savePath, transfer.buffer);
              fileTransfers.delete(header.name);
              
              new Notification({
                title: 'File Received',
                body: `Saved ${header.name} to Downloads`
              }).show();
              mainWindow?.webContents.send('host:status', `File Received: ${header.name}`);
            }
          }
        } catch (err) {
          console.error('[Host] Binary message processing failed:', err);
        }
      }
    }
  });

  videoDataChannel.onOpen(() => {
    console.log('[Host] Video DataChannel OPENED. Starting encoder...');
    startStreaming();

    // Start Clipboard Polling
    lastClipboardText = clipboard.readText();
    clipboardInterval = setInterval(() => {
      if (dataChannel && dataChannel.isOpen()) {
        const currentText = clipboard.readText();
        if (currentText !== lastClipboardText) {
          lastClipboardText = currentText;
          dataChannel.send(JSON.stringify({ type: 'clipboard', text: currentText }));
        }
      }
    }, 500);
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

let activeHostAccessKey = '';
let activeHostToken = '';
let hostReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;

function connectHostSignaling(serverIP: string, token: string, accessKey: string, resolve?: any, reject?: any) {
  if (signalingWs) {
    try { signalingWs.close(); } catch {}
  }
  
  console.log(`[Host] Connecting to signaling server at: ${serverIP}:3002 (Attempt ${hostReconnectAttempts + 1})`);
  signalingWs = new WebSocket(`ws://${serverIP}:3002`);
  setupSignalingHandlers(signalingWs);
  
  signalingWs.on('open', () => {
    console.log('[Host] Signaling connected');
    hostReconnectAttempts = 0; // reset
    signalingWs?.send(JSON.stringify({ type: 'register', token, role: 'host', accessKey }));
  });
  
  signalingWs.on('message', (message) => {
    const data = JSON.parse(message.toString());
    if (data.type === 'registered' && resolve) {
        resolve(data.sessionId);
        resolve = null; // Prevent double resolve
    }
  });

  signalingWs.on('error', (err) => {
    console.error('[Host] Signaling WS Error:', err.message);
    if (reject) {
      reject(err);
      reject = null;
    }
  });

  signalingWs.on('close', () => {
    console.log('[Host] Signaling server disconnected');
    if (reject) {
       reject(new Error('Signaling server disconnected during initial connection'));
       reject = null;
       return;
    }
    
    // Auto-reconnect flow logic if it was already connected and running
    if (activeHostToken) {
       if (hostReconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
         const backoffMs = Math.pow(2, hostReconnectAttempts) * 1000;
         hostReconnectAttempts++;
         console.log(`[Host] Reconnecting in ${backoffMs}ms...`);
         mainWindow?.webContents.send('host:status', `Reconnecting in ${backoffMs/1000}s...`);
         setTimeout(() => {
            connectHostSignaling(serverIP, activeHostToken, activeHostAccessKey);
         }, backoffMs);
       } else {
         mainWindow?.webContents.send('host:status', 'Signaling disconnected (Retries exhausted)');
         activeHostToken = ''; // Stop trying
       }
    }
  });
}

ipcMain.handle('host:start', async (_event, accessKey?: string) => {
  return new Promise(async (resolve, reject) => {
    try {
      const { token } = await getAuthTokens();
      if (!token) return reject(new Error('Auth failed'));
      
      const serverIP = process.env.REMOTE_LINK_SERVER_IP || '127.0.0.1';
      activeHostToken = token;
      activeHostAccessKey = accessKey || '';
      hostReconnectAttempts = 0;
      connectHostSignaling(serverIP, token, activeHostAccessKey, resolve, reject);
    } catch (e: any) { reject(e); }
  });
});

ipcMain.handle('host:stop', () => {
  activeHostToken = ''; // Prevent auto-reconnect
  if (signalingWs) { signalingWs.close(); signalingWs = null; }
  cleanUpWebRTC();
  return { success: true };
});

ipcMain.handle('viewer:connect', async (_event: any, rawSessionId: string, serverIP: string = '127.0.0.1', providedToken?: string) => {
  const sessionId = rawSessionId.replace(/\s/g, '');
  return new Promise(async (resolve, reject) => {
    try {
      const { token: storedToken } = await getAuthTokens();
      const token = providedToken || storedToken;
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
          else {
            reject(new Error(msg.error));
          }
        }
      });
      viewerWs.on('error', (err) => {
         console.error('[Viewer] WS Error:', err.message);
         if (reject) reject(err);
      });
      viewerWs.on('close', () => {
         console.log('[Viewer] WS Closed');
         mainWindow?.webContents.send('viewer:signaling-disconnected');
      });
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

ipcMain.handle('auth:getDeviceAccessKey', async () => {
  const KEY_PATH = join(app.getPath('userData'), 'device_access_key');
  try {
    const encrypted = await fs.readFile(KEY_PATH);
    if (!encrypted || encrypted.length === 0) return null;
    
    let decrypted = '';
    if (safeStorage.isEncryptionAvailable()) {
      decrypted = safeStorage.decryptString(encrypted);
    } else {
      decrypted = encrypted.toString('utf8');
    }
    
    if (!decrypted || decrypted === 'undefined' || decrypted === 'null') {
      return null;
    }
    return decrypted;
  } catch (e) {
    console.error('[DeviceIdentity] Failed to read or decrypt access key:', e);
    return null;
  }
});

ipcMain.handle('auth:setDeviceAccessKey', async (_event, key: string) => {
  const KEY_PATH = join(app.getPath('userData'), 'device_access_key');
  try {
    if (!key) throw new Error("Key is undefined or empty");
    const validKey = String(key);
    
    const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(validKey) : Buffer.from(validKey, 'utf8');
    await fs.writeFile(KEY_PATH, data);
    console.log(`[DeviceIdentity] Access key successfully stored: ${validKey}`);
    return true;
  } catch (e) {
    console.error('[DeviceIdentity] Failed to save access key:', e);
    return false;
  }
});

ipcMain.handle('system:getMachineName', () => os.hostname());
ipcMain.handle('auth:getToken', () => getAuthTokens());
ipcMain.handle('auth:setToken', (_event: any, t: string, r: string) => setAuthTokens(t, r));
ipcMain.handle('auth:deleteToken', async () => {
  try { await fs.unlink(AUTH_PATH()); return true; } catch { return false; }
});
ipcMain.handle('system:ping', () => 'pong');
ipcMain.handle('clipboard:readText', () => clipboard.readText());
ipcMain.handle('clipboard:writeText', (_event, text) => {
  lastClipboardText = text;
  clipboard.writeText(text);
});
