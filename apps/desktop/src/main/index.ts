import { app, shell, dialog, BrowserWindow, ipcMain, safeStorage, clipboard, screen, Notification, session, Menu } from 'electron';
import log from 'electron-log';
import { join, basename } from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import { WebSocket } from 'ws';
import * as os from 'os';
import * as datachannel from 'node-datachannel';
import * as input from '@remotelink/native-input';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Disable Hardware Acceleration for desktop host window to ensure
// it remains visible and controllable via DXGI capture.
app.disableHardwareAcceleration();

// Allow video autoplay in viewer windows opened programmatically (no prior user gesture).
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

// Robust Native Capture Loading
let capture: any;
try {
  capture = require('@remotelink/native-capture');
} catch (e) {
  try {
    // Fallback for some monorepo/development environments
    capture = require('../../../../packages/native-capture/build/Release/capture.node');
  } catch (e2) {
    console.error('[Host] Failed to load native-capture module:', e2);
  }
}

// @ts-ignore: Module types
declare module '@remotelink/native-capture' {
  export function captureFrame(): { width: number; height: number; data: Buffer };
}

const PROTOCOL = 'connectx';
let AUTH_STORE_PATH: string;

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
let rtpStartTime = 0; // wall-clock ms when streaming started
let currentViewerId: string | null = null;
let ffmpegProcess: ChildProcess | null = null;
let captureInterval: NodeJS.Timeout | null = null;
let cursorInterval: NodeJS.Timeout | null = null;
let hostHeartbeatInterval: NodeJS.Timeout | null = null;
let isReconnectScheduled = false;
let iceCandidatesQueue: any[] = [];
let hasRemoteDescription = false;
let fileTransfers = new Map<string, { chunks: (Buffer | null)[], received: number, total: number }>();

let lastClipboardText = '';
let clipboardInterval: NodeJS.Timeout | null = null;
let selectedDisplayId: number | null = null; // null means primary display
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

// Streaming Accumulators (Annex-B Aggregator)
let bufferAccumulator = Buffer.alloc(0);
let accessUnitBuffer = Buffer.alloc(0);
let hasVcl = false;

// Pre-buffering and Handshake
let ffmpegPreChunks: Buffer[] = [];
let isPreBuffering = false;

// Hardware encoder detection cache
let detectedEncoder: string = 'libx264';
let encoderDetected = false;

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
  const serverIP = process.env.CONNECT_X_SERVER_IP || '159.65.84.190';
  connectHostSignaling(serverIP, token || '', accessKey || '');
  return true;
});
ipcMain.handle('host:stop', () => { cleanUpWebRTC(); hostSignalingWs?.close(); return true; });

ipcMain.handle('host:get-screens', () => {
  const displays = screen.getAllDisplays();
  return displays.map(d => ({
    id: d.id,
    label: `${d.label || 'Display'} (${d.bounds.width}x${d.bounds.height})`,
    bounds: d.bounds
  }));
});

ipcMain.handle('host:set-capture-screen', (_, displayId) => {
  log.info(`[Host] Switching capture screen to: ${displayId}`);
  selectedDisplayId = displayId;
  if (videoTrack && peerConnection?.state() === 'connected') {
    startStreaming();
  }
  return true;
});
ipcMain.handle('clipboard:readText', () => clipboard.readText());
ipcMain.handle('clipboard:writeText', (_event, text) => { lastClipboardText = text; clipboard.writeText(text); });
ipcMain.handle('viewer:open-window', (_event, sessionId, serverIP, token, deviceName, deviceType) => {
  if (viewerWindows.has(sessionId)) {
    viewerWindows.get(sessionId)?.focus();
    return true;
  }
  const isMobile = deviceType?.toLowerCase() === 'android' || deviceType?.toLowerCase() === 'ios';
  const viewerWin = new BrowserWindow({
    width: isMobile ? 440 : 1280,
    height: isMobile ? 900 : 720,
    backgroundColor: '#060608',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  });

  const query = `?view=viewer&sessionId=${sessionId}&serverIP=${serverIP}&token=${token}&deviceName=${encodeURIComponent(deviceName || '')}&deviceType=${encodeURIComponent(deviceType || '')}`;
  if (process.env.VITE_DEV_SERVER_URL) {
    viewerWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}${query}`);
  } else {
    viewerWin.loadFile(join(__dirname, '../../dist/index.html'), { query: { view: 'viewer', sessionId, serverIP, token, deviceName: deviceName || '', deviceType: deviceType || '' } });
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
  if (captureInterval) {
    clearInterval(captureInterval);
    captureInterval = null;
  }
  if (cursorInterval) {
    clearInterval(cursorInterval);
    cursorInterval = null;
  }
  if (ffmpegProcess) {
    ffmpegProcess.stdin?.end();
    ffmpegProcess.kill();
    ffmpegProcess = null;
  }
}

// --- Encoder Detection ---

/** Build encoder-specific FFmpeg args for low-latency, high-quality streaming.
 *  ALL encoders must emit AUD NAL units so the frame splitter works correctly. */
function getEncoderArgs(encoder: string, bitrate: string, fps: string): string[] {
  const gop = '10'; // keyframe every 10 frames ≈ 167ms at 60fps
  switch (encoder) {
    case 'h264_nvenc':
      return [
        '-c:v', 'h264_nvenc',
        '-preset', 'p4',           // P4 = Balanced (Safe for all NVENC GPUs)
        '-tune', 'ull',            // Ultra-low latency
        '-profile:v', 'baseline',  // Mandated for universal Mobile WebRTC support
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', '1000k',       // Small buffer for instant delivery
        '-g', gop,
        '-bf', '0',
        '-rc-lookahead', '0',
        '-zerolatency', '1',
        '-f', 'h264', '-'
      ];
    case 'h264_amf':
      return [
        '-c:v', 'h264_amf',
        '-usage', 'ultlowlatency',
        '-profile:v', 'baseline',  // Mandated for universal Mobile WebRTC support
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', '1000k',
        '-g', gop,
        '-bf', '0',
        '-f', 'h264', '-'
      ];
    case 'h264_qsv':
      return [
        '-c:v', 'h264_qsv',
        '-preset', 'veryfast',
        '-profile:v', 'baseline',  // Mandated for universal Mobile WebRTC support
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', '1000k',
        '-g', gop,
        '-bf', '0',
        '-f', 'h264', '-'
      ];
    default: // libx264 — CPU fallback
      return [
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-profile:v', 'baseline',  // Mandated for universal Mobile WebRTC support
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', '1000k',
        '-g', gop,
        '-x264-params', `keyint=${gop}:bframes=0:aud=1`,
        '-f', 'h264', '-'
      ];
  }
}

/** Probe one encoder with a tiny synthetic test clip. 2s timeout. */
function probeEncoder(ffmpegPath: string, encoder: string): Promise<boolean> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (ok: boolean) => { if (!done) { done = true; resolve(ok); } };
    try {
      const p = spawn(ffmpegPath, [
        '-f', 'lavfi', '-i', 'color=black:s=64x64:r=1:d=0.1',
        '-c:v', encoder, '-f', 'null', '-'
      ]);
      p.on('close', (code) => finish(code === 0));
      p.on('error', () => finish(false));
      setTimeout(() => { try { p.kill(); } catch {} finish(false); }, 2000);
    } catch { finish(false); }
  });
}

/** Detect best available encoder once, cache result.
 *  Always runs in the background — never blocks the UI or a connection. */
async function detectBestEncoder(): Promise<void> {
  if (encoderDetected) return;
  const ffmpegPath = getFFmpegPath();
  log.info('[Host] Probing hardware encoders in background...');
  for (const enc of ['h264_nvenc', 'h264_amf', 'h264_qsv']) {
    const ok = await probeEncoder(ffmpegPath, enc);
    if (ok) {
      detectedEncoder = enc;
      encoderDetected = true;
      log.info(`[Host] Hardware encoder selected: ${enc}`);
      mainWindow?.webContents.send('host:status', `Encoder: ${enc}`);
      return;
    }
  }
  detectedEncoder = 'libx264';
  encoderDetected = true;
  log.info('[Host] Using libx264 (no GPU encoder found).');
}

// --- NAL Scanning ---

/** Simple Annex-B Scanner (Round 4).
 *  Finds 00 00 01 boundaries and returns complete NAL units. */
function drainNALBuffer() {
  let offset = 0;
  while (offset < bufferAccumulator.length - 4) {
    // Check for 3-byte or 4-byte start codes
    const is4 = bufferAccumulator[offset] === 0 && bufferAccumulator[offset + 1] === 0 &&
                bufferAccumulator[offset + 2] === 0 && bufferAccumulator[offset + 3] === 1;
    const is3 = bufferAccumulator[offset] === 0 && bufferAccumulator[offset + 1] === 0 &&
                bufferAccumulator[offset + 2] === 1;

    if (is4 || is3) {
      if (offset > 0) {
        const nalUnit = bufferAccumulator.subarray(0, offset);
        
        // Group SPS/PPS with next IDR for frame atomicity
        let headerIdx = 0;
        while (headerIdx < nalUnit.length && nalUnit[headerIdx] === 0) headerIdx++;
        if (headerIdx < nalUnit.length && nalUnit[headerIdx] === 1) headerIdx++;
        const nalType = (headerIdx < nalUnit.length) ? (nalUnit[headerIdx] & 0x1F) : 0;
        
        const isHeader = (nalType === 7 || nalType === 8 || nalType === 9);
        const isSlice = (nalType === 1 || nalType === 5);

        if ((isHeader || isSlice) && accessUnitBuffer.length > 0 && hasVcl) {
          sendFrame(accessUnitBuffer);
          accessUnitBuffer = Buffer.alloc(0);
          hasVcl = false;
        }

        if (isSlice) hasVcl = true;
        accessUnitBuffer = Buffer.concat([accessUnitBuffer, nalUnit]);
        bufferAccumulator = bufferAccumulator.subarray(offset);
        offset = 0;
        continue;
      }
      offset += (is4 ? 4 : 3);
    } else {
      offset++;
    }
  }
}

// --- Video Handlers ---
function startStreaming() {
  const displays = screen.getAllDisplays();
  const selectedDisplay = displays.find(d => d.id === selectedDisplayId) || screen.getPrimaryDisplay();
  const { width, height } = selectedDisplay.bounds;
  const isPrimary = selectedDisplay.id === screen.getPrimaryDisplay().id;

  log.info(`[Host] Starting stream with encoder: ${detectedEncoder} on display: ${selectedDisplay.id} (${width}x${height})`);
  stopStreaming();

  const ffmpegPath = getFFmpegPath();
  const fps = '60';
  const bitrate = '8000k'; // Stable High quality — 8Mbps

  // --- Capture Logic: Native with GDI Fallback ---
  // If we are on the primary monitor, we can use our optimized DXGI native addon.
  // If we are on a secondary monitor, we fallback to FFmpeg's gdigrab (which is still very fast on Windows).
  const captureArgs = isPrimary ? [
    '-f', 'rawvideo',
    '-pixel_format', 'bgra',
    '-video_size', `${width}x${height}`,
    '-framerate', fps,
    '-i', '-', // feed from stdin
    '-vf', 'scale=min(iw\\,1920):-2:flags=bicubic,format=yuv420p',
  ] : [
    '-f', 'gdigrab',
    '-framerate', fps,
    '-offset_x', `${selectedDisplay.bounds.x}`,
    '-offset_y', `${selectedDisplay.bounds.y}`,
    '-video_size', `${width}x${height}`,
    '-i', 'desktop',
    '-vf', 'scale=min(iw\\,1920):-2:flags=bicubic,format=yuv420p',
  ];

  const encoderArgs = getEncoderArgs(detectedEncoder, bitrate, fps);
  const args = [...captureArgs, ...encoderArgs];

  ffmpegProcess = spawn(ffmpegPath, args);
  bufferAccumulator = Buffer.alloc(0);

  // Capture Loop: Push frames into FFmpeg as fast as possible
  const frameInterval = Math.floor(1000 / parseInt(fps));
  let lastFrameBuffer: Buffer | null = null;

  // Capture an initial frame immediately to fill the buffer
  try {
    const firstFrame = capture.captureFrame();
    if (firstFrame?.data) lastFrameBuffer = Buffer.from(firstFrame.data);
  } catch (e: any) {
    log.warn('[Host] Initial captureFrame failed:', e.message);
  }

  captureInterval = setInterval(() => {
    if (!ffmpegProcess || !ffmpegProcess.stdin?.writable || ffmpegProcess.stdin?.writableEnded) {
      if (captureInterval) { clearInterval(captureInterval); captureInterval = null; }
      return;
    }

    try {
      // Capture a FRESH frame every tick — this is the critical fix
      const result = capture.captureFrame();
      if (result?.data) {
        lastFrameBuffer = Buffer.from(result.data);
      }
    } catch (e: any) {
      // DXGI can miss a frame when screen hasn't changed — reuse last frame
      log.warn('[Host] captureFrame miss, reusing last frame:', e.message);
    }

    if (lastFrameBuffer) {
      try {
        ffmpegProcess.stdin.write(lastFrameBuffer);
      } catch (err: any) {
        log.error('[Host] FFmpeg stdin write failed:', err.message);
        if (captureInterval) { clearInterval(captureInterval); captureInterval = null; }
      }
    }
  }, frameInterval);

  // --- Remote Cursor Metadata Loop ---
  // Broadcasts cursor position independently of the video track for lower latency.
  cursorInterval = setInterval(() => {
    if (!dataChannel || !dataChannel.isOpen()) return;

    try {
      const { x, y } = screen.getCursorScreenPoint();
      // Transform absolute screen coordinates to monitor-relative (0.0 - 1.0)
      const nx = Math.max(0, Math.min(1, (x - selectedDisplay.bounds.x) / selectedDisplay.bounds.width));
      const ny = Math.max(0, Math.min(1, (y - selectedDisplay.bounds.y) / selectedDisplay.bounds.height));
      
      dataChannel.sendMessage(JSON.stringify({ 
        type: 'cursor', 
        x: nx, 
        y: ny, 
        visible: true // We can add more logic here if needed (icon type, etc)
      }));
    } catch (err) {
      // Ignore cursor errors
    }
  }, 33); // ~30fps for metadata is sufficient

  // Silently swallow pipe errors to prevent process crash (dialog error)
  ffmpegProcess.stdin?.on('error', (err) => {
    log.warn(`[Host] FFmpeg stdin encountered a pipe error: ${err.message}`);
    if (captureInterval) { clearInterval(captureInterval); captureInterval = null; }
  });

  ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
    if (isPreBuffering) {
      ffmpegPreChunks.push(chunk);
      return;
    }
    if (!videoTrack) return;
    
    bufferAccumulator = Buffer.concat([bufferAccumulator, chunk]);
    drainNALBuffer();
  });

  ffmpegProcess.stderr?.on('data', (data) => {
    const str = data.toString().trim();
    if (str.includes('kB time=') || str.includes('fps=')) return;
    log.info(`[Host-FFmpeg] ${str}`);
  });

  ffmpegProcess.on('exit', (code, signal) => {
    if (code !== 0 && code !== null && signal !== 'SIGTERM') {
      log.warn(`[Host-FFmpeg] Exited with code ${code}. Restarting in 1s...`);
      setTimeout(() => { if (videoTrack) startStreaming(); }, 1000);
    }
  });
}



function sendFrame(frame: Buffer) {
  if (!videoTrack || !videoRtpConfig || !peerConnection) return;
  
  // Track and Connection MUST be open/connected
  try {
    if (peerConnection.state() !== 'connected') {
      return;
    }

    // Time-based RTP timestamp: 90000 Hz clock relative to stream start
    if (rtpStartTime === 0) rtpStartTime = Date.now();
    currentRtpTimestamp = Math.floor((Date.now() - rtpStartTime) * 90) & 0xFFFFFFFF;
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

  // ── Pre-start FFmpeg BEFORE WebRTC is ready ──────────────────────────────
  // This hides FFmpeg cold-start latency behind the ICE handshake (~200-500ms).
  // Output is buffered until the video track opens, then flushed.
  log.info('[Host] Pre-starting FFmpeg to eliminate cold-start lag...');
  isPreBuffering = true;
  ffmpegPreChunks = [];
  
  // Handover delay to ensure network stack is fully initialized
  setTimeout(() => {
    if (currentViewerId === viewerId) {
      startStreaming();
    }
  }, 200);

  peerConnection = new datachannel.PeerConnection("Host", {
    iceServers: [
      "stun:stun.l.google.com:19302",
      "stun:stun1.l.google.com:19302",
      "stun:stun2.l.google.com:19302",
      "stun:stun3.l.google.com:19302",
      "stun:stun4.l.google.com:19302",
      "stun:stun.freeswitch.org:3478",
      "stun:stun.voiparound.com:3478",
      "stun:stun.voipbuster.com:3478",
      "turn:159.65.84.190:3478?transport=udp",
      "turn:159.65.84.190:3478?transport=tcp"
    ],
    iceTransportPolicy: "all"
  });

  // Set TURN credentials if present
  peerConnection.setToken("admin");
  peerConnection.setSecret("B07qfTNwSC2yZvcs");

  peerConnection.onGatheringStateChange((state: string) => {
    log.info(`[Host] ICE Gathering state: ${state}`);
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
    
    if (state === 'connected') {
      log.info(`[Host] WebRTC connected! Checking pre-buffer status...`);
      if (isPreBuffering) {
        log.info('[Host] Flushing pre-buffered frames to track...');
        isPreBuffering = false;
        if (ffmpegPreChunks.length > 0) {
          const combined = Buffer.concat(ffmpegPreChunks);
          ffmpegPreChunks = [];
          bufferAccumulator = Buffer.concat([bufferAccumulator, combined]);
          drainNALBuffer();
        }
      }
    }
  });

  const video = new datachannel.Video("0", "SendOnly");
  // 42e01f = Baseline profile, which is most compatible with browsers
  video.addH264Codec(96, "profile-level-id=42e01f;level-asymmetry-allowed=1;packetization-mode=1");
  // node-datachannel: (ssrc, cname, payloadType, clockRate)
  videoRtpConfig = new datachannel.RtpPacketizationConfig(1, "video", 96, 90000);
  const packetizer = new datachannel.H264RtpPacketizer("StartSequence", videoRtpConfig);
  
  firstFrameSent = false;
  frameCount = 0;
  lastLogTime = Date.now();
  currentRtpTimestamp = 0;
  rtpStartTime = 0;
  videoTrack = peerConnection.addTrack(video);
  videoTrack.setMediaHandler(packetizer);

  videoTrack.onOpen(() => {
    log.info('[Host] Video track open callback triggered.');
    if (isPreBuffering) {
      isPreBuffering = false;
      if (ffmpegPreChunks.length > 0) {
        const combined = Buffer.concat(ffmpegPreChunks);
        ffmpegPreChunks = [];
        bufferAccumulator = Buffer.concat([bufferAccumulator, combined]);
        drainNALBuffer();
      }
    }
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
      case 'mousemove': 
        input.injectMouseMove(event.x, event.y); 
        break;
      case 'mousedown': case 'mouseup':
        // Sync movement before click to ensure accuracy
        if (event.x !== undefined && event.y !== undefined) {
          input.injectMouseMove(event.x, event.y);
        }
        const btns: any = { 0: 'left', 1: 'middle', 2: 'right' };
        input.injectMouseAction(btns[event.button] || 'left', event.type === 'mousedown' ? 'down' : 'up');
        break;
      case 'wheel':
        input.injectMouseScroll(event.deltaX, event.deltaY);
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
      case 'shortcut':
        if (event.key === 'notifications') {
          // Win + N: Notifications (Windows 11)
          input.injectKeyAction(0x5B, 'down'); // VK_LWIN
          input.injectKeyAction(0x4E, 'down'); // 'N'
          input.injectKeyAction(0x4E, 'up');
          input.injectKeyAction(0x5B, 'up');
        } else if (event.key === 'control-center') {
          // Win + A: Quick Settings (Windows 11)
          input.injectKeyAction(0x5B, 'down'); // VK_LWIN
          input.injectKeyAction(0x41, 'down'); // 'A'
          input.injectKeyAction(0x41, 'up');
          input.injectKeyAction(0x5B, 'up');
        }
        break;
      case 'request-keyframe':
        // Force-inject a keyframe by writing a synthetic IDR request to FFmpeg.
        // Do NOT call startStreaming() — that kills the track and causes the black screen.
        log.info('[Host] Keyframe requested. Forcing IDR on FFmpeg...');
        if (ffmpegProcess?.stdin?.writable) {
          // Sending SIGKILL then restarting is too heavy; instead we
          // rely on low gop=-g10 to deliver a natural IDR within ~167ms.
          // Just log it — the stream is already continuous.
          log.info('[Host] IDR will arrive on next GOP boundary (gop=10).');
        } else {
          // FFmpeg died; safe to restart now
          log.warn('[Host] FFmpeg not running; restarting stream...');
          isPreBuffering = false;
          ffmpegPreChunks = [];
          startStreaming();
        }
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
      // Mobile viewer sends candidate as a flat string; guard for legacy object format
      const candStr: string = typeof data.candidate === 'string'
        ? data.candidate
        : (data.candidate?.candidate ?? '');
      const mid: string = data.sdpMid
        ?? (typeof data.candidate === 'object' ? data.candidate?.sdpMid : null)
        ?? '';
      if (candStr) {
        log.info(`[Host] Received candidate from remote: ${candStr.substring(0, 40)}... (mid: ${mid})`);
        if (hasRemoteDescription) {
          peerConnection?.addRemoteCandidate(candStr, mid);
        } else {
          iceCandidatesQueue.push({ candidate: candStr, mid });
        }
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
  log.warn('[Host] Another instance is already running. Quitting.');
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    log.info('[Host] Second instance detected. Restoring main window.');
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
  log.info('[Host] Starting BrowserWindow construction...');
  try {
    mainWindow = new BrowserWindow({
      width: 1200, height: 800,
      show: false, // Create hidden, then show once content is ready
      webPreferences: { 
        preload: join(__dirname, '../preload/index.js'), 
        contextIsolation: true, 
        sandbox: false 
      }
    });

    mainWindow.once('ready-to-show', () => {
      log.info('[Host] Main window ready to show.');
      mainWindow?.show();
      mainWindow?.focus();
    });
    log.info('[Host] BrowserWindow object created.');

    mainWindow.webContents.on('did-finish-load', () => log.info('[Host] Renderer: did-finish-load'));
    mainWindow.webContents.on('did-fail-load', (e, code, desc) => log.error(`[Host] Renderer: did-fail-load (${code}): ${desc}`));
    mainWindow.webContents.on('crashed', () => log.error('[Host] Renderer process CRASHED'));

    if (process.env.VITE_DEV_SERVER_URL) {
      const url = process.env.VITE_DEV_SERVER_URL.replace('localhost', '127.0.0.1');
      log.info(`[Host] Loading URL: ${url}`);
      mainWindow.loadURL(url).catch(e => log.error(`[Host] loadURL failed: ${e.message}`));
    } else {
      log.info('[Host] Loading local production file...');
      mainWindow.loadFile(join(__dirname, '../../dist/index.html')).catch(e => log.error(`[Host] loadFile failed: ${e.message}`));
    }
  } catch (err: any) {
    log.error(`[Host] CRITICAL ERROR in createWindow: ${err.message}\n${err.stack}`);
  }
}

process.on('uncaughtException', (err) => {
  log.error(`[Host] UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('[Host] UNHANDLED REJECTION:', reason);
});

app.whenReady().then(() => {
  log.info('[Host] App is ready. Initializing subsystems...');
  
  // Force auto-launch for seamless reconnects on restart
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: false, // Could be true if we wanted it silent
      path: app.getPath('exe')
    });
  }
  
  // Initialize paths that require app to be ready
  AUTH_STORE_PATH = join(app.getPath('userData'), 'connectx_auth.json');
  log.info(`[Host] Auth store path: ${AUTH_STORE_PATH}`);

  createWindow();
  startStatsMonitoring();

  // Detect best video encoder in background so it's ready before first connection
  detectBestEncoder().catch((err) => log.warn('[Host] Encoder detection failed:', err));

  // Handle startup deep link: when the app was launched fresh by a remotelink:// URL
  const startupUrl = process.argv.find((a) => a.startsWith(`${PROTOCOL}://`));
  if (startupUrl) {
    mainWindow?.webContents.once('did-finish-load', () => {
       log.info(`[Host] Processing startup deep link: ${startupUrl}`);
       handleDeepLink(startupUrl);
    });
  }
});

ipcMain.handle('host:save-file-locally', async (_event, name: string, data: Uint8Array) => {
  const downloadsPath = app.getPath('downloads');
  const filePath = join(downloadsPath, name);
  await fs.writeFile(filePath, Buffer.from(data));
  return filePath;
});

ipcMain.handle('system:getHistory', async () => {
    try {
        const path = join(app.getPath('userData'), 'connectx_history.json');
        const data = await fs.readFile(path, 'utf-8');
        return JSON.parse(data);
    } catch {
        return [];
    }
});

ipcMain.handle('system:saveHistory', async (_event, history: any[]) => {
    try {
        const path = join(app.getPath('userData'), 'connectx_history.json');
        await fs.writeFile(path, JSON.stringify(history));
        return true;
    } catch {
        return false;
    }
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

// window-all-closed handler

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
      // Handle ping/pong at the main-process level so the signaling server
      // doesn't terminate the socket for missed heartbeats.
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
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

