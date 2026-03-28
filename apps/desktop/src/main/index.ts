import { app, shell, BrowserWindow, ipcMain, safeStorage, clipboard, screen, Notification, session, Menu } from 'electron';
import log from 'electron-log';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import { WebSocket } from 'ws';
import * as os from 'os';
import * as datachannel from 'node-datachannel';
import * as input from '@remotelink/native-input';

// import * as keytar from 'keytar'; // keytar fails to install without build tools

const PROTOCOL = 'remotelink';
const TOKEN_KEY = 'remotelink_access_token';
const REFRESH_KEY = 'remotelink_refresh_token';
const AUTH_STORE_PATH = join(app.getPath('userData'), 'remotelink_auth.json');

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [join(app.getAppPath())]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

async function getAuthTokens() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return { token: null, refresh: null };
    const data = await fs.readFile(AUTH_STORE_PATH, 'utf8');
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
    await fs.writeFile(AUTH_STORE_PATH, JSON.stringify(encrypted));
    return true;
  } catch (e) {
    return false;
  }
}

async function deleteAuthTokens() {
  try {
    await fs.unlink(AUTH_STORE_PATH);
    return true;
  } catch (e) {
    return false;
  }
}

function handleDeepLink(url: string) {
  if (!url.startsWith(`${PROTOCOL}://`)) return;
  
  log.info(`[Auth] Deep link received: ${url}`);
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.host === 'auth' && parsedUrl.pathname === '/callback') {
      const accessToken = parsedUrl.searchParams.get('accessToken');
      const refreshToken = parsedUrl.searchParams.get('refreshToken');
      
      if (accessToken && refreshToken) {
        setAuthTokens(accessToken, refreshToken).then(() => {
          mainWindow?.webContents.send('auth:deep-link-success', { accessToken, refreshToken });
        });
      }
    }
  } catch (e) {
    log.error('[Auth] Failed to parse deep link:', e);
  }
}

// Ensure single instance and handle second instance deep links
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Windows deep link handling
    const url = commandLine.pop();
    if (url) handleDeepLink(url);
  });
}

// --- Logging Configuration ---
log.transports.file.level = 'info';
log.transports.file.maxSize = 1024 * 1024; // 1MB
(log.transports.file as any).maxFiles = 5;
log.transports.console.level = 'info';
// Ensure logs are in a clear location
log.transports.file.resolvePath = () => join(app.getPath('userData'), 'logs', 'main.log');

log.errorHandler.startCatching();

log.info(`--- App Start: ${app.name} v${app.getVersion()} [${process.arch}] ---`);

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
let sessionStartTime: number | null = null;

// --- Global Streaming State for Diagnostics ---
let bufferAccumulator = Buffer.alloc(0);
let nalAccumulator = Buffer.alloc(0); // For grouping SPS+PPS+IDR
let hasVCLInAccumulator = false; // To track if we have a frame to send
let nalsCaptured = 0;
const START_CODE_3 = Buffer.from([0x00, 0x00, 0x01]);

// --- File Transfer State ---
const fileTransfers = new Map<string, { buffer: Buffer, received: number, total: number, chunks: number }>();

function cleanUpWebRTC() {
  log.info('[Host] Performing full WebRTC cleanup...');
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
  if (sessionStartTime) {
    const duration = ((Date.now() - sessionStartTime) / 1000).toFixed(1);
    log.info(`[Host] Session ended. Duration: ${duration}s`);
    sessionStartTime = null;
  }
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

function enforceSecureUrl(url: string) {
  if (app.isPackaged) {
    if (url.startsWith('http://') || url.startsWith('ws://')) {
      throw new Error(`CRITICAL SECURITY VIOLATION: Insecure protocol detected in production: ${url}`);
    }
  }
  return url;
}

function getSecureServerUrl(serverIP: string, protocol: 'http' | 'ws') {
  if (app.isPackaged) {
    const secureProto = protocol === 'http' ? 'https' : 'wss';
    return `${secureProto}://${serverIP}`;
  }
  return `${protocol}://${serverIP}`;
}

function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const csp = app.isPackaged 
      ? [
          "default-src 'self'; " +
          "script-src 'self'; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
          "img-src 'self' data: https:; " +
          "connect-src 'self' https: wss:; " +
          "font-src 'self' data: https://fonts.gstatic.com; " +
          "object-src 'none'; " +
          "frame-src 'none';"
        ]
      : [
          "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:*; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' http://localhost:* http://127.0.0.1:*; " +
          "style-src 'self' 'unsafe-inline' http://localhost:* http://127.0.0.1:* https://fonts.googleapis.com; " +
          "img-src 'self' data: https: http: http://localhost:* http://127.0.0.1:*; " +
          "connect-src 'self' https: wss: http://localhost:* ws://localhost:* http://127.0.0.1:* ws://127.0.0.1:*; " +
          "font-src 'self' data: http://localhost:* http://127.0.0.1:* https://fonts.gstatic.com; " +
          "object-src 'none'; " +
          "frame-src 'none';"
        ];

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': csp
      }
    });
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
  setupCSP();
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
  }
}

app.setAppUserModelId('com.remotelink.desktop');
app.whenReady().then(() => {
  if (app.isPackaged) {
    const serverIP = process.env.REMOTE_LINK_SERVER_IP;
    // If packaged, we MUST have a server IP and it MUST NOT be localhost/127.0.0.1
    // unless explicitly allowed (but here we'll be strict as per prompt).
    if (serverIP && (serverIP === '127.0.0.1' || serverIP === 'localhost' || serverIP.startsWith('http://') || serverIP.startsWith('ws://'))) {
       throw new Error(`CRITICAL SECURITY ERROR: Insecure backend configuration detected in production mode. Backend must use HTTPS/WSS and a non-local domain.`);
    }
  }
  createWindow();

  // Register DevTools Toggle
  const { globalShortcut } = require('electron');
  globalShortcut.register('CommandOrControl+Shift+I', () => {
    if (mainWindow) mainWindow.webContents.toggleDevTools();
  });
  
  // Check for initial deep link (Windows)
  const initialUrl = process.argv.find(arg => arg.startsWith(`${PROTOCOL}://`));
  if (initialUrl) {
    setTimeout(() => handleDeepLink(initialUrl), 1000); // Give renderer time to load
  }
  
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        { role: 'quit' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'View Logs',
          click: () => {
             shell.openPath(join(app.getPath('userData'), 'logs'));
          }
        },
        { type: 'separator' },
        { role: 'about' }
      ]
    }
  ]);
  Menu.setApplicationMenu(menu);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function setupSignalingHandlers(ws: WebSocket) {
  ws.removeAllListeners('message');
  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    log.info(`[Host] Received SIGNALING: ${data.type}`);
    if (data.type === 'registered') {
      mainWindow?.webContents.send('host:status', 'Registered: ' + data.sessionId);
    } else if (data.type === 'viewer-joined') {
      if (currentViewerId === data.viewerId && peerConnection && (peerConnection.state() === 'connected' || peerConnection.state() === 'connecting')) {
        log.info('[Host] Viewer rejoined but session exists. Skipping re-init.');
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
        const mid = data.mid || data.sdpMid || "";
        if (hasRemoteDescription) {
          peerConnection?.addRemoteCandidate(data.candidate, mid);
        } else {
          iceCandidatesQueue.push({ candidate: data.candidate, mid });
        }
      }
    }
  });
}

function initiateHostWebRTC() {
  const viewerId = currentViewerId;
  if (!viewerId) return;
  log.info(`[Host] Initializing WebRTC for viewer: ${viewerId}`);
  sessionStartTime = Date.now();
  
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
    signalingWs?.send(JSON.stringify({ 
      type: 'ice-candidate', 
      candidate, 
      sdpMid: mid, 
      sdpMLineIndex: 0,
      targetId: currentViewerId 
    }));
  });

  peerConnection.onStateChange((state: string) => {
    log.info(`[Host] PC State: ${state}`);
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
        case 'action':
          const { action } = event;
          log.info(`[Host] Remote Action Received: ${action}`);
          const { exec } = require('child_process');
          
          if (process.platform === 'win32') {
            switch (action) {
              case 'shutdown': exec('shutdown /s /t 0'); break;
              case 'reboot': exec('shutdown /r /t 0'); break;
              case 'lock': exec('rundll32.exe user32.dll,LockWorkStation'); break;
              case 'volume_up': exec('powershell -Command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]175)"'); break;
              case 'volume_down': exec('powershell -Command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]174)"'); break;
              case 'volume_mute': exec('powershell -Command "$obj = New-Object -ComObject WScript.Shell; $obj.SendKeys([char]173)"'); break;
            }
          } else {
            // Linux/Mac Fallbacks
            switch (action) {
              case 'shutdown': exec('shutdown -h now'); break;
              case 'reboot': exec('reboot'); break;
            }
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
              
              const notification = new Notification({
                title: 'File Received via RemoteLink',
                body: `Saved to: ${savePath}`
              });

              notification.on('click', () => {
                shell.showItemInFolder(savePath);
              });

              notification.show();
              mainWindow?.webContents.send('host:status', `File Saved: ${savePath}`);
            }
          }
        } catch (err: any) {
          log.error('[Host] Binary message processing failed:', err.stack || err.message);
        }
      }
    }
  });

  videoDataChannel.onOpen(() => {
    log.info('[Host] Video DataChannel OPENED. Starting encoder...');
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
    log.info('[Host] Video DataChannel CLOSED');
    stopStreaming();
  });
}

// --- Signaling Proxy for Viewer ---
function setupViewerSignalingProxy(sessionId: string) {
  log.info(`[Proxy] Initializing Signaling Proxy for session: ${sessionId}`);
  viewerWs?.removeAllListeners('message');
  viewerWs?.on('message', (message) => {
    const data = JSON.parse(message.toString());
    log.info(`[Proxy] Received FROM SERVER: ${data.type}`);
    // Forward all incoming signaling messages to the Renderer
    mainWindow?.webContents.send('viewer:signaling-message', data);
  });
}

ipcMain.on('viewer:send-signaling', (_event: any, msg: any) => {
  log.info(`[Proxy] Sending TO SERVER: ${msg.type}`);
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
  
  if (app.isPackaged && (serverIP === '127.0.0.1' || serverIP === 'localhost')) {
    log.warn('[Security] Warning: Localhost detection in production package.');
  }

  const wsUrl = getSecureServerUrl(serverIP, 'ws') + ':3002';
  log.info(`[Host] Connecting to signaling server at: ${wsUrl} (Attempt ${hostReconnectAttempts + 1})`);
  signalingWs = new WebSocket(enforceSecureUrl(wsUrl));
  setupSignalingHandlers(signalingWs);
  
  signalingWs.on('open', () => {
    log.info('[Host] Signaling connected');
    hostReconnectAttempts = 0; // reset
    signalingWs?.send(JSON.stringify({ type: 'register', token, role: 'host', accessKey }));
  });
  
  signalingWs.on('message', (message) => {
    const data = JSON.parse(message.toString());
    if (data.type === 'registered' && resolve) {
        log.info('[Host] Successfully registered with signaling server');
        resolve(data.sessionId);
        resolve = null; // Prevent double resolve
    }
  });

  signalingWs.on('error', (err) => {
    log.error('[Host] Signaling WS Error:', err.stack || err.message);
    if (reject) {
      reject(err);
      reject = null;
    }
  });

  signalingWs.on('close', (code, reason) => {
    log.info(`[Host] Signaling server disconnected. Code: ${code}, Reason: ${reason}`);
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
      
      log.info(`[Host] Starting hosting sequence for accessKey: ${activeHostAccessKey}`);
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
      const wsUrl = getSecureServerUrl(serverIP, 'ws') + ':3002';
      console.log(`[Viewer] Connecting to signaling server at: ${wsUrl}`);
      viewerWs = new WebSocket(enforceSecureUrl(wsUrl));
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

ipcMain.handle('system:getDeterministicKey', () => {
  const interfaces = os.networkInterfaces();
  let mac = '';
  for (const key of Object.keys(interfaces)) {
    const list = interfaces[key];
    if (list) {
      const valid = list.find(i => !i.internal && i.mac !== '00:00:00:00:00:00');
      if (valid) { mac = valid.mac; break; }
    }
  }
  if (!mac) mac = os.hostname();
  
  const hash = require('crypto').createHash('sha256').update(mac).digest('hex');
  const code = (BigInt('0x' + hash.substring(0, 12)) % 1000000000n).toString().padStart(9, '0');
  return code;
});

ipcMain.handle('system:getMachineName', () => os.hostname());
ipcMain.handle('system:openPath', (_event, savePath) => shell.showItemInFolder(savePath));
ipcMain.handle('clipboard:readText', () => clipboard.readText());
ipcMain.handle('clipboard:writeText', (_event, text) => {
  lastClipboardText = text; // Update to avoid echo
  clipboard.writeText(text);
});
ipcMain.handle('auth:getToken', () => getAuthTokens());
ipcMain.handle('auth:setToken', (_event: any, t: string, r: string) => setAuthTokens(t, r));
ipcMain.handle('auth:deleteToken', async () => {
  return deleteAuthTokens();
});
ipcMain.handle('system:ping', () => 'pong');
ipcMain.handle('system:isPackaged', () => app.isPackaged);
ipcMain.handle('system:log', (_event, msg: string, level: string) => {
  const l = level as 'info' | 'warn' | 'error';
  (log as any)[l]?.(msg);
});
