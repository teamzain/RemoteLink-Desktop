import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  Stack,
  Chip,
  IconButton,
  Tooltip,
  Button,
  Drawer,
  List,
  ListItem,
  ListItemText,
  Backdrop,
  CircularProgress,
  ThemeProvider,
} from '@mui/material';
import {
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  ContentPaste as ContentPasteIcon,
  FolderOpen as FolderOpenIcon,
  Keyboard as KeyboardIcon,
  Logout as LogoutIcon,
  ErrorOutline as ErrorOutlineIcon,
  Circle as CircleIcon,
} from '@mui/icons-material';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { lightTheme } from '../../theme';
import { useSessionStore } from '../../store/sessionStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const StyledBox = Box as any;

const shortcuts = [
  { key: 'Ctrl + Alt + Del', desc: 'Secure Attention Sequence' },
  { key: 'Win + R', desc: 'Run Command' },
  { key: 'Alt + Tab', desc: 'Switch Windows' },
  { key: 'Ctrl + Shift + Esc', desc: 'Task Manager' },
  { key: 'Win + E', desc: 'File Explorer' },
];

// --- Premium Mobile Device Frame ---
const MobileDeviceFrame = ({ children, orientation = 'portrait' }: { children: React.ReactNode, orientation?: 'portrait' | 'landscape' }) => {
  return (
    <div className={`relative mx-auto transition-all duration-700 ease-in-out ${orientation === 'portrait' ? 'h-[85vh] aspect-[9/19.5]' : 'w-[85vw] aspect-[19.5/9]'}`}>
      <div className="absolute inset-0 bg-[#0f0f0f] rounded-[3rem] border-[6px] border-[#1f1f1f] shadow-[0_0_0_2px_#2a2a2a,0_40px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden">
        <div className="absolute top-10 left-[-6px] w-2 h-8 bg-[#2a2a2a]" />
        <div className="absolute bottom-10 left-[-6px] w-2 h-8 bg-[#2a2a2a]" />
        
        <div className="absolute inset-1.5 bg-black rounded-[2.5rem] overflow-hidden border border-white/5 flex items-center justify-center">
          {children}
        </div>

        {orientation === 'portrait' && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full flex items-center justify-center gap-1.5 px-3 border border-white/5">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500/20" />
            <div className="flex-grow h-1 bg-white/5 rounded-full" />
          </div>
        )}
      </div>

      {orientation === 'portrait' && (
        <>
          <div className="absolute top-24 -left-2 w-1.5 h-12 bg-[#1f1f1f] rounded-l-md border-r border-black/20" />
          <div className="absolute top-40 -left-2 w-1.5 h-12 bg-[#1f1f1f] rounded-l-md border-r border-black/20" />
          <div className="absolute top-32 -right-2 w-1.5 h-20 bg-[#1f1f1f] rounded-r-md border-l border-black/20" />
        </>
      )}
    </div>
  );
};

const SessionViewer: React.FC = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { initSocket, closeSocket, sendMessage, onMessage, activeSession, updateLatency, updateSessionStatus } = useSessionStore();
  
  const accessToken: string | undefined = (location.state as any)?.accessToken;
  const deviceName: string | undefined = (location.state as any)?.deviceName;
  const accessKey: string | undefined = (location.state as any)?.accessKey;

  const [toolbarVisible, setToolbarVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [status, setStatus] = useState<'connecting' | 'connected' | 'reconnecting' | 'lost'>('connecting');
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const timerRef = useRef<any>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [deviceType, setDeviceType] = useState<string | null>((location.state as any)?.deviceType || null);
  const decoderRef = useRef<any>(null);
  const hasReceivedKeyframeRef = useRef(false);
  const reassemblyMap = useRef(new Map<bigint, { fragments: (Uint8Array | null)[], count: number, total: number }>());

  const initDecoder = () => {
    if (remoteStream || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    if (decoderRef.current) {
       try { decoderRef.current.close(); } catch {}
    }
    try {
      const decoder = new (window as any).VideoDecoder({
        output: (frame: any) => {
          if (canvasRef.current) {
            ctx.drawImage(frame, 0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          frame.close();
        },
        error: (e: any) => {
          console.error('[WebRTC] Decoder error:', e);
          hasReceivedKeyframeRef.current = false;
        },
      });
      decoder.configure({ codec: 'avc1.42E029', optimizeForLatency: true });
      decoderRef.current = decoder;
    } catch (err) {
      console.error("WebCodecs not supported", err);
    }
  };

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const feedToDecoder = (chunkData: Uint8Array, timestamp: bigint) => {
    if (!decoderRef.current || decoderRef.current.state !== 'configured') return;
    let type: 'key' | 'delta' = 'delta';
    for (let i = 0; i < Math.min(chunkData.length - 4, 100); i++) {
        if (chunkData[i] === 0 && chunkData[i+1] === 0) {
            let nalType = -1;
            if (chunkData[i+2] === 1) { nalType = chunkData[i+3] & 0x1F; }
            else if (chunkData[i+2] === 0 && chunkData[i+3] === 1) { nalType = chunkData[i+4] & 0x1F; }
            if (nalType === 5 || nalType === 7 || nalType === 8) {
                type = 'key';
                hasReceivedKeyframeRef.current = true;
                break;
            }
        }
    }
    if (!hasReceivedKeyframeRef.current) return;
    try {
      const encodedChunk = new (window as any).EncodedVideoChunk({ type, timestamp: Number(timestamp), data: chunkData });
      decoderRef.current.decode(encodedChunk);
    } catch (e) {
      console.warn('Decoder push failed:', e);
    }
  };

  const handleFragment = (data: Uint8Array) => {
    if (data.length < 10) return;
    const view = new DataView(data.buffer, data.byteOffset, 10);
    const ts = view.getBigInt64(0, true);
    const fragIdx = view.getUint8(8);
    const totalFrags = view.getUint8(9);
    let entry = reassemblyMap.current.get(ts);
    if (!entry) {
      entry = { fragments: new Array(totalFrags).fill(null), count: 0, total: totalFrags };
      reassemblyMap.current.set(ts, entry);
    }
    if (!entry.fragments[fragIdx]) {
      entry.fragments[fragIdx] = data.slice(10);
      entry.count++;
    }
    if (entry.count === entry.total) {
      const totalSize = entry.fragments.reduce((acc, f) => acc + (f ? f.length : 0), 0);
      const fullNAL = new Uint8Array(totalSize);
      let offset = 0;
      for (const f of entry.fragments) {
        if (f) { fullNAL.set(f, offset); offset += f.length; }
      }
      feedToDecoder(fullNAL, ts);
      reassemblyMap.current.delete(ts);
      if (reassemblyMap.current.size > 20) {
        const oldestTs = Array.from(reassemblyMap.current.keys()).sort()[0] as any;
        reassemblyMap.current.delete(oldestTs);
      }
    }
  };

  useEffect(() => {
    if (!accessToken || !deviceId) return;
    const ws = initSocket(accessToken);

    const handleOpen = () => {
      sendMessage('join', { sessionId: accessKey || deviceId, token: accessToken });
    };

    if (ws.readyState === WebSocket.OPEN) handleOpen();
    const cleanupOpen = onMessage('open', handleOpen);

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage('ice-candidate', { 
          targetId: accessKey || deviceId, 
          candidate: event.candidate.candidate,
          sdpMid: event.candidate.sdpMid,
          sdpMLineIndex: event.candidate.sdpMLineIndex
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStream(event.streams[0]);
      setStatus('connected');
      updateSessionStatus('active');
    };

    pc.ondatachannel = (event) => {
      if (event.channel.label === 'control') {
        dataChannelRef.current = event.channel;
        event.channel.onopen = () => {
          console.log('[Web] Control DataChannel ACTIVE. Requesting keyframe...');
          event.channel.send(JSON.stringify({ type: 'request-keyframe' }));
        };
        event.channel.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            if (data.type === 'clipboard' && data.text) navigator.clipboard.writeText(data.text).catch(() => {});
          } catch {}
        };
      } else if (event.channel.label === 'video') {
        event.channel.binaryType = 'arraybuffer';
        event.channel.onopen = () => {
          if (!remoteStream) { setStatus('connected'); updateSessionStatus('active'); initDecoder(); }
        };
        event.channel.onmessage = (e) => {
          if (!remoteStream) handleFragment(new Uint8Array(e.data as ArrayBuffer));
        };
      }
    };

    const cleanupOffer = onMessage('offer', async ({ senderId, sdp, hostType }) => {
      if (hostType) setDeviceType(hostType);
      await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendMessage('answer', { targetId: senderId, sdp: answer.sdp });
    });

    const cleanupIce = onMessage('ice-candidate', async (msg) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate({ 
          candidate: typeof msg.candidate === 'string' ? msg.candidate : msg.candidate?.candidate, 
          sdpMid: msg.mid || msg.candidate?.sdpMid 
        }));
      } catch (e) {
        console.warn('[WebRTC] Failed to add ICE candidate', e);
      }
    });

    const cleanupLatency = onMessage('session:latency', ({ value }) => { updateLatency(value); });
    const cleanupDisconnect = onMessage('disconnect', () => setStatus('lost'));

    return () => {
      pc.close();
      cleanupOpen();
      cleanupOffer();
      cleanupIce();
      cleanupLatency();
      cleanupDisconnect();
      closeSocket();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, accessToken]);

  const handleInput = (type: 'mouse' | 'keyboard', data: any) => {
    if (status === 'connected' && dataChannelRef.current?.readyState === 'open') {
      const typeMap: Record<string, string> = {
        'move': 'mousemove',
        'down': type === 'mouse' ? 'mousedown' : 'keydown',
        'up': type === 'mouse' ? 'mouseup' : 'keyup',
      };
      const eventType = typeMap[data.type] || data.type;
      dataChannelRef.current.send(JSON.stringify({ type: eventType, ...data }));
    }
  };

  const handleMouseEvent = (e: React.MouseEvent, type: string) => {
    const target = (remoteStream ? videoRef.current : canvasRef.current) as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const controlType = type === 'move' ? 'mousemove' : (type === 'down' ? 'mousedown' : 'mouseup');
    handleInput('mouse', { type: controlType, button: (e as any).button, x, y });
  };

  const isMobile = deviceType?.toLowerCase() === 'android' || deviceType?.toLowerCase() === 'ios';

  const renderContent = () => (
    <>
      {remoteStream ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onMouseMove={(e) => handleMouseEvent(e, 'move')}
          onMouseDown={(e) => handleMouseEvent(e, 'down')}
          onMouseUp={(e) => handleMouseEvent(e, 'up')}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: '100%', height: '100%', objectFit: isMobile ? 'cover' : 'contain', cursor: 'none', backgroundColor: '#000' }}
        />
      ) : (
        <canvas
          ref={canvasRef} width={1920} height={1080}
          onMouseMove={(e) => handleMouseEvent(e, 'move')}
          onMouseDown={(e) => handleMouseEvent(e, 'down')}
          onMouseUp={(e) => handleMouseEvent(e, 'up')}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: '100%', height: '100%', objectFit: isMobile ? 'cover' : 'contain', cursor: 'none', backgroundColor: '#000' }}
        />
      )}
    </>
  );

  useEffect(() => {
    const handleMouseMove = () => {
      setToolbarVisible(true);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => { setToolbarVisible(false); }, 3000);
    };
    window.addEventListener('mousemove', handleMouseMove);
    handleMouseMove();
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true); }
    else { if (document.exitFullscreen) { document.exitFullscreen(); setIsFullscreen(false); } }
  };

  const getLatencyColor = () => {
    const lat = activeSession?.latency || 0;
    if (lat < 50) return 'success';
    if (lat < 150) return 'warning';
    return 'error';
  };

  return (
    <ThemeProvider theme={lightTheme}>
      <StyledBox sx={{ width: '100vw', height: '100vh', bgcolor: 'background.default', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }} component="div">
        {isMobile ? <MobileDeviceFrame>{renderContent()}</MobileDeviceFrame> : renderContent()}
        <AppBar elevation={4} sx={{ position: 'absolute', top: 0, left: 0, right: 0, bgcolor: 'background.paper', backgroundImage: 'none', opacity: toolbarVisible ? 0.9 : 0, backdropFilter: 'blur(8px)', transition: 'opacity 0.3s ease-in-out', pointerEvents: toolbarVisible ? 'auto' : 'none', borderBottom: '1px solid', borderColor: 'divider' }}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{deviceName || deviceId}</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip icon={<CircleIcon sx={{ fontSize: '10px !important' }} />} label={`${activeSession?.latency || 0}ms`} size="small" color={getLatencyColor()} sx={{ fontWeight: 900, px: 1 }} />
              <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}><IconButton color="inherit" onClick={toggleFullscreen}>{isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}</IconButton></Tooltip>
              <Tooltip title="Clipboard"><IconButton color="inherit"><ContentPasteIcon /></IconButton></Tooltip>
              <Tooltip title="File Transfer"><IconButton color="inherit"><FolderOpenIcon /></IconButton></Tooltip>
              <Tooltip title="Shortcuts"><IconButton color="inherit" onClick={() => setShowShortcuts(true)}><KeyboardIcon /></IconButton></Tooltip>
              <Button variant="outlined" color="error" size="small" startIcon={<LogoutIcon />} sx={{ ml: 2, fontWeight: 800, borderRadius: '8px' }} onClick={() => navigate('/dashboard')}>Disconnect</Button>
            </Stack>
          </Toolbar>
        </AppBar>
        <Drawer anchor="right" open={showShortcuts} onClose={() => setShowShortcuts(false)} PaperProps={{ sx: { width: 300, bgcolor: 'background.paper', backgroundImage: 'none' } }}>
          <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 900, mb: 3 }}>Keyboard Shortcuts</Typography>
            <List>{shortcuts.map((s) => (<ListItem key={s.key} disablePadding sx={{ mb: 2 }}><ListItemText primary={s.key} secondary={s.desc} primaryTypographyProps={{ fontWeight: 800, fontFamily: 'monospace' }} /></ListItem>))}</List>
          </Box>
        </Drawer>
        <Backdrop open={status === 'reconnecting' || status === 'connecting'} sx={{ color: 'primary.main', zIndex: (theme) => theme.zIndex.drawer + 1, flexDirection: 'column', gap: 2, bgcolor: 'rgba(255, 255, 255, 0.9)' }}><CircularProgress color="inherit" /><Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary' }}>{status === 'connecting' ? 'Establishing secure connection...' : 'Reconnecting...'}</Typography></Backdrop>
        <Backdrop open={status === 'lost'} sx={{ color: 'text.primary', zIndex: (theme) => theme.zIndex.drawer + 1, flexDirection: 'column', gap: 2, bgcolor: 'rgba(255, 255, 255, 0.95)' }}><ErrorOutlineIcon color="error" sx={{ fontSize: 60 }} /><Typography variant="h5" sx={{ fontWeight: 900 }}>Connection lost</Typography><Button variant="contained" color="primary" onClick={() => navigate('/dashboard')} sx={{ mt: 2, borderRadius: '20px', px: 4 }}>Return to dashboard</Button></Backdrop>
      </StyledBox>
    </ThemeProvider>
  );
};

export default SessionViewer;
