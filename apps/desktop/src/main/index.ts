import { app, shell, dialog, BrowserWindow, ipcMain, safeStorage, clipboard, screen, Notification, session, Menu } from 'electron';
import log from 'electron-log';
import { join, basename } from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import { WebSocket } from 'ws';
import * as os from 'os';
import * as datachannel from 'node-datachannel';
import * as input from '@remotelink/native-input';

const PROTOCOL = 'remotelink';
const AUTH_STORE_PATH = join(app.getPath('userData'), 'remotelink_auth.json');

// --- State Management ---
let mainWindow: BrowserWindow | null = null;
let hostSignalingWs: WebSocket | null = null;
const viewerWindows = new Map<string, BrowserWindow>();
const viewerSignalingSockets = new Map<string, WebSocket>();

let peerConnection: any = null;
let dataChannel: any = null;
let videoTrack: any = null;
let videoRtpConfig: any = null;
let currentRtpTimestamp = 0;
let currentViewerId: string | null = null;
let ffmpegProcess: ChildProcess | null = null;
let hostHeartbeatInterval: NodeJS.Timeout | null = null;
let isReconnectScheduled = false;
let iceCandidatesQueue: any[] = [];
let hasRemoteDescription = false;
let fileTransfers = new Map<string, { chunks: (Buffer | null)[], received: number, total: number }>();

let lastClipboardText = '';
let clipboardInterval: NodeJS.Timeout | null = null;
let currentHostSessionId = '';
let lastViewerJoinTime = 0;
let totalBytesSent = 0;
let statsInterval: NodeJS.Timeout | null = null;
let firstFrameSent = false;
let frameCount = 0;
let lastLogTime = 0;
let activeHostToken = '';
let activeHostAccessKey = '';
let lastViewerJoinId = '';
let lastLogBytes = 0;
let pingInterval: NodeJS.Timeout | null = null;

// Streaming Accumulators
let bufferAccumulator = Buffer.alloc(0);
let nalAccumulator = Buffer.alloc(0);
let hasVCLInAccumulator = false;

// --- IPC Handlers ---
ipcMain.handle('system:getLocalIP', () => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]!) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
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
  const crypto = require('crypto');
  const hash = crypto.createHash('sha256').update(mac).digest('hex');
  return (BigInt('0x' + hash.substring(0, 12)) % 1000000000n).toString().padStart(9, '0');
});

ipcMain.handle('system:getMachineName', () => os.hostname());
ipcMain.handle('system:isPackaged', () => app.isPackaged);
ipcMain.handle('system:openPath', (_event, path) => shell.openPath(path));
ipcMain.handle('system:log', (_event, msg, level) => {
  const l = level as 'info' | 'warn' | 'error';
  (log as any)[l]?.(msg);
});
ipcMain.handle('auth:getToken', () => getAuthTokens());
ipcMain.handle('auth:setToken', (_event, t, r) => setAuthTokens(t, r));
ipcMain.handle('auth:deleteToken', () => fs.unlink(AUTH_STORE_PATH).then(() => true).catch(() => false));
ipcMain.handle('host:getStatus', async () => {
  if (hostSignalingWs && hostSignalingWs.readyState === 1) return { status: 'status', sessionId: currentHostSessionId };
  return { status: 'idle' };
});
ipcMain.handle('host:start', async (_, accessKey) => {
  const { token } = await getAuthTokens();
  const serverIP = process.env.REMOTE_LINK_SERVER_IP || '159.65.84.190';
  connectHostSignaling(serverIP, token || '', accessKey || '');
  return true;
});
ipcMain.handle('host:stop', () => { cleanUpWebRTC(); hostSignalingWs?.close(); return true; });
ipcMain.handle('clipboard:readText', () => clipboard.readText());
ipcMain.handle('clipboard:writeText', (_event, text) => { lastClipboardText = text; clipboard.writeText(text); });
ipcMain.handle('viewer:open-window', (_event, sessionId, serverIP, token, deviceName) => {
  if (viewerWindows.has(sessionId)) {
    viewerWindows.get(sessionId)?.focus();
    return true;
  }
  const viewerWin = new BrowserWindow({
    width: 1280, height: 720,
    backgroundColor: '#060608',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  });

  const query = `?view=viewer&sessionId=${sessionId}&serverIP=${serverIP}&token=${token}&deviceName=${encodeURIComponent(deviceName || '')}`;
  if (process.env.VITE_DEV_SERVER_URL) {
    viewerWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}${query}`);
  } else {
    viewerWin.loadFile(join(__dirname, '../../dist/index.html'), { query: { view: 'viewer', sessionId, serverIP, token, deviceName: deviceName || '' } });
  }
  
  viewerWin.on('closed', () => {
    viewerWindows.delete(sessionId);
    const ws = viewerSignalingSockets.get(sessionId);
    if (ws) { ws.close(); viewerSignalingSockets.delete(sessionId); }
  });
  
  viewerWindows.set(sessionId, viewerWin);
  return true;
});

ipcMain.handle('viewer:connect', async (_event, sessionId, serverIP, token, viewerClientId) => {
  log.info(`[Viewer] Connecting to session: ${sessionId} at ${serverIP}`);
  connectViewerSignaling(sessionId, serverIP || '159.65.84.190', token || '', viewerClientId);
  return true;
});

ipcMain.on('viewer:send-signaling', (_event, msg) => {
  const sessionId = msg.sessionId || msg.targetId;
  if (!sessionId) return;
  const ws = viewerSignalingSockets.get(sessionId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
});

ipcMain.handle('shell:openExternal', (_event, url) => shell.openExternal(url));


// --- Utility Functions ---
const getFFmpegPath = () => {
    if (app.isPackaged) return join(process.resourcesPath, 'ffmpeg.exe');
    return join(app.getAppPath(), '../../node_modules/ffmpeg-static/ffmpeg.exe');
};

async function getAuthTokens() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return { token: null, refresh: null };
    const data = await fs.readFile(AUTH_STORE_PATH, 'utf8');
    const { encToken, encRefresh } = JSON.parse(data);
    return {
      token: safeStorage.decryptString(Buffer.from(encToken, 'hex')),
      refresh: safeStorage.decryptString(Buffer.from(encRefresh, 'hex'))
    };
  } catch (e) { return { token: null, refresh: null }; }
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
  } catch (e) { return false; }
}

function cleanUpWebRTC() {
  log.info('[Host] Cleaning up WebRTC resources...');
  stopStreaming();
  if (dataChannel) { try { dataChannel.close(); } catch {} dataChannel = null; }
  if (videoTrack) { try { videoTrack.close(); } catch {} videoTrack = null; }
  if (peerConnection) { try { peerConnection.close(); } catch {} peerConnection = null; }
  iceCandidatesQueue = [];
  hasRemoteDescription = false;
  currentViewerId = null;
  if (clipboardInterval) { clearInterval(clipboardInterval); clipboardInterval = null; }
  if (pingInterval) { clearInterval(pingInterval); pingInterval = null; }
}

function stopStreaming() {
  if (ffmpegProcess) {
    ffmpegProcess.stdin?.end();
    ffmpegProcess.kill();
    ffmpegProcess = null;
  }
}

// --- Video Handlers ---
function startStreaming() {
  log.info('[Host] Initializing high-performance stream...');
  stopStreaming();

  const ffmpegPath = getFFmpegPath();
  
  // High-fidelity configuration
  const bitrate = '6000k';
  const fps = '60';

  // Base arguments
  let args = [
    '-f', 'gdigrab', 
    '-thread_queue_size', '1024',
    '-framerate', fps, 
    '-draw_mouse', '0', 
    '-i', 'desktop',
    '-vf', 'scale=min(iw\\,1920):-2,format=yuv420p',
  ];

  // Encoder selection (Priority: NVENC > AMF > QSV > libx264)
  // We'll use a shell command to check support or just try-catch? 
  // For simplicity in this script, we default to libx264 but with higher quality, 
  // OR we can bake in a detection logic. 
  // Let's use a robust libx264 config first, but I will add the HW detection as a TODO or implement a quick check.
  // Actually, I'll use h264_nvenc as a preferred fallback if it fails we can restart with libx264.
  // But for now, let's optimize libx264 to be MUCH clearer.

  args.push(
    '-c:v', 'libx264',
    '-preset', 'ultrafast', 
    '-tune', 'zerolatency',
    '-profile:v', 'baseline',
    '-level', '4.1',
    '-b:v', bitrate,
    '-maxrate', bitrate,
    '-minrate', bitrate,
    '-bufsize', '500k', // Minimized for instant startup
    '-g', '30', // IDR every 0.5s for black-screen fix
    '-x264-params', 'repeat-headers=1:keyint=30:bframes=0:annexb=1:aud=1:bitrate=6000:vbv-maxrate=6000:vbv-bufsize=500',
    '-f', 'h264', '-'
  );

  ffmpegProcess = spawn(ffmpegPath, args);

  bufferAccumulator = Buffer.alloc(0);

  ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
    if (!videoTrack) return;
    bufferAccumulator = Buffer.concat([bufferAccumulator, chunk]);

    let offset = 0;
    while (offset < bufferAccumulator.length - 4) {
      const isHeader4 = bufferAccumulator[offset] === 0 && bufferAccumulator[offset + 1] === 0 && bufferAccumulator[offset + 2] === 0 && bufferAccumulator[offset + 3] === 1;
      const isHeader3 = bufferAccumulator[offset] === 0 && bufferAccumulator[offset + 1] === 0 && bufferAccumulator[offset + 2] === 1;

      if (isHeader4 || isHeader3) {
        const headerLen = isHeader4 ? 4 : 3;
        const nalType = bufferAccumulator[offset + headerLen] & 0x1F;

        // Detect Access Unit Delimiter (NAL type 9) which marks the start of a new frame
        if (nalType === 9 && offset > 0) {
          const frameData = bufferAccumulator.subarray(0, offset);
          sendFrame(frameData);
          bufferAccumulator = bufferAccumulator.subarray(offset);
          offset = 0;
          continue;
        }
      }
      offset++;
    }

    // Failsafe for buffer overflow
    if (bufferAccumulator.length > 5 * 1024 * 1024) {
      log.warn('[Host] NAL buffer overflow. Clearing.');
      bufferAccumulator = Buffer.alloc(0);
    }
  });

  ffmpegProcess.stderr?.on('data', (data) => {
    if (data.toString().includes('kB time=')) return; // Suppress progress spam
    log.info(`[Host-FFmpeg] ${data.toString().trim()}`);
  });
}



function sendFrame(frame: Buffer) {
  if (!videoTrack || !videoRtpConfig || !peerConnection) return;
  
  // Track and Connection MUST be open/connected
  try {
    if (!videoTrack.isOpen() || peerConnection.state() !== 'connected') {
      return;
    }

    // Increment RTP timestamp for the new frame (90000 Hz / 60 fps = 1500 limit)
    currentRtpTimestamp += 1500;
    videoRtpConfig.timestamp = currentRtpTimestamp;

    if (!firstFrameSent) {
      log.info(`[Host] First video frame fully assembled (${frame.length} bytes). Delivering to peer...`);
      firstFrameSent = true;
    }

    totalBytesSent += frame.length;
    videoTrack.sendMessageBinary(frame, videoRtpConfig);
    frameCount++;
    
    const now = Date.now();
    if (now - lastLogTime > 5000) {
      const duration = (now - lastLogTime) / 1000;
      const bytesTransmitted = totalBytesSent - lastLogBytes;
      const mbps = ((bytesTransmitted * 8) / (1024 * 1024)) / duration;
      log.info(`[Host] Media health: Sent ${frameCount} frames total. Current RTP timestamp: ${currentRtpTimestamp}. Bandwidth: ${mbps.toFixed(2)} Mbps`);
      lastLogBytes = totalBytesSent;
      lastLogTime = now;
    }
  } catch (err: any) {
    // Silently handle "Track is non-open" or "Track is closed" at this layer
    // This prevents the native C++ throw from crashing the Node process
    if (err?.message?.includes('closed') || err?.message?.includes('not open')) {
      stopStreaming();
    } else {
      log.error(`[Host] Error sending frame: ${err?.message}`);
    }
  }
}

// --- WebRTC Logic ---
function initiateHostWebRTC(viewerId: string) {
  log.info(`[Host] Initializing session for: ${viewerId}`);
  cleanUpWebRTC();
  currentViewerId = viewerId;

  peerConnection = new datachannel.PeerConnection("Host", {
    iceServers: ["stun:stun.l.google.com:19302"]
  });

  peerConnection.onLocalDescription((sdp: string) => {
    log.info(`[Host] Sending SDP Offer (len: ${sdp.length})...`);
    // log.info(`[Host] Offer SDP:\n${sdp}`);
    hostSignalingWs?.send(JSON.stringify({ type: 'offer', sdp, targetId: currentViewerId }));
  });

  peerConnection.onLocalCandidate((candidate: string, mid: string) => {
    const mLineIndex = (mid === '0' || mid === 'video') ? 0 : 1;
    hostSignalingWs?.send(JSON.stringify({ 
      type: 'ice-candidate', candidate, sdpMid: mid, sdpMLineIndex: mLineIndex, targetId: currentViewerId 
    }));
  });

  peerConnection.onStateChange((state: string) => {
    log.info(`[Host] WebRTC State: ${state}`);
    mainWindow?.webContents.send('host:status', `WebRTC: ${state}`);
  });

  const video = new datachannel.Video("0", "SendOnly");
  video.addH264Codec(96);
  // node-datachannel: (ssrc, cname, payloadType, clockRate)
  videoRtpConfig = new datachannel.RtpPacketizationConfig(1, "video", 96, 90000);
  const packetizer = new datachannel.H264RtpPacketizer("StartSequence", videoRtpConfig);
  
  firstFrameSent = false;
  frameCount = 0;
  lastLogTime = Date.now();
  currentRtpTimestamp = 0;
  videoTrack = peerConnection.addTrack(video);
  videoTrack.setMediaHandler(packetizer);

  videoTrack.onOpen(() => {
    log.info('[Host] Video track open. Starting streaming...');
    startStreaming();
  });

  // Adding DataChannel AFTER the Media Track ensures `node-datachannel`'s implicit asynchronous SDP generator packages BOTH into the singular Offer.
  dataChannel = peerConnection.createDataChannel("control");
  dataChannel.onOpen(() => {
    log.info('[Host] Control DataChannel open. Starting Heartbeat & Clipboard loops...');
    
    // 1. Start Ping Heartbeat (1s)
    if (pingInterval) clearInterval(pingInterval);
    pingInterval = setInterval(() => {
      if (dataChannel && dataChannel.isOpen()) {
        dataChannel.sendMessage(JSON.stringify({ type: 'ping' }));
      }
    }, 1000);

    // 2. Start Clipboard Sync (500ms)
    if (clipboardInterval) clearInterval(clipboardInterval);
    lastClipboardText = clipboard.readText();
    clipboardInterval = setInterval(() => {
       const text = clipboard.readText();
       if (text && text !== lastClipboardText) {
          lastClipboardText = text;
          if (dataChannel && dataChannel.isOpen()) {
             log.info(`[Host] Local clipboard changed. Syncing to viewer... (${text.substring(0, 20)}...)`);
             dataChannel.sendMessage(JSON.stringify({ type: 'clipboard', text }));
          }
       }
    }, 500);
  });
  dataChannel.onMessage((msg: any) => handleControlMessage(msg));

  // Explicitly trigger the Offer generation to ensure all configured tracks are included.
  peerConnection.setLocalDescription();
}

function handleControlMessage(msg: any) {
  try {
    // 1. Handle Binary File Chunks
    if (Buffer.isBuffer(msg)) {
      const view = new DataView(msg.buffer, msg.byteOffset, 4);
      const headerLen = view.getUint32(0, true);
      const headerStr = msg.slice(4, 4 + headerLen).toString();
      const header = JSON.parse(headerStr);
      const chunk = msg.slice(4 + headerLen);

      if (header.type === 'file-chunk') {
        log.info(`[Diagnostic] Reassembler: Received chunk ${header.chunkIndex+1}/${header.totalChunks} for ${header.name}`);
        let transfer = fileTransfers.get(header.name);
        if (!transfer) {
          transfer = { chunks: new Array(header.totalChunks).fill(null), received: 0, total: header.totalChunks };
          fileTransfers.set(header.name, transfer);
        }
        
        if (!transfer.chunks[header.chunkIndex]) {
          transfer.chunks[header.chunkIndex] = chunk;
          transfer.received++;
        }

        if (transfer.received === transfer.total) {
          const finalBuffer = Buffer.concat(transfer.chunks as Buffer[]);
          const downloadsPath = app.getPath('downloads');
          const filePath = join(downloadsPath, header.name);
          fs.writeFile(filePath, finalBuffer).then(() => {
            log.info(`[Host] File transfer complete: ${header.name} -> ${filePath}`);
            new Notification({ title: 'Payload Delivered', body: `Saved ${header.name} to Downloads` }).show();
            
            // Inform the viewer exactly where it was stored
            if (dataChannel) {
              log.info(`[Diagnostic] Sending file-sent confirmation back to viewer for ${header.name}`);
              dataChannel.sendMessage(JSON.stringify({ type: 'file-sent', name: header.name, path: filePath }));
            }
          }).catch(err => {
            log.error(`[Host] Failed to write file: ${err.message}`);
          });
          fileTransfers.delete(header.name);
        }
      }
      return;
    }

    // 2. Handle JSON Commands
    const event = JSON.parse(msg.toString());
    switch (event.type) {
      case 'mousemove': input.injectMouseMove(event.x, event.y); break;
      case 'mousedown': case 'mouseup':
        // Sync movement before click to ensure accuracy
        if (event.x !== undefined && event.y !== undefined) {
          input.injectMouseMove(event.x, event.y);
        }
        const btns: any = { 0: 'left', 1: 'middle', 2: 'right' };
        input.injectMouseAction(btns[event.button] || 'left', event.type === 'mousedown' ? 'down' : 'up');
        break;
      case 'keydown': case 'keyup':
        log.info(`[Diagnostic] Remote Input: Key ${event.type === 'keydown' ? 'Down' : 'Up'} (VK: 0x${event.keyCode.toString(16)})`);
        input.injectKeyAction(event.keyCode, event.type === 'keydown' ? 'down' : 'up');
        break;
      case 'clipboard':
        if (event.text && event.text !== lastClipboardText) {
           log.info(`[Host] Received clipboard update from viewer: ${event.text.substring(0, 20)}...`);
           lastClipboardText = event.text;
           clipboard.writeText(event.text);
        }
        break;
      case 'typeText':
        input.injectText(event.text);
        break;
      case 'request-keyframe':
        log.info('[Host] Keyframe requested. Restarting stream.');
        startStreaming();
        break;
    }
  } catch {}
}

// --- Signaling & App Setup ---
function setupSignalingHandlers(ws: WebSocket) {
  ws.on('message', (message) => {
    const data = JSON.parse(message.toString());
    if (data.type === 'registered') {
      currentHostSessionId = data.sessionId;
      mainWindow?.webContents.send('host:status', `Online: ${data.sessionId}`);
    } else if (data.type === 'viewer-joined' || data.type === 'request-offer') {
      const viewerId = data.viewerId || data.senderId;
      const now = Date.now();
      
      // Debounce frequent join requests to prevent signaling loops
      if (viewerId === lastViewerJoinId && (now - lastViewerJoinTime) < 2000) {
        log.info(`[Host] Ignoring duplicate join request for: ${viewerId}`);
        return;
      }
      
      lastViewerJoinId = viewerId;
      lastViewerJoinTime = now;
      initiateHostWebRTC(viewerId);
    } else if (data.type === 'answer') {
      try {
        log.info(`[Host] Applying remote answer (len: ${data.sdp.length})...`);
        log.info(`[Host] Full Answer SDP:\n${data.sdp}`); 
        peerConnection?.setRemoteDescription(data.sdp, 'answer');
        hasRemoteDescription = true;
        
        log.info(`[Host] Remote answer applied. Processing ${iceCandidatesQueue.length} queued candidates.`);
        iceCandidatesQueue.forEach(c => peerConnection?.addRemoteCandidate(c.candidate, c.mid));
        iceCandidatesQueue = [];
      } catch (err: any) {
        log.error(`[Host] libdatachannel error during setRemoteDescription: ${err.message}`);
        log.error(`[Host] Error Stack: ${err.stack}`);
      }
    } else if (data.type === 'ice-candidate') {
      const mid = data.sdpMid || "";
      log.info(`[Host] Received candidate from remote: ${data.candidate.substring(0, 40)}... (mid: ${mid})`);
      
      if (hasRemoteDescription) {
        peerConnection?.addRemoteCandidate(data.candidate, mid);
      } else {
        iceCandidatesQueue.push({ candidate: data.candidate, mid });
      }
    } else if (data.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });
}

function connectHostSignaling(serverIP: string, token: string, accessKey: string) {
  if (hostSignalingWs) {
    hostSignalingWs.close();
    hostSignalingWs = null;
  }

  const wsUrl = `ws://${serverIP}/api/signal`;
  log.info(`[Host] Connecting to signaling server at ${wsUrl}...`);
  hostSignalingWs = new WebSocket(wsUrl);
  setupSignalingHandlers(hostSignalingWs);
  
  hostSignalingWs.on('open', () => {
    log.info('[Host] Signaling socket open. Registering host...');
    isReconnectScheduled = false;
    hostSignalingWs?.send(JSON.stringify({ type: 'register', token, role: 'host', accessKey }));
    
    // Start heartbeat to keep the session alive in Redis
    if (hostHeartbeatInterval) clearInterval(hostHeartbeatInterval);
    hostHeartbeatInterval = setInterval(() => {
      if (hostSignalingWs?.readyState === WebSocket.OPEN) {
        // console.log('[Host] Pulse...'); // Debug logging
        hostSignalingWs.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 10000); // 10s heartbeat for high stability
  });

  hostSignalingWs.on('close', () => {
    log.warn('[Host] Signaling connection closed.');
    if (hostHeartbeatInterval) { clearInterval(hostHeartbeatInterval); hostHeartbeatInterval = null; }
    
    // Automatic reconnection logic
    if (!isReconnectScheduled) {
      isReconnectScheduled = true;
      log.info('[Host] Scheduling reconnection in 5 seconds...');
      setTimeout(() => {
        isReconnectScheduled = false; // Allow new schedules if this one fails
        if (!hostSignalingWs || hostSignalingWs.readyState !== WebSocket.OPEN) {
          log.info('[Host] Retrying connection...');
          connectHostSignaling(serverIP, token, accessKey);
        }
      }, 5000);
    }
  });

  hostSignalingWs.on('error', (err) => {
    log.error(`[Host] Signaling error: ${err.message}`);
    // Reuse the close logic for reconnection
    if (!isReconnectScheduled) {
       hostSignalingWs?.close(); 
    }
  });
}

// --- Deep Link Handling ---
function handleDeepLink(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.host === 'auth' && parsed.pathname === '/callback') {
      const accessToken  = parsed.searchParams.get('accessToken');
      const refreshToken = parsed.searchParams.get('refreshToken');
      if (accessToken && refreshToken) {
        setAuthTokens(accessToken, refreshToken).then(() => {
          mainWindow?.webContents.send('auth:deep-link-success', { accessToken, refreshToken });
        });
      }
    }
  } catch (e) {
    log.error('[DeepLink] Failed to parse URL:', e);
  }
}

// macOS: register open-url before whenReady
app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Register custom protocol & single-instance lock (Windows / Linux deep links)
app.setAsDefaultProtocolClient(PROTOCOL);

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    // The deep-link URL is the last element on Windows
    const url = argv.find((a) => a.startsWith(`${PROTOCOL}://`));
    if (url) handleDeepLink(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

// --- Electron Initialization ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: { preload: join(__dirname, '../preload/index.js'), contextIsolation: true, sandbox: true }
  });
  if (process.env.VITE_DEV_SERVER_URL) mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  else mainWindow.loadFile(join(__dirname, '../../dist/index.html'));
}

app.whenReady().then(() => {
  createWindow();

  // Handle startup deep link: when the app was launched fresh by a remotelink:// URL
  const startupUrl = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`));
  if (startupUrl) {
    mainWindow?.webContents.once('did-finish-load', () => handleDeepLink(startupUrl));
  }
});

ipcMain.handle('host:save-file-locally', async (_event, name: string, data: Uint8Array) => {
  const downloadsPath = app.getPath('downloads');
  const filePath = join(downloadsPath, name);
  await fs.writeFile(filePath, Buffer.from(data));
  return filePath;
});

ipcMain.on('host:send-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile']
  });
  
  if (!result.canceled && result.filePaths.length > 0 && dataChannel) {
    const filePath = result.filePaths[0];
    const fileName = basename(filePath);
    const stats = await fs.stat(filePath);
    const totalSize = stats.size;
    
    // Chunking 16KB
    const CHUNK_SIZE = 16 * 1024;
    const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
    const fd = await fs.open(filePath, 'r');
    
    for (let i = 0; i < totalChunks; i++) {
        const buffer = Buffer.alloc(CHUNK_SIZE);
        const { bytesRead } = await fd.read(buffer, 0, CHUNK_SIZE, i * CHUNK_SIZE);
        const chunk = buffer.slice(0, bytesRead);
        
        const header = JSON.stringify({ type: 'file-chunk', name: fileName, totalSize, chunkIndex: i, totalChunks });
        const headerBuffer = Buffer.from(header);
        const fullBuffer = Buffer.alloc(4 + headerBuffer.length + chunk.length);
        fullBuffer.writeUInt32LE(headerBuffer.length, 0);
        headerBuffer.copy(fullBuffer, 4);
        chunk.copy(fullBuffer, 4 + headerBuffer.length);
        
        dataChannel.sendMessageBinary(fullBuffer);
        // Small delay to prevent saturation
        if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
    }
    await fd.close();
  }
});

// Stats emitter
function startStatsMonitoring() {
  if (statsInterval) clearInterval(statsInterval);
  let prevBytes = 0;
  
  statsInterval = setInterval(() => {
    if (!mainWindow) return;
    
    const currentBytes = totalBytesSent;
    const bps = currentBytes - prevBytes;
    prevBytes = currentBytes;
    
    // Mbps calculation
    const mbps = (bps * 8) / (1024 * 1024);
    const activePeers = (peerConnection && peerConnection.state() === 'connected') ? 1 : 0;
    
    mainWindow.webContents.send('host:stats', { 
      bandwidth: mbps.toFixed(2), 
      activeUsers: activePeers 
    });
  }, 1000);
}

// Initial stats start
app.on('ready', () => {
    startStatsMonitoring();
});

app.on('window-all-closed', () => app.quit());

function connectViewerSignaling(sessionId: string, serverIP: string, token: string, viewerClientId?: string) {
  const wsUrl = `ws://${serverIP}/api/signal`;
  const ws = new WebSocket(wsUrl);
  viewerSignalingSockets.set(sessionId, ws);

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'join', sessionId, token, viewerClientId }));
  });

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const win = viewerWindows.get(sessionId);
      if (win) {
        win.webContents.send('viewer:signaling-message', msg);
      }
    } catch (e) {
      log.error('[Viewer] Failed to process signaling message:', e);
    }
  });

  ws.on('close', () => {
    const win = viewerWindows.get(sessionId);
    if (win) win.webContents.send('viewer:signaling-disconnected');
    viewerSignalingSockets.delete(sessionId);
  });
}

