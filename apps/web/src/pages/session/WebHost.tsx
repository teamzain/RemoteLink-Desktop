import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Box, Typography, Button, Paper, Stack } from '@mui/material';
import { Monitor, Stop, PlayArrow, Key, Wifi, ContentCopy } from '@mui/icons-material';
import DashboardLayout from '../../components/dashboard/DashboardLayout';
import { useAuthStore } from '../../store/authStore';
import { useSnackbar } from '../../components/NotificationProvider';

// @ts-ignore
const MediaStreamTrackProcessor = (window as any).MediaStreamTrackProcessor;
// @ts-ignore
const VideoEncoder = (window as any).VideoEncoder;

const WebHost: React.FC = () => {
  const { accessToken } = useAuthStore();
  const { showSnackbar } = useSnackbar();
  const [accessKey, setAccessKey] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'ready' | 'broadcasting'>('idle');
  const [viewers, setViewers] = useState<string[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoChannelRef = useRef<RTCDataChannel | null>(null);
  const controlChannelRef = useRef<RTCDataChannel | null>(null);
  const encoderRef = useRef<any>(null);
  const frameCountRef = useRef(0);
  const readerRef = useRef<any>(null);

  // Generate deterministic-ish or random 9-digit key for this session
  useEffect(() => {
    let key = localStorage.getItem('remote_link_web_host_key');
    if (!key) {
      key = Math.floor(100000000 + Math.random() * 900000000).toString();
      localStorage.setItem('remote_link_web_host_key', key);
    }
    setAccessKey(key);
  }, []);

  const formatCode = (code: string) => {
    const clean = code.replace(/[^0-9]/g, '');
    if (clean.length === 9) {
      return `${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6,9)}`;
    }
    return clean;
  };

  const copyAccessKey = () => {
    navigator.clipboard.writeText(accessKey);
    showSnackbar('Access Key copied to clipboard!', 'success');
  };

  const initSignaling = useCallback(() => {
    if (!accessToken || !accessKey) return;
    const SIGNAL_URL = import.meta.env.VITE_SIGNAL_URL || 'ws://localhost:3002';
    const ws = new WebSocket(SIGNAL_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', token: accessToken, role: 'host', accessKey }));
      setStatus('ready');
    };

    ws.onmessage = async (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'joined') {
        const viewerId = data.viewerId;
        setViewers((prev) => [...prev, viewerId]);
        await createOffer(viewerId);
      } else if (data.type === 'answer') {
        if (pcRef.current) {
          await pcRef.current.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: data.sdp }));
        }
      } else if (data.type === 'ice-candidate') {
        if (pcRef.current) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate({
            candidate: data.candidate.candidate || data.candidate,
            sdpMid: data.candidate.sdpMid || data.mid
          }));
        }
      }
    };

    ws.onclose = () => setStatus('idle');

    return () => {
      ws.close();
    };
  }, [accessToken, accessKey]);

  useEffect(() => {
    const cleanup = initSignaling();
    return () => {
      if (cleanup) cleanup();
      stopBroadcasting(true);
    };
  }, [initSignaling]);

  const createOffer = async (targetId: string) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          targetId,
          candidate: event.candidate,
        }));
      }
    };

    const control = pc.createDataChannel('control');
    controlChannelRef.current = control;
    control.onmessage = (e) => console.log('Control channel message ignored in WebHost:', e.data);

    const video = pc.createDataChannel('video');
    videoChannelRef.current = video;
    video.binaryType = 'arraybuffer';
    video.onopen = () => {
      console.log('Video channel opened');
      if (encoderRef.current) {
        // Ready to send frames
      }
    };

    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    wsRef.current?.send(JSON.stringify({ type: 'offer', targetId, sdp: offer.sdp }));
  };

  const startBroadcasting = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60, width: 1920, height: 1080 }, audio: false });
      streamRef.current = stream;

      stream.getVideoTracks()[0].onended = () => {
        stopBroadcasting();
      };

      // Set up WebCodecs VideoEncoder
      encoderRef.current = new VideoEncoder({
        output: (chunk: any) => {
          if (videoChannelRef.current?.readyState !== 'open') return;

          const data = new Uint8Array(chunk.byteLength);
          chunk.copyTo(data);
          
          const MAX_FRAG = 16000;
          const totalFrags = Math.ceil(data.length / MAX_FRAG);
          
          for (let i = 0; i < totalFrags; i++) {
            const fragData = data.slice(i * MAX_FRAG, (i + 1) * MAX_FRAG);
            const buffer = new ArrayBuffer(10 + fragData.length);
            const view = new DataView(buffer);
            view.setBigInt64(0, BigInt(chunk.timestamp), true);
            view.setUint8(8, i);
            view.setUint8(9, totalFrags);
            new Uint8Array(buffer, 10).set(fragData);
            
            try {
              videoChannelRef.current.send(buffer);
            } catch (err) {
              console.warn('DataChannel buffer full or closed', err);
            }
          }
        },
        error: (e: any) => {
          console.error(e);
          showSnackbar('Video Encoder Error: ' + e.message, 'error');
        }
      });

      const { width, height } = stream.getVideoTracks()[0].getSettings();

      encoderRef.current.configure({
        codec: 'avc1.42E029', // High profile, Level 4.1 for 1080p@60 support
        width: width || 1920,
        height: height || 1080,
        bitrate: 2_000_000,
        framerate: 30,
        latencyMode: 'realtime'
      });

      const track = stream.getVideoTracks()[0];
      const processor = new MediaStreamTrackProcessor({ track });
      const reader = processor.readable.getReader();
      readerRef.current = reader;
      frameCountRef.current = 0;

      setStatus('broadcasting');

      const readFrame = async () => {
        while (true) {
          let frame: any = null;
          try {
            const { done, value } = await reader.read();
            if (done) break;
            frame = value;
            if (encoderRef.current && encoderRef.current.state === 'configured') {
              const isKeyFrame = frameCountRef.current % 60 === 0;
              encoderRef.current.encode(frame, { keyFrame: isKeyFrame });
              frameCountRef.current++;
            }
          } catch (e) {
            break;
          } finally {
            if (frame) frame.close();
          }
        }
      };
      readFrame();

    } catch (err: any) {
      showSnackbar('Failed to start broadcast: ' + err.message, 'error');
      setStatus('ready');
    }
  };

  const stopBroadcasting = (silent = false) => {
    if (readerRef.current) {
      readerRef.current.cancel();
      readerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (encoderRef.current && encoderRef.current.state !== 'closed') {
      encoderRef.current.close();
      encoderRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setStatus('ready');
    if (!silent) showSnackbar('Broadcast stopped', 'info');
  };

  return (
    <DashboardLayout title="Host Session">
      <Box sx={{ p: 4, maxWidth: 800, mx: 'auto', width: '100%' }}>
        
        <Box sx={{ mb: 6, textAlign: 'center' }}>
          <Box sx={{ width: 80, height: 80, bgcolor: 'primary.light', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 3, boxShadow: '0 12px 24px rgba(37, 99, 235, 0.15)' }}>
            <Monitor sx={{ fontSize: 40, color: 'primary.main' }} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 900, textTransform: 'uppercase', letterSpacing: '-1px' }}>
            Browser Hosting
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 500, mx: 'auto', fontWeight: 500 }}>
            Share your screen directly from this browser using WebRTC DataChannels. No desktop agent required. View-only mode for participants.
          </Typography>
        </Box>

        <Paper sx={{ p: 6, borderRadius: '32px', border: '1px solid', borderColor: 'divider', boxShadow: 'none', position: 'relative', overflow: 'hidden' }}>
          {status === 'broadcasting' && <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, bgcolor: 'error.main', animation: 'pulse 2s infinite' }} />}
          
          <Stack spacing={4} alignItems="center">
            
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="overline" sx={{ fontWeight: 800, color: 'text.secondary', tracking: '0.2em' }}>
                Your Access Key
              </Typography>
              <Box onClick={copyAccessKey} sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1, cursor: 'pointer', '&:hover': { opacity: 0.8 }, transition: 'all' }}>
                <Key sx={{ color: 'primary.main' }} />
                <Typography variant="h2" sx={{ fontWeight: 900, letterSpacing: '8px', color: 'primary.main', fontFamily: 'monospace' }}>
                  {formatCode(accessKey)}
                </Typography>
                <ContentCopy sx={{ color: 'text.secondary', fontSize: 20 }} />
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', p: 2, bgcolor: 'background.default', borderRadius: '16px', border: '1px solid', borderColor: 'divider', minWidth: 300 }}>
              <Wifi sx={{ color: status === 'idle' ? 'text.disabled' : status === 'ready' ? 'success.main' : 'error.main' }} />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
                  {status === 'idle' ? 'Connecting to Server...' : status === 'ready' ? 'Ready to Broadcast' : 'Broadcasting Live'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {viewers.length} Viewer{viewers.length !== 1 ? 's' : ''} Connected
                </Typography>
              </Box>
              {status === 'broadcasting' && (
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main', animation: 'pulse 2s infinite' }} />
              )}
            </Box>

            <Box sx={{ pt: 2, w: '100%', display: 'flex', justifyContent: 'center' }}>
              {status === 'broadcasting' ? (
                <Button
                  variant="contained"
                  color="error"
                  size="large"
                  onClick={() => stopBroadcasting()}
                  startIcon={<Stop />}
                  sx={{ borderRadius: '16px', px: 6, py: 2, fontWeight: 900, textTransform: 'uppercase', tracking: '0.1em' }}
                >
                  Stop Broadcast
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  onClick={startBroadcasting}
                  disabled={status === 'idle'}
                  startIcon={<PlayArrow />}
                  sx={{ borderRadius: '16px', px: 6, py: 2, fontWeight: 900, textTransform: 'uppercase', tracking: '0.1em', boxShadow: '0 8px 16px rgba(37,99,235,0.2)' }}
                >
                  Start Screen Share
                </Button>
              )}
            </Box>

          </Stack>
        </Paper>
      </Box>
    </DashboardLayout>
  );
};

export default WebHost;
