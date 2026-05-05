import { app, shell, dialog, BrowserWindow, ipcMain, safeStorage, clipboard, screen, Notification, session, Menu, Tray, desktopCapturer } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import { join, basename, resolve } from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import { WebSocket } from 'ws';
import * as os from 'os';
import * as datachannel from 'node-datachannel';
import * as input from '@remotelink/native-input';
import * as crypto from 'crypto';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// Disable Hardware Acceleration for desktop host window to ensure
// it remains visible and controllable via DXGI capture.
app.name = 'Remote 365';
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

const PROTOCOL = 'remotelink';
let AUTH_STORE_PATH: string;

// --- State Management ---
let mainWindow: BrowserWindow | null = null;
let hostSignalingWs: WebSocket | null = null;
const viewerWindows = new Map<string, BrowserWindow>();
const viewerSignalingSockets = new Map<string, WebSocket>();
const meetingWindows = new Map<string, BrowserWindow>();
let tray: Tray | null = null;
let isQuitting = false;
let shownTrayHint = false;

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
let isManualHostStop = false;
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
let initPollInterval: NodeJS.Timeout | null = null;
let controlGranted = false;
let pendingControlViewerId: string | null = null;
let hostStreamSettings = {
  quality: 'balanced',
  fps: '60',
  deviceName: '',
};

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
      const valid = list.find((i: any) => !i.internal && i.mac !== '00:00:00:00:00:00');
      if (valid) { mac = valid.mac; break; }
    }
  }
  if (!mac) mac = os.hostname();
  const hash = crypto.createHash('sha256').update(mac).digest('hex');
  return (BigInt('0x' + hash.substring(0, 12)) % 1000000000n).toString().padStart(9, '0');
});

// --- Auto-Updater Handlers ---
const UPDATE_FEED_URL = process.env.CONNECT_X_UPDATE_URL || 'http://159.65.84.190/downloads/desktop/';
autoUpdater.autoDownload = false; // We want to notify first
autoUpdater.logger = log;
autoUpdater.setFeedURL({
  provider: 'generic',
  url: UPDATE_FEED_URL
});

const isMissingUpdateManifest = (err: any) => {
  const message = String(err?.message || err || '');
  return message.includes('latest.yml') && (message.includes('404') || message.includes('Not Found'));
};

let updateCheckInFlight = false;
let updateCheckInterval: NodeJS.Timeout | null = null;

async function checkForDesktopUpdates() {
  if (updateCheckInFlight) return null;
  updateCheckInFlight = true;
  try {
    return await autoUpdater.checkForUpdates();
  } finally {
    updateCheckInFlight = false;
  }
}

ipcMain.handle('update:check', async () => {
  try {
    return await checkForDesktopUpdates();
  } catch (err) {
    if (isMissingUpdateManifest(err)) {
      log.warn('[Updater] No latest.yml manifest is published yet. Skipping update banner.');
      return null;
    }
    throw err;
  }
});
ipcMain.handle('update:download', () => autoUpdater.downloadUpdate());
ipcMain.handle('update:quitAndInstall', () => autoUpdater.quitAndInstall());

autoUpdater.on('update-available', (info: any) => {
  log.info('[Updater] Update available:', info.version);
  mainWindow?.webContents.send('update:available', info);
});

autoUpdater.on('update-not-available', (info: any) => {
  log.info('[Updater] Update not available:', info.version);
  mainWindow?.webContents.send('update:not-available');
});

autoUpdater.on('download-progress', (progressObj: any) => {
  mainWindow?.webContents.send('update:download-progress', progressObj);
});

autoUpdater.on('update-downloaded', (info: any) => {
  log.info('[Updater] Update downloaded:', info.version);
  mainWindow?.webContents.send('update:downloaded', info);
});

autoUpdater.on('error', (err: any) => {
  if (isMissingUpdateManifest(err)) {
    log.warn('[Updater] No update manifest found at feed URL.');
    return;
  }
  log.error('[Updater] Error:', err);
  mainWindow?.webContents.send('update:error', 'Unable to check for updates right now.');
});

ipcMain.handle('system:getMachineName', () => os.hostname());
ipcMain.handle('system:isPackaged', () => app.isPackaged);
ipcMain.handle('system:openPath', (_event: any, path: any) => shell.openPath(path));
ipcMain.handle('system:log', (_event: any, msg: any, level: any) => {
  const l = level as 'info' | 'warn' | 'error';
  (log as any)[l]?.(msg);
});

function minimizeHostWindowForRemoteSession(reason: string) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) return;
  log.info(`[Host] Minimizing host window for remote session: ${reason}`);
  mainWindow.minimize();
}

ipcMain.handle('auth:getToken', () => getAuthTokens());
ipcMain.handle('auth:setToken', (_event: any, t: any, r: any) => setAuthTokens(t, r));
ipcMain.handle('auth:deleteToken', () => fs.unlink(AUTH_STORE_PATH).then(() => true).catch(() => false));
ipcMain.handle('shell:openExternal', (_event: any, url: any) => shell.openExternal(url));
ipcMain.handle('host:getStatus', async () => {
  if (hostSignalingWs && hostSignalingWs.readyState === 1) return { status: 'status', sessionId: currentHostSessionId };
  return { status: 'idle' };
});
ipcMain.handle('host:start', async (_: any, accessKey: any, settings: any = {}) => {
  const { token } = await getAuthTokens();
  const serverIP = process.env.CONNECT_X_SERVER_IP || '159.65.84.190';
  hostStreamSettings = {
    quality: ['smooth', 'balanced', 'sharp'].includes(settings?.quality) ? settings.quality : 'balanced',
    fps: ['15', '30', '60'].includes(String(settings?.fps)) ? String(settings.fps) : '60',
    deviceName: String(settings?.deviceName || '').trim(),
  };

  // Ensure encoder is detected before starting host signaling
  if (!encoderDetected) await detectBestEncoder();

  isManualHostStop = false;
  connectHostSignaling(serverIP, token || '', accessKey || '');
  return true;

});
ipcMain.handle('host:stop', () => {
  isManualHostStop = true;
  cleanUpWebRTC();
  hostSignalingWs?.close();
  return true;
});

ipcMain.on('host:approve-viewer', (_event: any, viewerId: string) => {
  if (hostSignalingWs?.readyState === WebSocket.OPEN) {
    hostSignalingWs.send(JSON.stringify({ type: 'join-approve', viewerId }));
    minimizeHostWindowForRemoteSession('viewer-approved');
  }
});

ipcMain.on('host:deny-viewer', (_event: any, viewerId: string) => {
  if (hostSignalingWs?.readyState === WebSocket.OPEN) {
    hostSignalingWs.send(JSON.stringify({ type: 'join-deny', viewerId }));
  }
});

ipcMain.on('host:approve-control', (_event: any, viewerId: string) => {
  if (viewerId !== currentViewerId && viewerId !== pendingControlViewerId) return;
  controlGranted = true;
  pendingControlViewerId = null;
  minimizeHostWindowForRemoteSession('control-approved');
  if (dataChannel && dataChannel.isOpen()) {
    dataChannel.sendMessage(JSON.stringify({ type: 'control-granted' }));
  }
});

ipcMain.on('host:deny-control', (_event: any, viewerId: string) => {
  if (viewerId !== currentViewerId && viewerId !== pendingControlViewerId) return;
  controlGranted = false;
  pendingControlViewerId = null;
  if (dataChannel && dataChannel.isOpen()) {
    dataChannel.sendMessage(JSON.stringify({ type: 'control-denied' }));
  }
});

ipcMain.handle('host:get-screens', () => {
  const displays = screen.getAllDisplays();
  return displays.map((d: any) => ({
    id: d.id,
    label: `${d.label || 'Display'} (${d.bounds.width}x${d.bounds.height})`,
    bounds: d.bounds
  }));
});

ipcMain.handle('host:set-capture-screen', (_: any, displayId: any) => {
  log.info(`[Host] Switching capture screen to: ${displayId}`);
  selectedDisplayId = displayId;
  if (videoTrack && peerConnection?.state() === 'connected') {
    startStreaming();
  }
  return true;
});
ipcMain.handle('clipboard:readText', () => clipboard.readText());
ipcMain.handle('clipboard:writeText', (_event: any, text: any) => {
  const value = String(text ?? '');
  lastClipboardText = value;
  clipboard.writeText(value);
  return true;
});
ipcMain.handle('viewer:open-window', (_event: any, sessionId: any, serverIP: any, token: any, deviceName: any, deviceType: any) => {
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

  // Allow inception to be naturally prevented by auto-hiding the host window

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

function openMeetingWindow(meetingId: any) {
  const cleanMeetingId = String(meetingId || '').replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
  if (!cleanMeetingId) return false;

  if (meetingWindows.has(cleanMeetingId)) {
    const existing = meetingWindows.get(cleanMeetingId);
    if (existing && !existing.isDestroyed()) {
      existing.show();
      existing.focus();
      return true;
    }
  }

  const meetingWin = new BrowserWindow({
    width: 1280,
    height: 760,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#050505',
    title: `Remote 365 Meeting ${cleanMeetingId}`,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      sandbox: true
    }
  });

  const query = `?view=meeting&meetingId=${encodeURIComponent(cleanMeetingId)}`;
  if (process.env.VITE_DEV_SERVER_URL) {
    meetingWin.loadURL(`${process.env.VITE_DEV_SERVER_URL}${query}`);
  } else {
    meetingWin.loadFile(join(__dirname, '../../dist/index.html'), {
      query: { view: 'meeting', meetingId: cleanMeetingId }
    });
  }

  meetingWin.on('closed', () => meetingWindows.delete(cleanMeetingId));
  meetingWindows.set(cleanMeetingId, meetingWin);
  return true;
}

ipcMain.handle('meeting:open-window', (_event: any, meetingId: any) => openMeetingWindow(meetingId));

ipcMain.handle('viewer:connect', async (_event: any, sessionId: any, serverIP: any, token: any, viewerClientId: any) => {
  log.info(`[Viewer] Connecting to session: ${sessionId} at ${serverIP}`);
  connectViewerSignaling(sessionId, serverIP || '159.65.84.190', token || '', viewerClientId);
  return true;
});

ipcMain.on('viewer:send-signaling', (_event: any, msg: any) => {
  const sessionId = msg.sessionId || msg.targetId;
  if (!sessionId) return;
  const ws = viewerSignalingSockets.get(sessionId);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
});
// --- Utility Functions ---
const getFFmpegPath = () => {
  if (app.isPackaged) return join(process.resourcesPath, 'ffmpeg.exe');
  
  // Dev mode: try common monorepo and local paths
  const paths = [
    join(app.getAppPath(), '../../node_modules/ffmpeg-static/ffmpeg.exe'),
    join(app.getAppPath(), 'node_modules/ffmpeg-static/ffmpeg.exe'),
  ];
  
  const fs = require('fs');
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }

  // Fallback to module resolution
  try {
    const staticPath = require('ffmpeg-static');
    if (staticPath && fs.existsSync(staticPath)) return staticPath;
  } catch (e) {}

  return 'ffmpeg'; // System PATH fallback
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

  if (dataChannel) {
    try {
      // Ensure we only close if still open to avoid native crashes
      if (typeof dataChannel.close === 'function') dataChannel.close();
    } catch (err) {
      log.warn('[Host] Error closing dataChannel:', err);
    }
    dataChannel = null;
  }

  if (videoTrack) {
    try {
      if (typeof videoTrack.close === 'function') videoTrack.close();
    } catch (err) {
      log.warn('[Host] Error closing videoTrack:', err);
    }
    videoTrack = null;
  }

  if (peerConnection) {
    try {
      if (typeof peerConnection.close === 'function') peerConnection.close();
    } catch (err) {
      log.warn('[Host] Error closing peerConnection:', err);
    }
    peerConnection = null;
  }

  iceCandidatesQueue = [];
  hasRemoteDescription = false;
  currentViewerId = null;
  controlGranted = false;
  pendingControlViewerId = null;
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
  if (initPollInterval) {
    clearInterval(initPollInterval);
    initPollInterval = null;
  }
}

// --- Encoder Detection ---

/** Build encoder-specific FFmpeg args for low-latency, high-quality streaming.
 *  ALL encoders must emit AUD NAL units so the frame splitter works correctly. */
function getEncoderArgs(encoder: string, bitrate: string, fps: string): string[] {
  const bitrateKbps = parseInt(bitrate, 10) || 6500;
  const bufferSize = `${Math.max(1500, Math.round(bitrateKbps * 0.75))}k`;
  const gop = String(Math.max(10, Math.round((parseInt(fps, 10) || 60) / 2)));
  switch (encoder) {
    case 'h264_nvenc':
      return [
        '-c:v', 'h264_nvenc',
        '-preset', 'p4',           // P4 = Balanced (Safe for all NVENC GPUs)
        '-tune', 'ull',            // Ultra-low latency
        '-profile:v', 'baseline',
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', bufferSize,
        '-g', gop,
        '-bf', '0',
        '-rc-lookahead', '0',
        '-zerolatency', '1',
        // dump_extra forces SPS+PPS before every IDR so the browser decoder can always init
        '-bsf:v', 'dump_extra,h264_metadata=aud=insert',
        '-f', 'h264', '-'
      ];
    case 'h264_amf':
      return [
        '-c:v', 'h264_amf',
        '-usage', 'ultlowlatency',
        '-profile:v', 'baseline',
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', bufferSize,
        '-g', gop,
        '-bf', '0',
        '-bsf:v', 'dump_extra,h264_metadata=aud=insert',
        '-f', 'h264', '-'
      ];
    case 'h264_qsv':
      return [
        '-c:v', 'h264_qsv',
        '-preset', 'veryfast',
        '-profile:v', 'baseline',
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', bufferSize,
        '-g', gop,
        '-bf', '0',
        '-bsf:v', 'dump_extra,h264_metadata=aud=insert',
        '-f', 'h264', '-'
      ];
    default: // libx264 â€” CPU fallback
      return [
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-tune', 'zerolatency',
        '-profile:v', 'baseline',
        '-b:v', bitrate,
        '-maxrate', bitrate,
        '-bufsize', bufferSize,
        '-g', gop,
        '-x264-params', `keyint=${gop}:bframes=0:aud=1`,
        '-bsf:v', 'dump_extra',
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
      p.on('close', (code: any) => finish(code === 0));
      p.on('error', () => finish(false));
      setTimeout(() => { try { p.kill(); } catch { } finish(false); }, 2000);
    } catch { finish(false); }
  });
}

/** Detect best available encoder once, cache result.
 *  Always runs in the background â€” never blocks the UI or a connection. */
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
let flushTimeout: NodeJS.Timeout | null = null;

function drainNALBuffer() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  while (true) {
    // Find next Annex-B start code (00 00 01)
    const syncPos = bufferAccumulator.indexOf(Buffer.from([0, 0, 1]), 1);
    if (syncPos === -1) {
      // No more complete NAL units in this chunk.
      // If we have a pending Access Unit that already has a VCL slice (a frame),
      // set a timeout to flush it proactively if no new data arrives soon.
      // This ensures the VERY first frame is sent even if FFmpeg hasn't started the second one yet.
      if (accessUnitBuffer.length > 0 && hasVcl) {
        flushTimeout = setTimeout(() => {
          if (accessUnitBuffer.length > 0 && hasVcl) {
            sendFrame(accessUnitBuffer);
            accessUnitBuffer = Buffer.alloc(0);
            hasVcl = false;
          }
        }, 100);
      }
      break;
    }

    let nalUnitEnd = syncPos;
    // Adjust for 4-byte start code (00 00 00 01)
    if (syncPos > 0 && bufferAccumulator[syncPos - 1] === 0) {
      nalUnitEnd--;
    }

    if (nalUnitEnd > 0) {
      const nalUnit = bufferAccumulator.subarray(0, nalUnitEnd);
      
      // Parse NAL type
      let headerIdx = 0;
      while (headerIdx < nalUnit.length && nalUnit[headerIdx] === 0) headerIdx++;
      if (headerIdx < nalUnit.length && nalUnit[headerIdx] === 1) headerIdx++;
      const nalType = (headerIdx < nalUnit.length) ? (nalUnit[headerIdx] & 0x1F) : 0;

      const isNewFrame = (nalType === 9 || nalType === 7); // AUD or SPS
      const isSlice = (nalType === 1 || nalType === 5); // VCL slices

      if (isNewFrame && accessUnitBuffer.length > 0 && hasVcl) {
        sendFrame(accessUnitBuffer);
        accessUnitBuffer = Buffer.alloc(0);
        hasVcl = false;
      }

      if (isSlice) hasVcl = true;
      accessUnitBuffer = Buffer.concat([accessUnitBuffer, nalUnit]);
    }

    bufferAccumulator = bufferAccumulator.subarray(syncPos);
  }
}

// --- Video Handlers ---
function startStreaming() {
  const displays = screen.getAllDisplays();
  const selectedDisplay = displays.find((d: any) => d.id === selectedDisplayId) || screen.getPrimaryDisplay();
  const { width, height } = selectedDisplay.bounds;
  const isPrimary = selectedDisplay.id === screen.getPrimaryDisplay().id;

  log.info(`[Host] Starting stream with encoder: ${detectedEncoder} on display: ${selectedDisplay.id} (${width}x${height})`);
  stopStreaming();

  const ffmpegPath = getFFmpegPath();
  const qualityPresets: Record<string, { bitrate: string; maxWidth: string }> = {
    smooth: { bitrate: '4500k', maxWidth: '1600' },
    balanced: { bitrate: '9000k', maxWidth: '2560' },
    sharp: { bitrate: '14000k', maxWidth: '3840' },
  };
  const preset = qualityPresets[hostStreamSettings.quality] || qualityPresets.balanced;
  const fps = process.env.REMOTE365_STREAM_FPS || hostStreamSettings.fps || '60';
  const bitrate = process.env.REMOTE365_STREAM_BITRATE || preset.bitrate;
  const maxWidth = process.env.REMOTE365_STREAM_MAX_WIDTH || preset.maxWidth;
  const frameInterval = Math.max(8, Math.round(1000 / (parseInt(fps, 10) || 60)));

  initPollInterval = setInterval(() => {
    let physWidth = Math.round(width * selectedDisplay.scaleFactor);
    let physHeight = Math.round(height * selectedDisplay.scaleFactor);
    let firstFrameBuffer: Buffer | null = null;

    if (isPrimary) {
      try {
        const probe = capture.captureFrame();
        if (probe && probe.width && probe.height && probe.data) {
          physWidth = probe.width;
          physHeight = probe.height;
          firstFrameBuffer = Buffer.from(probe.data);
        } else {
          return; // Screen hasn't composited yet, wait a tick!
        }
      } catch (e) { return; }
    }

    // Got a frame! Stop polling and start the encoder
    if (initPollInterval) clearInterval(initPollInterval);

    log.info(`[Host] Frame acquired. Locking bounds at: ${physWidth}x${physHeight} (Scale: ${selectedDisplay.scaleFactor})`);

    const captureArgs = isPrimary ? [
      '-f', 'rawvideo',
      '-pixel_format', 'bgra',
      '-video_size', `${physWidth}x${physHeight}`,
      '-framerate', fps,
      '-i', '-', // feed from stdin
      // Fix: Use bitwise AND or explicit trunc for 16-pixel macroblock alignment without circular 'oh' references.
      // This enforces width=multiple of 16 and height=multiple of 16 to satisfy complex HW encoders on laptops.
      '-vf', `scale=w=trunc(min(iw\\,${maxWidth})/16)*16:h=trunc(ih*min(1\\,${maxWidth}/iw)/16)*16,format=yuv420p`,
    ] : [
      '-f', 'gdigrab',
      '-framerate', fps,
      '-offset_x', `${Math.round(selectedDisplay.bounds.x * selectedDisplay.scaleFactor)}`,
      '-offset_y', `${Math.round(selectedDisplay.bounds.y * selectedDisplay.scaleFactor)}`,
      '-video_size', `${physWidth}x${physHeight}`,
      '-i', 'desktop',
      // High-performance scaling with 16-pixel macroblock alignment for both axes.
      '-vf', `scale=w=trunc(min(iw\\,${maxWidth})/16)*16:h=trunc(ih*min(1\\,${maxWidth}/iw)/16)*16,format=yuv420p`,
    ];

    const encoderArgs = getEncoderArgs(detectedEncoder, bitrate, fps);
    const args = [...captureArgs, ...encoderArgs];

    ffmpegProcess = spawn(ffmpegPath, args);
    ffmpegProcess.on('error', (err) => {
      log.error(`[Host] FFmpeg failed to start: ${err.message}`);
      stopStreaming();
    });
    bufferAccumulator = Buffer.alloc(0);

    // Capture Loop
    let lastFrameBuffer: Buffer | null = firstFrameBuffer;

    captureInterval = setInterval(() => {
      if (!ffmpegProcess || !ffmpegProcess.stdin?.writable || ffmpegProcess.stdin?.writableEnded) {
        if (captureInterval) { clearInterval(captureInterval); captureInterval = null; }
        return;
      }

      try {
        const result = capture.captureFrame();
        if (result?.data) lastFrameBuffer = Buffer.from(result.data);
      } catch (e: any) {
        // Reuse frame
      }

      if (lastFrameBuffer && (ffmpegProcess.stdin.writableLength || 0) < lastFrameBuffer.length * 2) {
        try { ffmpegProcess.stdin.write(lastFrameBuffer); }
        catch (err: any) { if (captureInterval) { clearInterval(captureInterval); captureInterval = null; } }
      }
    }, frameInterval);

    // --- Remote Cursor Metadata Loop ---
    cursorInterval = setInterval(() => {
      if (!dataChannel || !dataChannel.isOpen()) return;
      try {
        const { x, y } = screen.getCursorScreenPoint();
        const nx = Math.max(0, Math.min(1, (x - selectedDisplay.bounds.x) / selectedDisplay.bounds.width));
        const ny = Math.max(0, Math.min(1, (y - selectedDisplay.bounds.y) / selectedDisplay.bounds.height));
        dataChannel.sendMessage(JSON.stringify({ type: 'cursor', x: nx, y: ny, visible: true }));
      } catch (err) { }
    }, 16);

    ffmpegProcess.stdin?.on('error', (err: any) => {
      if (captureInterval) { clearInterval(captureInterval); captureInterval = null; }
    });

    ffmpegProcess.stdout?.on('data', (chunk: Buffer) => {
      bufferAccumulator = Buffer.concat([bufferAccumulator, chunk]);
      drainNALBuffer();
    });

    ffmpegProcess.stderr?.on('data', (data: any) => {
      const str = data.toString().trim();
      if (!str.includes('kB time=') && !str.includes('fps=')) log.info(`[Host-FFmpeg] ${str}`);
    });

    ffmpegProcess.on('exit', (code: any, signal: any) => {
      if (code !== 0 && code !== null && signal !== 'SIGTERM') {
        log.warn(`[Host-FFmpeg] Exited with code ${code}. Restarting in 1s...`);
        setTimeout(() => { if (videoTrack) startStreaming(); }, 1000);
      }
    });

  }, 10); // Check every 10ms until first frame is acquired
}



function sendFrame(frame: Buffer) {
  if (isPreBuffering) {
    ffmpegPreChunks.push(frame);
    if (ffmpegPreChunks.length > 120) ffmpegPreChunks.shift();
    return;
  }

  if (!videoTrack || !videoRtpConfig || !peerConnection) {
    return;
  }

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

function flushPreBuffer() {
  if (!isPreBuffering) return;
  log.info(`[Host] Flushing ${ffmpegPreChunks.length} pre-buffered frames to track...`);
  isPreBuffering = false;
  
  const chunks = [...ffmpegPreChunks];
  ffmpegPreChunks = [];
  
  for (const chunk of chunks) {
    sendFrame(chunk);
  }
}

// --- WebRTC Logic ---
function initiateHostWebRTC(viewerId: string) {
  log.info(`[Host] Initializing session for: ${viewerId}`);
  cleanUpWebRTC();
  currentViewerId = viewerId;

  // â”€â”€ Pre-start FFmpeg BEFORE WebRTC is ready â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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

  // Simplified ICE Servers for stability. 
  // Custom RelayType objects in libdatachannel can cause 0xC0000005 if types mismatch.
  const iceServers: datachannel.IceServer[] = [
    { hostname: "stun.l.google.com", port: 19302 },
    { hostname: "stun1.l.google.com", port: 19302 },
    { hostname: "159.65.84.190", port: 3478, username: "admin", password: "B07qfTNwSC2yZvcs", relayType: "TurnUdp" },
    { hostname: "159.65.84.190", port: 3478, username: "admin", password: "B07qfTNwSC2yZvcs", relayType: "TurnTcp" }
  ];

  peerConnection = new datachannel.PeerConnection("Host", {
    iceServers: iceServers,
    iceTransportPolicy: "all"
  });




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
      log.info(`[Host] WebRTC connected! Session active.`);

      // Prevent "Inception" infinite recursion naturally by hiding the Host UI
      if (mainWindow && !mainWindow.isDestroyed()) {
        minimizeHostWindowForRemoteSession('webrtc-connected');
      }

      if (isPreBuffering) {
        flushPreBuffer();
      }
    } else if (state === 'disconnected' || state === 'failed' || state === 'closed') {
      log.warn(`[Host] Remote session ended (${state}). Triggering cleanup...`);
      cleanUpWebRTC();

      // Restore the Dashboard UI naturally
      if (mainWindow && !mainWindow.isDestroyed()) {
        log.info('[Host] Restoring Host window after session close.');
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.focus();
      }
    }
  });

  const video = new datachannel.Video("0", "SendOnly");
  // 42e01f = Constrained Baseline L3.1 — required by node-datachannel's RTP sender
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
    // Only flush pre-buffer if the peer connection is already 'connected'.
    // If not, leave isPreBuffering=true so onStateChange('connected') handles it —
    // prevents sendFrame() from silently dropping the first SPS+PPS+IDR due to the
    // state check inside sendFrame.
    if (isPreBuffering && peerConnection?.state() === 'connected') {
      flushPreBuffer();
    }
  });

  // Adding DataChannel AFTER the Media Track ensures `node-datachannel`'s implicit asynchronous SDP generator packages BOTH into the singular Offer.
  dataChannel = peerConnection.createDataChannel("control");
  dataChannel.onOpen(() => {
    log.info('[Host] Control DataChannel open. Starting Heartbeat & Clipboard loops...');
    controlGranted = true;
    pendingControlViewerId = null;
    dataChannel.sendMessage(JSON.stringify({ type: 'control-granted' }));
    minimizeHostWindowForRemoteSession('control-channel-open');

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
    log.info(`[Host] Initialized clipboard sync. Current text length: ${lastClipboardText?.length || 0}`);

    clipboardInterval = setInterval(() => {
      try {
        if (!dataChannel || !dataChannel.isOpen()) return;
        const text = clipboard.readText();
        if (text && text !== lastClipboardText) {
          lastClipboardText = text;
          log.info(`[Host] Local clipboard changed. Syncing to viewer... (${text.substring(0, 20)}...)`);
          dataChannel.sendMessage(JSON.stringify({ type: 'clipboard', text }));
        }
      } catch (err: any) {
        log.error(`[Host] Clipboard poll failed: ${err.message}`);
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
      if (!controlGranted) {
        log.warn('[Host] Ignoring file transfer because viewer does not have control.');
        return;
      }
      const view = new DataView(msg.buffer, msg.byteOffset, 4);
      const headerLen = view.getUint32(0, true);
      const headerStr = msg.slice(4, 4 + headerLen).toString();
      const header = JSON.parse(headerStr);
      const chunk = msg.slice(4 + headerLen);

      if (header.type === 'file-chunk') {
        log.info(`[Diagnostic] Reassembler: Received chunk ${header.chunkIndex + 1}/${header.totalChunks} for ${header.name}`);
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
          }).catch((err: any) => {
            log.error(`[Host] Failed to write file: ${err.message}`);
          });
          fileTransfers.delete(header.name);
        }
      }
      return;
    }

    // 2. Handle JSON Commands
    const event = JSON.parse(msg.toString());

    if (event.type === 'request-control') {
      pendingControlViewerId = currentViewerId;
      mainWindow?.webContents.send('host:control-request', {
        viewerId: currentViewerId,
        requestedAt: Date.now()
      });
      if (dataChannel && dataChannel.isOpen()) {
        dataChannel.sendMessage(JSON.stringify({ type: 'control-pending' }));
      }
      return;
    }

    const requiresControl = !['ping', 'request-keyframe'].includes(event.type);
    if (requiresControl && !controlGranted) {
      if (dataChannel && dataChannel.isOpen()) {
        dataChannel.sendMessage(JSON.stringify({ type: 'control-denied' }));
      }
      return;
    }

    switch (event.type) {
      case 'mousemove':
        {
          const point = mapRemotePointToVirtualDesktop(event.x, event.y);
          input.injectMouseMove(point.x, point.y);
        }
        break;
      case 'mousedown': case 'mouseup':
        // Sync movement before click to ensure accuracy
        if (event.x !== undefined && event.y !== undefined) {
          const point = mapRemotePointToVirtualDesktop(event.x, event.y);
          input.injectMouseMove(point.x, point.y);
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
        // Do NOT call startStreaming() â€” that kills the track and causes the black screen.
        log.info('[Host] Keyframe requested. Forcing IDR on FFmpeg...');
        if (ffmpegProcess?.stdin?.writable) {
          // Sending SIGKILL then restarting is too heavy; instead we
          // rely on low gop=-g10 to deliver a natural IDR within ~167ms.
          // Just log it â€” the stream is already continuous.
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
  } catch { }
}

// --- Signaling & App Setup ---
function setupSignalingHandlers(ws: WebSocket) {
  ws.on('message', (message: any) => {
    const data = JSON.parse(message.toString());
    if (data.type === 'registered') {
      currentHostSessionId = data.sessionId;
      mainWindow?.webContents.send('host:status', `Online: ${data.sessionId}`);
    } else if (data.type === 'registration-error') {
      log.error(`[Host] Registration denied: ${data.error}`);
      mainWindow?.webContents.send('host:status', 'error');
    } else if (data.type === 'viewer-request') {
      // Forward the approval dialog request to the renderer
      mainWindow?.webContents.send('host:viewer-request', {
        viewerId: data.viewerId,
        viewerClientId: data.viewerClientId,
      });
    } else if (data.type === 'viewer-request-cancelled') {
      mainWindow?.webContents.send('host:viewer-request-cancelled', { viewerId: data.viewerId });
    } else if (data.type === 'viewer-joined' || data.type === 'request-offer') {
      const viewerId = data.viewerId || data.senderId;
      const now = Date.now();

      // Debounce frequent join requests to prevent signaling loops
      if (viewerId === lastViewerJoinId && (now - lastViewerJoinTime) < 500) {
        log.info(`[Host] Ignoring duplicate join request for: ${viewerId}`);
        return;
      }

      lastViewerJoinId = viewerId;
      lastViewerJoinTime = now;
      minimizeHostWindowForRemoteSession('viewer-joined');
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
    } else if (data.type === 'viewer-left') {
      log.info(`[Host] Viewer ${data.viewerId} left. Cleaning up...`);
      cleanUpWebRTC();
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
    if (!isReconnectScheduled && !isManualHostStop) {
      isReconnectScheduled = true;
      log.info('[Host] Scheduling reconnection in 5 seconds...');
      setTimeout(() => {
        isReconnectScheduled = false; // Allow new schedules if this one fails
        if (!isManualHostStop && (!hostSignalingWs || hostSignalingWs.readyState !== WebSocket.OPEN)) {
          log.info('[Host] Retrying connection...');
          connectHostSignaling(serverIP, token, accessKey);
        }
      }, 5000);
    }
  });

  hostSignalingWs.on('error', (err: any) => {
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
    if (parsed.host === 'onboard') {
      const token = parsed.searchParams.get('token');
      if (token) {
        log.info('[DeepLink] Received onboarding token:', token);
        mainWindow?.webContents.send('auth:onboarding-token', token);
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }

    if (parsed.host === 'join') {
      const code = parsed.searchParams.get('code');
      const password = parsed.searchParams.get('password') || '';
      if (code) {
        log.info('[DeepLink] Received session join link:', code);
        mainWindow?.webContents.send('session:join-link', { code, password });
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }

    if (parsed.host === 'meeting') {
      const code = parsed.searchParams.get('code');
      if (code) {
        log.info('[DeepLink] Received meeting join link:', code);
        openMeetingWindow(code);
      }
    }

    if (parsed.host === 'auth' && parsed.pathname === '/callback') {
      const accessToken = parsed.searchParams.get('accessToken');
      const refreshToken = parsed.searchParams.get('refreshToken');
      if (accessToken && refreshToken) {
        setAuthTokens(accessToken, refreshToken).then(() => {
          mainWindow?.webContents.send('auth:deep-link-success', { accessToken, refreshToken });
        });
      }
    }

    if (parsed.host === 'auth' && parsed.pathname === '/2fa') {
      const tempToken = parsed.searchParams.get('tempToken');
      if (tempToken) {
        log.info('[DeepLink] Received 2FA temp token');
        mainWindow?.webContents.send('auth:temp-2fa-token', tempToken);
        if (mainWindow) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        }
      }
    }
  } catch (e) {
    log.error('[DeepLink] Failed to parse URL:', e);
  }
}

// macOS: register open-url before whenReady
app.on('open-url', (event: any, url: any) => {
  event.preventDefault();
  handleDeepLink(url);
});

// Register custom protocol & single-instance lock (Windows / Linux deep links)
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL, process.execPath, [resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(PROTOCOL);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  log.warn('[Host] Another instance is already running. Quitting.');
  app.quit();
  process.exit(0);
} else {
  app.on('second-instance', (_event: any, argv: any) => {
    log.info('[Host] Second instance detected. Restoring main window.');
    // The deep-link URL is the last element on Windows
    const url = argv.find((a: any) => a.startsWith(`${PROTOCOL}://`));
    if (url) handleDeepLink(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

function mapRemotePointToVirtualDesktop(x: number, y: number) {
  const displays = screen.getAllDisplays();
  const selectedDisplay = displays.find((d: any) => d.id === selectedDisplayId) || screen.getPrimaryDisplay();
  const virtualLeft = Math.min(...displays.map((display: any) => display.bounds.x));
  const virtualTop = Math.min(...displays.map((display: any) => display.bounds.y));
  const virtualRight = Math.max(...displays.map((display: any) => display.bounds.x + display.bounds.width));
  const virtualBottom = Math.max(...displays.map((display: any) => display.bounds.y + display.bounds.height));
  const absoluteX = selectedDisplay.bounds.x + Math.max(0, Math.min(1, x)) * selectedDisplay.bounds.width;
  const absoluteY = selectedDisplay.bounds.y + Math.max(0, Math.min(1, y)) * selectedDisplay.bounds.height;

  return {
    x: (absoluteX - virtualLeft) / Math.max(1, virtualRight - virtualLeft),
    y: (absoluteY - virtualTop) / Math.max(1, virtualBottom - virtualTop)
  };
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
      if (!app.isPackaged || !process.argv.includes('--hidden')) {
        mainWindow?.maximize();
        mainWindow?.show();
        mainWindow?.focus();
      }
    });

    mainWindow.on('close', (event: any) => {
      if (!isQuitting) {
        event.preventDefault();
        mainWindow?.hide();
        // Show a one-time balloon so the user knows where to find it
        if (tray && !shownTrayHint) {
          shownTrayHint = true;
          tray.displayBalloon({
            title: 'Still running in background',
            content: 'Connect-X is in the system tray. Click the icon to reopen it.',
            iconType: 'info'
          });
        }
      }
      return false;
    });
    log.info('[Host] BrowserWindow object created.');

    mainWindow.webContents.on('did-finish-load', () => log.info('[Host] Renderer: did-finish-load'));
    mainWindow.webContents.on('did-fail-load', (e: any, code: any, desc: any) => log.error(`[Host] Renderer: did-fail-load (${code}): ${desc}`));
    mainWindow.webContents.on('crashed', () => log.error('[Host] Renderer process CRASHED'));

    if (process.env.VITE_DEV_SERVER_URL) {
      const url = process.env.VITE_DEV_SERVER_URL.replace('localhost', '127.0.0.1');
      log.info(`[Host] Loading URL: ${url}`);
      mainWindow.loadURL(url).catch((e: any) => log.error(`[Host] loadURL failed: ${e.message}`));
    } else {
      log.info('[Host] Loading local production file...');
      mainWindow.loadFile(join(__dirname, '../../dist/index.html')).catch((e: any) => log.error(`[Host] loadFile failed: ${e.message}`));
    }
  } catch (err: any) {
    log.error(`[Host] CRITICAL ERROR in createWindow: ${err.message}\n${err.stack}`);
  }
}

process.on('uncaughtException', (err: any) => {
  log.error(`[Host] UNCAUGHT EXCEPTION: ${err.message}\n${err.stack}`);
});

process.on('unhandledRejection', (reason: any, promise: any) => {
  log.error('[Host] UNHANDLED REJECTION:', reason);
});

app.whenReady().then(() => {
  log.info('[Host] App is ready. Initializing subsystems...');

  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(['media', 'display-capture'].includes(permission));
  });

  session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen', 'window'],
        thumbnailSize: { width: 320, height: 180 },
        fetchWindowIcons: true
      });
      const primaryDisplayId = String(screen.getPrimaryDisplay().id);
      const source = sources.find((item) => item.display_id === primaryDisplayId) || sources[0];
      if (!source) {
        callback({});
        return;
      }
      callback({
        video: source,
        audio: 'loopback' as any
      });
    } catch (err: any) {
      log.error(`[Meeting] Display media request failed: ${err.message}`);
      callback({});
    }
  });

  // Force auto-launch for seamless reconnects on restart
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: false, // Could be true if we wanted it silent
      path: app.getPath('exe')
    });
  }

  // Tray Initialization
  const iconPath = app.isPackaged
    ? join(process.resourcesPath, 'app.asar.unpacked/resources/logo.png') // Path in build
    : join(__dirname, '../../src/renderer/assets/logo.png'); // Path in dev

  try {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show RemoteLink', click: () => mainWindow?.show() },
      { type: 'separator' },
      {
        label: 'Restart App', click: () => {
          isQuitting = true;
          app.relaunch();
          app.exit();
        }
      },
      {
        label: 'Quit RemoteLink', click: () => {
          isQuitting = true;
          app.quit();
        }
      }
    ]);
    tray.setToolTip('RemoteLink Node');
    tray.setContextMenu(contextMenu);
    tray.on('click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    tray.on('double-click', () => {
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
  } catch (e) {
    log.error('[Host] Failed to initialize Tray:', e);
  }

  // Initialize paths that require app to be ready
  AUTH_STORE_PATH = join(app.getPath('userData'), 'connectx_auth.json');
  log.info(`[Host] Auth store path: ${AUTH_STORE_PATH}`);

  createWindow();
  startStatsMonitoring();

  // Lazy detection: Probing HW encoders is now deferred until a host session is actually requested
  // to avoid cold startup crashes or unnecessary resource usage.
  // detectBestEncoder().catch((err) => log.warn('[Host] Encoder detection failed:', err));


  // Handle startup deep link: when the app was launched fresh by a remotelink:// URL
  const startupUrl = process.argv.find((a: any) => a.startsWith(`${PROTOCOL}://`));
  if (startupUrl) {
    mainWindow?.webContents.once('did-finish-load', () => {
      log.info(`[Host] Processing startup deep link: ${startupUrl}`);
      handleDeepLink(startupUrl);
    });
  }

  // Check for updates on startup. The renderer also checks when the banner mounts,
  // which covers the case where this event fires before React listeners are ready.
  if (app.isPackaged) {
    checkForDesktopUpdates().catch((e: any) => {
      if (isMissingUpdateManifest(e)) {
        log.warn('[Updater] No update manifest found during startup check.');
        return;
      }
      log.error('[Updater] Failed initial check:', e);
    });
    if (updateCheckInterval) clearInterval(updateCheckInterval);
    updateCheckInterval = setInterval(() => {
      checkForDesktopUpdates().catch((e: any) => {
        if (isMissingUpdateManifest(e)) return;
        log.warn('[Updater] Background update check failed:', e?.message || e);
      });
    }, 60_000);
  }
});

ipcMain.handle('host:save-file-locally', async (_event: any, name: string, data: Uint8Array) => {
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

ipcMain.handle('system:saveHistory', async (_event: any, history: any[]) => {
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
let lastCpuStats = os.cpus();
function startStatsMonitoring() {
  if (statsInterval) clearInterval(statsInterval);
  let prevBytes = 0;

  statsInterval = setInterval(() => {
    if (!mainWindow) return;

    const currentBytes = totalBytesSent;
    const bps = currentBytes - prevBytes;
    prevBytes = currentBytes;

    const mbps = (bps * 8) / (1024 * 1024);
    const activePeers = (peerConnection && peerConnection.state() === 'connected') ? 1 : 0;

    // CPU Load
    const currentCpuStats = os.cpus();
    let totalDelta = 0;
    let idleDelta = 0;
    for (let i = 0; i < currentCpuStats.length; i++) {
      const prev = lastCpuStats[i].times;
      const curr = currentCpuStats[i].times;
      totalDelta += (curr.user + curr.nice + curr.sys + curr.idle + curr.irq) - (prev.user + prev.nice + prev.sys + prev.idle + prev.irq);
      idleDelta += curr.idle - prev.idle;
    }
    const cpuLoad = totalDelta === 0 ? 0 : (1 - idleDelta / totalDelta) * 100;
    lastCpuStats = currentCpuStats;

    // Memory usage
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memUsage = ((totalMem - freeMem) / totalMem) * 100;

    mainWindow.webContents.send('host:stats', {
      bandwidth: mbps.toFixed(2),
      activeUsers: activePeers,
      cpu: cpuLoad.toFixed(1),
      memory: memUsage.toFixed(1)
    });
  }, 1000);
}

// window-all-closed handler

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !isQuitting) {
    // On Windows/Linux we just stay in tray
  } else if (isQuitting) {
    app.quit();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
});

// Ensure we don't quit when main window is closed
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function connectViewerSignaling(sessionId: string, serverIP: string, token: string, viewerClientId?: string) {
  const wsUrl = `ws://${serverIP}/api/signal`;
  const ws = new WebSocket(wsUrl);
  viewerSignalingSockets.set(sessionId, ws);

  ws.on('open', () => {
    ws.send(JSON.stringify({ type: 'join', sessionId, token, viewerClientId }));
  });

  ws.on('message', (data: any) => {
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
