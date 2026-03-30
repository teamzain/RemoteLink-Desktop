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


let mainWindow: BrowserWindow | null = null;
let hostSignalingWs: WebSocket | null = null;
const viewerWindows = new Map<string, BrowserWindow>();
const viewerSignalingSockets = new Map<string, WebSocket>();

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
let lastViewerJoinTime = 0;
let lastViewerId = '';
let lastViewerClientId = ''; // Persistent browser-assigned ID for stable reconnects
let currentHostSessionId = ''; // Track active hosting session for UI sync

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
    log.info(`[Host-FFmpeg-Stderr] ${data.toString()}`);
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

    // Diagnostic: Log first 16 bytes of raw output occasionally
    if (Math.random() < 0.001) {
      console.log(`[Host-FFmpeg] Raw Chunk Size: ${chunk.length}, Start: ${chunk.subarray(0, 16).toString('hex')}`);
    }

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

        if (nalType === 5) {
          console.log('[Host-FFmpeg] Keyframe (IDR) detected and buffered.');
        }

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
    if (Math.random() < 0.05) log.warn(`[Host] DataChannel buffer full (${channel.bufferedAmount()} bytes). Skipping AU.`);
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
      currentHostSessionId = data.sessionId || '';
      mainWindow?.webContents.send('host:status', 'Registered: ' + data.sessionId);
    } else if (data.type === 'viewer-joined') {
      const now = Date.now();
      const incomingClientId = data.viewerClientId || data.viewerId;
      
      // If the SAME browser client reconnects (e.g. React Strict Mode double-mount),
      // wait 1s to let stale sockets die, then refresh the session.
      if (lastViewerClientId === incomingClientId) {
        log.info(`[Host] Same viewer reconnected (clientId: ${incomingClientId}). Refreshing session in 1s...`);
        setTimeout(() => initiateHostWebRTC(data.viewerId), 1000);
        return;
      }

      // Debounce: Reduce to 200ms to allow React Strict Mode rapid reconnects from Web client
      if (now - lastViewerJoinTime < 200) {
        log.info(`[Host] Ignoring rapid viewer-join within 200ms cooldown window.`);
        return;
      }
      
      lastViewerJoinTime = now;
      lastViewerId = data.viewerId;
      lastViewerClientId = incomingClientId;
      log.info(`[Host] New viewer joined (clientId: ${incomingClientId}). Initiating WebRTC...`);
      initiateHostWebRTC(data.viewerId);
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

function initiateHostWebRTC(viewerId: string) {
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
    hostSignalingWs?.send(JSON.stringify({ type: 'offer', sdp, targetId: currentViewerId }));
  });

  peerConnection.onLocalCandidate((candidate: string, mid: string) => {
    hostSignalingWs?.send(JSON.stringify({ 
      type: 'ice-candidate', 
      candidate, 
      sdpMid: mid, 
      sdpMLineIndex: 0,
      targetId: currentViewerId 
    }));
  });

  peerConnection.onGatheringStateChange((state: string) => {
    log.info(`[Host] ICE Gathering State: ${state}`);
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
        case 'request-keyframe':
          log.info('[Host] Viewer requested keyframe. Forcing stream restart...');
          startStreaming();
          break;
        case 'action':
          const { action } = event;
          log.info(`[Host] Remote Action Received: ${action}`);
          const { exec } = require('child_process');
          
          if (process.platform === 'win32') {
            switch (action) {
              case 'shutdown': exec('shutdown /s /f /t 0'); break;
              case 'reboot': exec('shutdown /r /f /t 0'); break;
              case 'lock': exec('rundll32.exe user32.dll,LockWorkStation'); break;
              case 'task_manager': exec('taskmgr.exe'); break;
              case 'browser': exec('start https://www.google.com'); break;
              case 'explorer': exec('explorer.exe'); break;
              case 'show_desktop': 
                exec('powershell -ExecutionPolicy Bypass -Command "(new-object -com shell.application).toggleDesktop()"');
                break;
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
function setupViewerSignalingProxy(sessionId: string, socket: WebSocket) {
  log.info(`[Proxy] Initializing Signaling Proxy for session: ${sessionId}`);
  socket.removeAllListeners('message');
  socket.on('message', (message) => {
    const data = JSON.parse(message.toString());
    log.info(`[Proxy] Received FROM SERVER: ${data.type}`);
    // Forward to the specific window managing this session
    const win = viewerWindows.get(sessionId);
    if (win) {
      win.webContents.send('viewer:signaling-message', data);
    } else {
      // Fallback to main window if it's the dashboard initiating
      mainWindow?.webContents.send('viewer:signaling-message', data);
    }
  });
}

ipcMain.on('viewer:send-signaling', (event, msg) => {
  log.info(`[Proxy] Sending TO SERVER: ${msg.type}`);
  // Find which session this window belongs to
  let socket: WebSocket | undefined;
  for (const [sid, win] of viewerWindows.entries()) {
    if (win.webContents === event.sender) {
      socket = viewerSignalingSockets.get(sid);
      break;
    }
  }
  
  if (!socket) {
    // Fallback search in all sockets (or just the latest one)
    socket = Array.from(viewerSignalingSockets.values()).pop();
  }

  socket?.send(JSON.stringify(msg));
});

let activeHostAccessKey = '';
let activeHostToken = '';
let hostReconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 3;
let hostHeartbeatInterval: NodeJS.Timeout | null = null;

function connectHostSignaling(serverIP: string, token: string, accessKey: string, resolve?: any, reject?: any) {
  if (hostSignalingWs) {
    try { 
      if (hostHeartbeatInterval) clearInterval(hostHeartbeatInterval);
      hostSignalingWs.close(); 
    } catch {}
  }
  
  if (app.isPackaged && (serverIP === '127.0.0.1' || serverIP === 'localhost')) {
    log.warn('[Security] Warning: Localhost detection in production package.');
  }

  const wsUrl = getSecureServerUrl(serverIP, 'ws') + ':3002';
  log.info(`[Host] Connecting to signaling server at: ${wsUrl} (Attempt ${hostReconnectAttempts + 1})`);
  hostSignalingWs = new WebSocket(enforceSecureUrl(wsUrl));
  setupSignalingHandlers(hostSignalingWs);
  
  hostSignalingWs.on('open', () => {
    log.info('[Host] Signaling connected');
    hostReconnectAttempts = 0; // reset
    hostSignalingWs?.send(JSON.stringify({ type: 'register', token, role: 'host', accessKey }));
    
    // Start heartbeat to refresh TTL in signaling service
    if (hostHeartbeatInterval) clearInterval(hostHeartbeatInterval);
    hostHeartbeatInterval = setInterval(() => {
       if (hostSignalingWs?.readyState === 1) { // WebSocket.OPEN
          hostSignalingWs.send(JSON.stringify({ type: 'heartbeat' }));
       }
    }, 30000); // Send every 30s for a 60s TTL
  });
  
  hostSignalingWs.on('message', (message) => {
    const data = JSON.parse(message.toString());
    if (data.type === 'registered' && resolve) {
        log.info('[Host] Successfully registered with signaling server');
        resolve(data.sessionId);
        resolve = null; // Prevent double resolve
    }
  });

  hostSignalingWs.on('error', (err) => {
    log.error('[Host] Signaling WS Error:', err.stack || err.message);
    if (reject) {
      reject(err);
      reject = null;
    }
  });

  hostSignalingWs.on('close', (code, reason) => {
    log.info(`[Host] Signaling server disconnected. Code: ${code}, Reason: ${reason}`);
    if (hostHeartbeatInterval) {
       clearInterval(hostHeartbeatInterval);
       hostHeartbeatInterval = null;
    }
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
      
      log.info(`[Host] host:start IPC received from window. AccessKey: ${activeHostAccessKey}`);
      hostReconnectAttempts = 0;
      connectHostSignaling(serverIP, token, activeHostAccessKey, resolve, reject);
    } catch (e: any) { reject(e); }
  });
});

ipcMain.handle('host:getStatus', async () => {
  if (hostSignalingWs && hostSignalingWs.readyState === 1) { // WebSocket.OPEN
    return { 
      status: 'status', 
      sessionId: currentHostSessionId 
    };
  }
  return { status: 'idle' };
});

ipcMain.handle('host:stop', () => {
  log.info('[Host] host:stop IPC received. Terminating hosting...');
  activeHostToken = ''; // Prevent auto-reconnect
  if (hostSignalingWs && hostSignalingWs.readyState === 1) { // WebSocket.OPEN
    const socketToClose = hostSignalingWs;
    try {
      socketToClose.send(JSON.stringify({ type: 'unregister' }));
    } catch (e) {
      log.error('[Host] Failed to send unregister:', e);
    }
    // Give it a tiny moment to send before closing
    setTimeout(() => {
      socketToClose.close();
      if (hostSignalingWs === socketToClose) {
        hostSignalingWs = null;
      }
    }, 100);
  } else if (hostSignalingWs) {
    hostSignalingWs.close();
    hostSignalingWs = null;
  }
  cleanUpWebRTC();
  return { success: true };
});

// Deduplicate concurrent viewer:connect calls for the same session
const inFlightViewerConnections = new Map<string, Promise<any>>();

ipcMain.handle('viewer:connect', async (event, rawSessionId: string, serverIP: string = '127.0.0.1', providedToken?: string, viewerClientId?: string) => {
  const sessionId = rawSessionId.replace(/\s/g, '');

  // If there's already an in-flight connection attempt, return the same promise
  if (inFlightViewerConnections.has(sessionId)) {
    log.info(`[Viewer] De-duplicating concurrent connect call for: ${sessionId}`);
    return inFlightViewerConnections.get(sessionId);
  }

  const promise = new Promise(async (resolve, reject) => {
    try {
      const { token: storedToken } = await getAuthTokens();
      const token = providedToken || storedToken;
      const wsUrl = getSecureServerUrl(serverIP, 'ws') + ':3002';
      log.info(`[Viewer] Connecting to signaling server at: ${wsUrl}`);

      // Safely terminate any existing stale socket
      const existingSocket = viewerSignalingSockets.get(sessionId);
      if (existingSocket) {
        try {
          existingSocket.removeAllListeners();
          if (existingSocket.readyState === 0) {
            (existingSocket as any).terminate(); // Safe for CONNECTING state
          } else if (existingSocket.readyState === 1) {
            existingSocket.close();
          }
        } catch (e) {
          // Ignore close errors on stale sockets
        }
        viewerSignalingSockets.delete(sessionId);
      }

      const socket = new WebSocket(enforceSecureUrl(wsUrl));
      viewerSignalingSockets.set(sessionId, socket);

      socket.on('error', (err) => {
        log.error('[Viewer] WebSocket error:', err.message);
        inFlightViewerConnections.delete(sessionId);
        reject(err);
      });

      socket.once('open', () => {
        const joinMsg: any = { type: 'join', sessionId, token };
        if (viewerClientId) joinMsg.viewerClientId = viewerClientId;
        socket.send(JSON.stringify(joinMsg));
        log.info(`[Viewer] Sent join for session: ${sessionId} with clientId: ${viewerClientId || 'none'}`);

        socket.on('message', (raw) => {
          try {
            const data = JSON.parse(raw.toString());
            log.info(`[Viewer-Proxy] Received: ${data.type}`);

            if (data.type === 'joined') {
              inFlightViewerConnections.delete(sessionId);
              if (data.success) {
                log.info('[Viewer] Join confirmed. Signaling proxy active.');
                resolve(true);
              } else {
                log.error('[Viewer] Join rejected:', data.error);
                reject(new Error(data.error || 'Session not found'));
              }
              return;
            }

            // Forward offer/ice-candidate to the correct window
            const win = viewerWindows.get(sessionId);
            if (win && !win.isDestroyed()) {
              win.webContents.send('viewer:signaling-message', data);
            } else {
              mainWindow?.webContents.send('viewer:signaling-message', data);
            }
          } catch (e) {
            log.error('[Viewer-Proxy] Failed to parse message:', e);
          }
        });
      });
    } catch (e: any) {
      inFlightViewerConnections.delete(sessionId);
      reject(e);
    }
  });

  inFlightViewerConnections.set(sessionId, promise);
  return promise;
});

ipcMain.handle('viewer:open-window', async (_event, sessionId: string, serverIP: string, token: string, deviceName?: string) => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    backgroundColor: '#050505',
    title: `SyncLink - ${deviceName || sessionId}`,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  viewerWindows.set(sessionId, win);

  const query = new URLSearchParams({
    view: 'viewer',
    sessionId,
    serverIP,
    token: token || '',
    deviceName: deviceName || ''
  }).toString();

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(`${process.env.VITE_DEV_SERVER_URL}?${query}`);
  } else {
    win.loadFile(join(__dirname, '../../dist/index.html'), { 
      query: { 
        view: 'viewer', 
        sessionId, 
        serverIP, 
        token: token || '', 
        deviceName: deviceName || '' 
      } as any 
    });
  }

  win.on('closed', () => {
    viewerWindows.delete(sessionId);
    const socket = viewerSignalingSockets.get(sessionId);
    if (socket) {
      try { socket.close(); } catch {}
      viewerSignalingSockets.delete(sessionId);
    }
  });

  // Automatically open console as requested by user
  win.webContents.once('dom-ready', () => {
    win.webContents.openDevTools({ mode: 'detach' });
  });

  return true;
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
