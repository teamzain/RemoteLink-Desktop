import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  ArrowLeft,
  Smartphone,
  Activity,
  Search,
  Monitor,
  RefreshCw,
  Lock,
  Power,
  Plus,
  MonitorOff,
  Globe,
  Folder
} from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';

// Legacy frames removed for clean theater mode.

// Generate a stable client ID for this session to handle React StrictMode double-mounts
const viewerClientId = Math.random().toString(36).substring(7);

const SessionViewer: React.FC = () => {
  const { deviceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { initSocket, closeSocket, sendMessage, onMessage, activeSession, updateLatency, updateSessionStatus } = useSessionStore();
  
  const accessToken: string | undefined = (location.state as any)?.accessToken;
  const passedDeviceName: string | undefined = (location.state as any)?.deviceName;
  const accessKey: string | undefined = (location.state as any)?.accessKey;

  const [viewerStatus, setViewerStatus] = useState<'idle' | 'connecting' | 'connected' | 'streaming' | 'connection_lost'>('connecting');
  const [zoomMode, setZoomMode] = useState<'fit' | 'original'>('fit');
  const [transferProgress, setTransferProgress] = useState<{name: string, p: number} | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);

  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [deviceType, setDeviceType] = useState<string | null>((location.state as any)?.deviceType || null);
  const deviceName = passedDeviceName || deviceId || 'Remote Node';

  const decoderRef = useRef<any>(null);
  const hasReceivedKeyframeRef = useRef(false);
  const [, forceRender] = useState({}); // used when hasReceivedKeyframe updates

  const reassemblyMap = useRef(new Map<bigint, { fragments: (Uint8Array | null)[], count: number, total: number }>());

  const initDecoder = () => {
    if (remoteStream || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;
    if (decoderRef.current) {
       try { decoderRef.current.close(); } catch {}
    }
    const VideoDecoder = (window as any).VideoDecoder;
    if (!VideoDecoder) return;

    try {
      const decoder = new VideoDecoder({
        output: (frame: any) => {
          if (canvasRef.current) {
            ctx.drawImage(frame, 0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          if (!hasReceivedKeyframeRef.current) {
            hasReceivedKeyframeRef.current = true;
            forceRender({});
          }
          frame.close();
        },
        error: (e: any) => {
          console.error('[WebRTC] Decoder error:', e);
          hasReceivedKeyframeRef.current = false;
          forceRender({});
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
      videoRef.current.play().catch(() => {});
    }
  }, [remoteStream]);

  const feedToDecoder = (chunkData: Uint8Array, timestamp: bigint) => {
    if (!decoderRef.current || decoderRef.current.state !== 'configured') return;
    
    let type: 'key' | 'delta' = 'delta';
    // Scan for NAL units to find keyframes (SPS, PPS, or IDR)
    for (let i = 0; i < Math.min(chunkData.length - 5, 256); i++) {
        const isHeader4 = chunkData[i] === 0 && chunkData[i+1] === 0 && chunkData[i+2] === 0 && chunkData[i+3] === 1;
        const isHeader3 = chunkData[i] === 0 && chunkData[i+1] === 0 && chunkData[i+2] === 1;
        
        if (isHeader4 || isHeader3) {
            let nalType = -1;
            if (isHeader4) { 
                nalType = chunkData[i+4] & 0x1F;
            } else {
                nalType = chunkData[i+3] & 0x1F;
            }

            if (nalType === 5 || nalType === 7 || nalType === 8) {
                type = 'key';
                if (!hasReceivedKeyframeRef.current) {
                    console.log(`[VideoPlayer] Initial Keyframe Found (type:${nalType})`);
                    hasReceivedKeyframeRef.current = true;
                    forceRender({});
                }
                break;
            }
        }
    }

    if (!hasReceivedKeyframeRef.current) {
      if (Math.random() < 0.05) console.log(`[VideoPlayer] Buffering (No keyframe yet). Data Size: ${chunkData.length}`);
      return;
    }

    if (viewerStatus !== 'streaming') {
      console.log(`[VideoPlayer] Transitioning to STREAMING. First frame: ${type}, size: ${chunkData.length}`);
      setViewerStatus('streaming');
    }

    try {
      const EncodedVideoChunk = (window as any).EncodedVideoChunk;
      if (!EncodedVideoChunk) return;
      
      const encodedChunk = new EncodedVideoChunk({
        type: type,
        timestamp: Number(timestamp), 
        data: chunkData,
      });
      decoderRef.current.decode(encodedChunk);
    } catch (e) {
      console.warn('[VideoPlayer] Decoder push failed:', e);
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
      sendMessage('join', { sessionId: accessKey || deviceId, token: accessToken, viewerClientId });
      // Add viewer request here to make sure host initiates the offer
      setTimeout(() => {
        sendMessage('request-offer', { targetId: accessKey || deviceId });
      }, 500);
    };

    if (ws.readyState === WebSocket.OPEN) handleOpen();
    const cleanupOpen = onMessage('open', handleOpen);

    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    pcRef.current = pc;

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        setViewerStatus('connection_lost');
      }
    };

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
      setViewerStatus('streaming');
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
          if (!remoteStream) { setViewerStatus('streaming'); updateSessionStatus('active'); initDecoder(); }
        };
        event.channel.onmessage = (e) => {
          if (!remoteStream) handleFragment(new Uint8Array(e.data as ArrayBuffer));
        };
      }
    };

    const cleanupOffer = onMessage('offer', async (msg) => {
      // It might come as msg directly or msg.sdp depending on signaling wrapper
      const sdp = msg.sdp || msg;
      const senderId = msg.senderId || msg.sourceId;
      if (msg.hostType) setDeviceType(msg.hostType);
      
      try {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendMessage('answer', { targetId: senderId || accessKey || deviceId, sdp: answer.sdp });
      } catch (e) {
        console.error('[WebRTC] Failed to handle offer', e);
      }
    });

    const cleanupIce = onMessage('ice-candidate', async (msg) => {
      try {
        if (!msg.candidate) return;
        await pc.addIceCandidate(new RTCIceCandidate({ 
          candidate: typeof msg.candidate === 'string' ? msg.candidate : msg.candidate.candidate, 
          sdpMid: msg.sdpMid || msg.candidate.sdpMid,
          sdpMLineIndex: msg.sdpMLineIndex || msg.candidate.sdpMLineIndex
        }));
      } catch (e) {
        console.warn('[WebRTC] Failed to add ICE candidate', e);
      }
    });

    const cleanupLatency = onMessage('session:latency', ({ value }) => { updateLatency(value); });
    const cleanupDisconnect = onMessage('disconnect', () => setViewerStatus('connection_lost'));

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

  const onControlEvent = useCallback((data: any) => {
    if (viewerStatus !== 'streaming') return;
    if (data instanceof Uint8Array) {
      if (dataChannelRef.current?.readyState === 'open') dataChannelRef.current.send(data as any);
    } else {
      if (dataChannelRef.current?.readyState === 'open') dataChannelRef.current.send(JSON.stringify(data));
    }
  }, [viewerStatus]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => onControlEvent({ type: 'keydown', keyCode: e.keyCode });
    const handleKeyUp = (e: KeyboardEvent) => onControlEvent({ type: 'keyup', keyCode: e.keyCode });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onControlEvent]);

  // --- Handshake Watchdog (Force Image Recovery) ---
  useEffect(() => {
     const timer = setInterval(() => {
        if ((viewerStatus === 'streaming' || viewerStatus === 'connected' || viewerStatus === 'connecting') && !hasReceivedKeyframeRef.current && !remoteStream) {
           console.log('[Web] Screen timeout (black) - Requesting keyframe recovery...');
           onControlEvent({ type: 'request-keyframe' });
        }
     }, 4000); // 4s interval
     return () => clearInterval(timer);
  }, [viewerStatus, remoteStream, onControlEvent]);

  const handleMouseEvent = (e: React.MouseEvent, type: string) => {
    const target = (remoteStream ? videoRef.current : canvasRef.current) as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    onControlEvent({ type, button: (e as any).button, x, y });
  };

  const throttledMouseMove = useRef(0);
  const handleMouseMove = (e: React.MouseEvent) => {
    const now = Date.now();
    if (now - throttledMouseMove.current < 16) return; // ~60fps
    throttledMouseMove.current = now;
    handleMouseEvent(e, 'mousemove');
  };

  const handleTouchEvent = (e: React.TouchEvent, type: string) => {
    const target = (remoteStream ? videoRef.current : canvasRef.current) as HTMLElement;
    if (!target) return;
    // Handle touchend which doesn't have touches[0]
    const touch = e.touches.length > 0 ? e.touches[0] : e.changedTouches[0];
    if (!touch) return;
    const rect = target.getBoundingClientRect();
    const x = (touch.clientX - rect.left) / rect.width;
    const y = (touch.clientY - rect.top) / rect.height;
    onControlEvent({ type, button: 0, x, y });
  };

  const throttledTouchMove = useRef(0);
  const handleTouchMove = (e: React.TouchEvent) => {
    const now = Date.now();
    if (now - throttledTouchMove.current < 16) return;
    throttledTouchMove.current = now;
    handleTouchEvent(e, 'mousemove');
  };

  const renderVideoContent = () => (
    <div className="w-full h-full flex items-center justify-center relative bg-[#0A0A0A]">
      {remoteStream ? (
        <video 
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={(e) => {
            e.currentTarget.play().catch(console.error);
            forceRender({}); // Ensure render happens after video loads
          }}
          className={`transition-all duration-300 ${zoomMode === 'fit' ? 'w-full h-full object-contain' : 'w-auto h-auto object-none cursor-move'}`}
          style={{ minHeight: '100px', minWidth: '100px', backgroundColor: '#0A0A0A' }}
          onMouseMove={handleMouseMove}
          onMouseDown={(e) => handleMouseEvent(e, 'mousedown')}
          onMouseUp={(e) => handleMouseEvent(e, 'mouseup')}
          onTouchStart={(e) => handleTouchEvent(e, 'mousedown')}
          onTouchMove={handleTouchMove}
          onTouchEnd={(e) => handleTouchEvent(e, 'mouseup')}
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : (
        <div className="relative w-full h-full flex flex-col items-center justify-center bg-[#0A0A0A] cursor-crosshair">
          {!hasReceivedKeyframeRef.current && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0A0A0A]/90 backdrop-blur-md animate-pulse">
              <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-white/80 animate-spin mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)]" />
              <span className="text-[11px] font-bold text-white/90 uppercase tracking-[0.4em]">Connecting</span>
              <span className="text-[9px] text-white/40 mt-3 uppercase tracking-widest font-semibold">Waiting for Secure Stream...</span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            className={`transition-all duration-300 ${zoomMode === 'fit' ? 'w-full h-full object-contain' : 'w-auto h-auto object-none'} ${!hasReceivedKeyframeRef.current ? 'opacity-0' : 'opacity-100'}`}
            onMouseMove={handleMouseMove}
            onMouseDown={(e) => handleMouseEvent(e, 'mousedown')}
            onMouseUp={(e) => handleMouseEvent(e, 'mouseup')}
            onTouchStart={(e) => handleTouchEvent(e, 'mousedown')}
            onTouchMove={handleTouchMove}
            onTouchEnd={(e) => handleTouchEvent(e, 'mouseup')}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      )}
    </div>
  );

  if (viewerStatus === 'connection_lost') {
    return (
      <div className="min-h-screen bg-white flex flex-col relative overflow-hidden font-inter">
        <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-700">
          <div className="w-24 h-24 bg-red-50 rounded-[32px] flex items-center justify-center mb-8 border border-red-100 shadow-2xl">
            <MonitorOff className="text-red-500 w-10 h-10" />
          </div>
          <h2 className="text-4xl font-black text-[#1C1C1C] mb-4 uppercase tracking-tighter">Connection Fault</h2>
          <p className="text-[10px] text-[rgba(28,28,28,0.4)] mb-12 tracking-[0.2em] font-black uppercase">The remote node has severed the secure link</p>
          <div className="flex gap-4">
            <button 
              onClick={() => {
                closeSocket();
                navigate('/dashboard/devices');
              }}
              className="px-12 py-3 border border-[rgba(28,28,28,0.06)] rounded-xl font-bold text-xs uppercase hover:bg-[rgba(28,28,28,0.02)] transition-all"
            >
              TERMINATE
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-12 py-3 bg-[#1C1C1C] text-white rounded-xl font-bold text-xs uppercase shadow-xl shadow-black/10 hover:opacity-90 transition-all"
            >
              RE-ESTABLISH
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col relative overflow-hidden font-inter select-none">
      <div className="flex-grow flex flex-col min-h-0 relative z-10 bg-[#0A0A0A]">
        
        {/* SnowUI Premium Header */}
        <div className="h-20 flex items-center justify-between px-4 sm:px-8 bg-white border-b border-[rgba(28,28,28,0.06)] shadow-sm z-50">
          <div className="flex items-center gap-4 sm:gap-6">
            <button 
              onClick={() => navigate(-1)}
              className="p-3 bg-[#F8F9FA] hover:bg-[rgba(28,28,28,0.05)] text-[#1C1C1C] transition-all rounded-[14px] border border-[rgba(28,28,28,0.04)] active:scale-95"
              title="Terminate Link"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            
            <div className="flex items-center gap-3 sm:gap-4 border-l border-[rgba(28,28,28,0.06)] pl-4 sm:pl-6">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1C1C1C] rounded-[16px] flex items-center justify-center shadow-lg shadow-black/10">
                <Smartphone className="text-white w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-black text-[#1C1C1C] uppercase tracking-tighter">{deviceName}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-[9px] sm:text-[10px] text-[rgba(28,28,28,0.3)] font-black tracking-[0.2em]">{accessKey || deviceId}</p>
                  <div className="w-1 h-1 rounded-full bg-[rgba(28,28,28,0.1)]" />
                  <span className="text-[8px] sm:text-[9px] font-black text-blue-600 uppercase tracking-widest">{viewerStatus}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto custom-scrollbar pb-1 sm:pb-0">
              {transferProgress && (
                <div className="hidden sm:flex flex-col items-end gap-1.5 px-6 border-r border-[rgba(28,28,28,0.06)]">
                  <span className="text-[9px] font-black text-[#1C1C1C] uppercase tracking-[0.2em]">Deploying Payload...</span>
                  <div className="w-32 h-1 bg-[#F8F9FA] rounded-full overflow-hidden border border-[rgba(28,28,28,0.04)]">
                    <div className="h-full bg-[#1C1C1C] transition-all duration-300" style={{ width: `${transferProgress.p}%` }} />
                  </div>
                </div>
              )}
              
              <div className="flex bg-[#F8F9FA] p-1.5 border border-[rgba(28,28,28,0.06)] rounded-none gap-1 shrink-0">
                 <button onClick={() => setZoomMode(zoomMode === 'fit' ? 'original' : 'fit')} className={`p-2 transition-all rounded-none ${zoomMode === 'original' ? 'bg-[#1C1C1C] text-white' : 'text-[#1C1C1C]/40 hover:text-[#1C1C1C] hover:bg-white'}`} title="Scale Toggle">
                   <Search size={16} />
                 </button>
                 <button onClick={() => {
                   if (!document.fullscreenElement) {
                     containerRef.current?.requestFullscreen();
                   } else {
                     document.exitFullscreen();
                   }
                 }} className="p-2 hover:bg-white text-[#1C1C1C]/40 hover:text-[#1C1C1C] transition-all rounded-none" title="Full Screen">
                   <Monitor size={16} />
                 </button>
                 <div className="w-px h-5 bg-[rgba(28,28,28,0.06)] mx-1 self-center" />
                 <button onClick={() => onControlEvent({ type: 'action', action: 'volume_down' })} className="p-2 hover:bg-white text-[#1C1C1C]/40 hover:text-[#1C1C1C] transition-all rounded-none" title="Task Manager"><Activity size={16} /></button>
                 <button onClick={() => onControlEvent({ type: 'action', action: 'browser' })} className="p-2 hover:bg-white text-[#1C1C1C]/40 hover:text-[#1C1C1C] transition-all rounded-none" title="Browser"><Globe size={16} /></button>
                 <button onClick={() => onControlEvent({ type: 'action', action: 'explorer' })} className="p-2 hover:bg-white text-[#1C1C1C]/40 hover:text-[#1C1C1C] transition-all rounded-none" title="File Explorer"><Folder size={16} /></button>
                 <div className="w-px h-5 bg-[rgba(28,28,28,0.06)] mx-1 self-center" />
                 <button onClick={() => onControlEvent({ type: 'request-keyframe' })} className="p-2 hover:bg-emerald-50 text-emerald-500/60 hover:text-emerald-600 transition-all rounded-none" title="Refresh Stream"><RefreshCw size={16} /></button>
                 <div className="w-px h-5 bg-[rgba(28,28,28,0.06)] mx-1 self-center" />
                 <button onClick={() => onControlEvent({ type: 'action', action: 'lock' })} className="p-2 hover:bg-blue-50 text-blue-500/60 hover:text-blue-600 transition-all rounded-none" title="Lock Screen"><Lock size={16} /></button>
                 <button onClick={() => onControlEvent({ type: 'action', action: 'shutdown' })} className="p-2 hover:bg-red-50 text-red-500/60 hover:text-red-600 transition-all rounded-none" title="Emergency Shutdown"><Power size={16} /></button>
              </div>
              
              <div className="hidden lg:flex items-center gap-3 ml-4">
                <span className="px-2 py-0.5 rounded-full border border-emerald-500 text-[9px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-50">STABLE</span>
                <div className="flex flex-col items-end">
                  <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none">Signal Optimal</span>
                  <span className="text-[10px] font-mono text-[rgba(28,28,28,0.3)] mt-0.5">{activeSession?.latency || 0}ms</span>
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  
                  const CHUNK_SIZE = 16 * 1024; // 16KB
                  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

                  setTransferProgress({ name: file.name, p: 0 });

                  for (let i = 0; i < totalChunks; i++) {
                    const start = i * CHUNK_SIZE;
                    const end = Math.min(start + CHUNK_SIZE, file.size);
                    const chunk = file.slice(start, end);
                    const arrayBuffer = await chunk.arrayBuffer();
                    
                    const header = JSON.stringify({
                      type: 'file-chunk',
                      name: file.name,
                      totalSize: file.size,
                      offset: start,
                      chunkIndex: i,
                      totalChunks: totalChunks
                    });
                    
                    const headerBuffer = new TextEncoder().encode(header);
                    const fullBuffer = new Uint8Array(4 + headerBuffer.length + arrayBuffer.byteLength);
                    const view = new DataView(fullBuffer.buffer);
                    view.setUint32(0, headerBuffer.length, true);
                    fullBuffer.set(headerBuffer, 4);
                    fullBuffer.set(new Uint8Array(arrayBuffer), 4 + headerBuffer.length);
                    
                    onControlEvent(fullBuffer);
                    setTransferProgress({ name: file.name, p: Math.round(((i + 1) / totalChunks) * 100) });
                    
                    if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
                  }
                  
                  setTimeout(() => setTransferProgress(null), 2000);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/20 text-blue-400 transition ml-2 shrink-0"
                title="Transfer File"
              >
                <Plus size={16} />
              </button>
          </div>
        </div>

        {/* Video Player Area */}
        <div 
          ref={containerRef}
          className={`flex-grow flex items-center justify-center relative overflow-hidden bg-[#0A0A0A] ${zoomMode === 'original' ? 'cursor-grab active:cursor-grabbing overflow-auto custom-scrollbar' : ''}`}
          style={{ minHeight: '50vh' }}
        >
          <div className="w-full h-full relative group">
            {renderVideoContent()}
            {/* Subtle vignette effect for premium look */}
            <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionViewer;
