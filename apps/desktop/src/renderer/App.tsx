import React, { useState, useEffect, useRef } from 'react';
// Force-syncing file state to resolve HMR/Vite discrepancies.
import {
  Activity, Monitor, ArrowLeft, ArrowRight, Zap, LogOut, Copy, Settings, MousePointer2, Loader2, Play, KeyRound, Shield, Smartphone, Plus, Search, MoreVertical, CheckCircle2, X,
  RefreshCw, Eye, EyeOff, CreditCard, Power, Lock, Mail, Link, Sun, Moon, Edit2, Trash2, ShieldOff, LayoutGrid, PlusCircle, Radio, ShieldCheck, ArrowRightCircle, Check, DownloadCloud, MonitorOff, User,
  Globe, Folder, Maximize
} from 'lucide-react';

import { useImperativeHandle, forwardRef } from 'react';
import api from './lib/api';
import { useAuthStore } from './store/authStore';
import { SnowDashboard } from './components/SnowDashboard';
import { SnowSidebar } from './components/SnowSidebar';
import { SnowDevices } from './components/SnowDevices';
import { SnowRightBar } from './components/SnowRightBar';
import { SnowHost } from './components/SnowHost';
import { SnowBilling } from './components/SnowBilling';
import { SnowDocumentation } from './components/SnowDocumentation';
import { SnowProfile } from './components/SnowProfile';
import { SnowSupport } from './components/SnowSupport';
import { SnowSplashScreen } from './components/SnowSplashScreen';

const mockPerformanceData = [
  { time: '10:00', latency: 45, network: 120 },
  { time: '10:01', latency: 48, network: 132 },
  { time: '10:02', latency: 40, network: 145 },
  { time: '10:03', latency: 50, network: 110 },
  { time: '10:04', latency: 38, network: 160 },
  { time: '10:05', latency: 42, network: 155 },
];
// --- Premium Mobile Device Frame ---
// Legacy frames removed for clean theater mode.

// --- Video Player Component (Hybrid: WebRTC Track + Legacy WebCodecs) ---
interface VideoPlayerProps {
  viewerStatus: string;
  setViewerStatus: (status: any) => void;
  sessionCode: string;
  onDisconnect: () => void;
  onControlEvent: (event: any) => void;
  remoteStream: MediaStream | null;
  deviceType?: string;
  deviceName?: string;
}
const VideoPlayer = forwardRef<any, VideoPlayerProps>(({ 
  viewerStatus, 
  setViewerStatus, 
  sessionCode, 
  onDisconnect,
  onControlEvent,
  remoteStream,
  deviceType,
  deviceName
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const decoderRef = useRef<any>(null);
  const [latency, setLatency] = useState(0);
  const [transferProgress, setTransferProgress] = useState<{name: string, p: number} | null>(null);
  const [zoomMode, setZoomMode] = useState<'fit' | 'original'>('fit');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasReceivedKeyframe, setHasReceivedKeyframe] = useState(false);
  const reassemblyMap = useRef(new Map<bigint, { fragments: (Uint8Array | null)[], count: number, total: number }>());

  useImperativeHandle(ref, () => ({
    feed: (data: Uint8Array) => {
      if (remoteStream) return; // Ignore custom data if using standard stream
      
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
          if (f) {
            fullNAL.set(f, offset);
            offset += f.length;
          }
        }
        
        feedToDecoder(fullNAL, ts);
        reassemblyMap.current.delete(ts);
        
        if (reassemblyMap.current.size > 20) {
          const oldestTs = Array.from(reassemblyMap.current.keys()).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
          reassemblyMap.current.delete(oldestTs[0]);
        }
      }
    }
  }));

  const feedToDecoder = (chunkData: Uint8Array, timestamp: bigint) => {
    if (!decoderRef.current || decoderRef.current.state !== 'configured') return;
    
    const now = Date.now();
    const msTimestamp = Number(timestamp / 1000n);
    const frameLatency = now - msTimestamp;
    if (Math.random() < 0.05) setLatency(frameLatency);

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
                if (!hasReceivedKeyframe) {
                    console.log(`[VideoPlayer] Initial Keyframe Found (type:${nalType})`);
                    setHasReceivedKeyframe(true);
                }
                break;
            }
        }
    }

    if (!hasReceivedKeyframe) {
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

  // --- Handshake Watchdog (Force Image Recovery) ---
  useEffect(() => {
     let timer: any;
     // Watchdog should start if we are "connecting" or "connected" but no data has flowed for 5 seconds
     if ((viewerStatus === 'streaming' || viewerStatus === 'connected' || viewerStatus === 'connecting') && !hasReceivedKeyframe && !remoteStream) {
        timer = setTimeout(() => {
           console.log('[VideoPlayer] Screen timeout (black) - Requesting keyframe recovery...');
           onControlEvent({ type: 'request-keyframe' });
        }, 5000); // 5s timeout
     }
     return () => clearTimeout(timer);
  }, [viewerStatus, hasReceivedKeyframe, remoteStream, onControlEvent]);

  const initDecoder = () => {
    if (remoteStream || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (decoderRef.current) {
       try { decoderRef.current.close(); } catch {}
    }

    const VideoDecoder = (window as any).VideoDecoder;
    if (!VideoDecoder) {
      console.warn('[VideoPlayer] VideoDecoder not available in this environment.');
      return;
    }

    const decoder = new VideoDecoder({
      output: (frame: any) => {
        if (!canvasRef.current || (decoderRef.current && decoderRef.current.state === 'closed')) {
          frame.close();
          return;
        }
        if (!hasReceivedKeyframe) setHasReceivedKeyframe(true);
        if (Math.random() < 0.01) console.log(`[VideoPlayer] Output Frame: ${frame.displayWidth}x${frame.displayHeight}`);
        try {
          ctx.drawImage(frame, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
        } catch (err) {
          console.error('[VideoPlayer] Draw error:', err);
        }
        frame.close();
      },
      error: (e: any) => {
        console.error('[VideoPlayer] Decoder hardware error:', e);
        setHasReceivedKeyframe(false);
        setTimeout(initDecoder, 1000);
      },
    });

    decoder.configure({
      codec: 'avc1.42E029', 
      optimizeForLatency: true,
    });
    
    decoderRef.current = decoder;
    console.log('[VideoPlayer] Decoder initialized.');
  };

  useEffect(() => {
    initDecoder();
    return () => {
      if (decoderRef.current) decoderRef.current.close();
      decoderRef.current = null;
    };
  }, [remoteStream]);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      // Explicitly trigger play to override browser auto-play restrictions
      videoRef.current.play().catch(err => {
        console.warn('[VideoPlayer] Auto-play blocked, wait for user interaction:', err);
      });
    }
  }, [remoteStream]);

  const handleMouseEvent = (e: React.MouseEvent, type: string) => {
    const target = remoteStream ? videoRef.current : canvasRef.current;
    const rect = target?.getBoundingClientRect();
    if (rect) {
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      onControlEvent({ type, button: (e as any).button, x, y });
    }
  };

  const renderContent = () => (
    <div className="w-full h-full flex items-center justify-center relative bg-[#0A0A0A]">
      {remoteStream ? (
        <video 
          ref={videoRef}
          autoPlay
          muted
          playsInline
          onLoadedMetadata={(e) => e.currentTarget.play().catch(console.error)}
          className={`transition-all duration-300 ${zoomMode === 'fit' ? 'w-full h-full object-contain' : 'w-auto h-auto object-none cursor-move'}`}
          style={{ minHeight: '100px', minWidth: '100px', backgroundColor: '#0A0A0A' }}
          onMouseMove={(e) => handleMouseEvent(e, 'mousemove')}
          onMouseDown={(e) => handleMouseEvent(e, 'mousedown')}
          onMouseUp={(e) => handleMouseEvent(e, 'mouseup')}
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : (
        <div className="relative w-full h-full flex items-center justify-center bg-[#0A0A0A]">
          {!hasReceivedKeyframe && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0A0A0A]/90 backdrop-blur-md animate-pulse">
              <div className="w-12 h-12 rounded-full border-2 border-white/10 border-t-white/80 animate-spin mb-6 shadow-[0_0_30px_rgba(255,255,255,0.1)]" />
              <span className="text-[11px] font-bold text-white/90 uppercase tracking-[0.4em]">Synclink Standby</span>
              <span className="text-[9px] text-white/40 mt-3 uppercase tracking-widest font-semibold">Requesting Secure Frame...</span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            width={1920}
            height={1080}
            className={`transition-all duration-300 ${zoomMode === 'fit' ? 'w-full h-full object-contain' : 'w-auto h-auto object-none cursor-move'} ${!hasReceivedKeyframe ? 'opacity-0' : 'opacity-100'}`}
            onMouseMove={(e) => handleMouseEvent(e, 'mousemove')}
            onMouseDown={(e) => handleMouseEvent(e, 'mousedown')}
            onMouseUp={(e) => handleMouseEvent(e, 'mouseup')}
            onContextMenu={(e) => e.preventDefault()}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col animate-in fade-in duration-700 relative bg-white">
      {/* SnowUI Premium Header */}
      <div className="h-20 flex items-center justify-between px-4 sm:px-8 bg-white border-b border-[rgba(28,28,28,0.06)] shadow-sm z-50 overflow-x-auto custom-scrollbar">
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          <button 
            onClick={onDisconnect}
            className="p-3 bg-[#F8F9FA] hover:bg-[#EAEAEA] text-[#1C1C1C] transition-all rounded-[14px] border border-[rgba(28,28,28,0.04)] active:scale-95"
            title="Terminate Link"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4 border-l border-[rgba(28,28,28,0.06)] pl-4 sm:pl-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-[#1C1C1C] rounded-[16px] flex items-center justify-center shadow-lg shadow-black/10">
              <Smartphone className="text-white w-5 h-5 sm:w-6 h-6" />
            </div>
            <div>
              <h2 className="text-sm font-black text-[#1C1C1C] uppercase tracking-tighter truncate max-w-[100px] sm:max-w-[200px]">{deviceName || 'Remote Node'}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <p className="text-[10px] text-[rgba(28,28,28,0.3)] font-black tracking-[0.2em]">{sessionCode}</p>
                <div className="w-1 h-1 rounded-full bg-[rgba(28,28,28,0.1)]" />
                <span className="text-[9px] font-black text-blue-600 uppercase tracking-widest">{viewerStatus}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            {transferProgress && (
              <div className="hidden sm:flex flex-col items-end gap-1.5 px-6 border-r border-[rgba(28,28,28,0.06)]">
                <span className="text-[9px] font-black text-[#1C1C1C] uppercase tracking-[0.2em]">Deploying Payload...</span>
                <div className="w-32 h-1 bg-[#F8F9FA] rounded-full overflow-hidden border border-[rgba(28,28,28,0.04)]">
                  <div className="h-full bg-[#1C1C1C] transition-all duration-300" style={{ width: `${transferProgress.p}%` }} />
                </div>
              </div>
            )}
            
            <div className="flex bg-[#F8F9FA] p-1 sm:p-1.5 border border-[rgba(28,28,28,0.06)] rounded-none gap-1 shrink-0">
               <button onClick={() => setZoomMode(zoomMode === 'fit' ? 'original' : 'fit')} className={`p-2 sm:p-2.5 transition-all rounded-none ${zoomMode === 'original' ? 'bg-[#1C1C1C] text-white' : 'text-[#1C1C1C]/40 hover:text-[#1C1C1C] hover:bg-white'}`} title="Scale Toggle">
                 <Search className="w-3 h-3 sm:w-4 sm:h-4" />
               </button>
               <button onClick={() => {
                 if (!document.fullscreenElement) {
                   containerRef.current?.requestFullscreen();
                   setIsFullScreen(true);
                 } else {
                   document.exitFullscreen();
                   setIsFullScreen(false);
                 }
               }} className="p-2 sm:p-2.5 hover:bg-white text-[#1C1C1C]/40 hover:text-[#1C1C1C] transition-all rounded-none" title="Full Screen">
                 <Monitor className="w-3 h-3 sm:w-4 sm:h-4" />
               </button>
               <div className="w-px h-5 bg-[rgba(28,28,28,0.06)] mx-1 self-center" />
               <button 
                 onMouseDown={() => {
                   onControlEvent({ type: 'action', action: 'volume_down' });
                   const interval = setInterval(() => {
                     onControlEvent({ type: 'action', action: 'task_manager' });
                   }, 100);
                   const cleanup = () => { clearInterval(interval); window.removeEventListener('mouseup', cleanup); };
                   window.addEventListener('mouseup', cleanup);
                 }} 
                 className="p-2 sm:p-2.5 hover:bg-white text-[#1C1C1C]/40 hover:text-[#1C1C1C] transition-all rounded-none" 
                 title="Vol -"
               >
                 <Activity size={16} className="w-3 h-3 sm:w-4 sm:h-4" />
               </button>
               <button 
                 onMouseDown={() => {
                   onControlEvent({ type: 'action', action: 'volume_up' });
                   const interval = setInterval(() => {
                     onControlEvent({ type: 'action', action: 'browser' });
                   }, 100);
                   const cleanup = () => { clearInterval(interval); window.removeEventListener('mouseup', cleanup); };
                   window.addEventListener('mouseup', cleanup);
                 }} 
                 className="p-2 sm:p-2.5 hover:bg-white text-[#1C1C1C]/40 hover:text-[#1C1C1C] transition-all rounded-none" 
                 title="Vol +"
               >
                 <Globe size={16} className="w-3 h-3 sm:w-4 sm:h-4" />
               </button>
               <button onClick={() => onControlEvent({ type: 'action', action: 'explorer' })} className="p-2 sm:p-2.5 hover:bg-white text-[#1C1C1C]/40 hover:text-[#1C1C1C] transition-all rounded-none" title="File Explorer"><Folder size={16} className="w-3 h-3 sm:w-4 sm:h-4" /></button>
               <div className="w-px h-5 bg-[rgba(28,28,28,0.06)] mx-1 self-center" />
               <button onClick={() => onControlEvent({ type: 'request-keyframe' })} className="p-2 sm:p-2.5 hover:bg-emerald-50 text-emerald-500/60 hover:text-emerald-600 transition-all rounded-none" title="Refresh Stream"><RefreshCw size={16} className="w-3 h-3 sm:w-4 sm:h-4" /></button>
               <div className="w-px h-5 bg-[rgba(28,28,28,0.06)] mx-1 self-center" />
               <button onClick={() => onControlEvent({ type: 'action', action: 'lock' })} className="p-2 sm:p-2.5 hover:bg-blue-50 text-blue-500/60 hover:text-blue-600 transition-all rounded-none hidden sm:block" title="Lock Screen"><Lock size={16} className="w-4 h-4" /></button>
               <button onClick={() => onControlEvent({ type: 'action', action: 'shutdown' })} className="p-2 sm:p-2.5 hover:bg-red-50 text-red-500/60 hover:text-red-600 transition-all rounded-none hidden sm:block" title="Emergency Shutdown"><Power size={16} className="w-4 h-4" /></button>
            </div>
            
            <div className="hidden md:flex items-center gap-3 ml-2 sm:ml-4 shrink-0">
              <span className="badge-online">CONNECTED</span>
              <div className="flex flex-col items-end">
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest leading-none">Signal Stable</span>
                <span className="text-[10px] font-mono text-[rgba(28,28,28,0.2)] mt-0.5">{latency}ms</span>
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
              className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/20 text-blue-400 transition hidden sm:block shrink-0"
              title="Transfer File"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="flex sm:hidden items-center gap-2 px-2 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20 shrink-0">
              <Activity className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">
                {latency <= 0 ? 'STABLE' : `${latency}ms`}
              </span>
            </div>
        </div>
      </div>
      
      <div 
        ref={containerRef}
        className={`flex-grow flex items-center justify-center relative overflow-hidden bg-[#0A0A0A] ${zoomMode === 'original' ? 'cursor-grab active:cursor-grabbing overflow-auto custom-scrollbar' : ''}`}
        style={{ minHeight: '50vh' }}
      >
        <div className="w-full h-full relative group">
          {renderContent()}
          {/* Subtle vignette effect for premium look */}
          <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.5)]" />
        </div>
      </div>
    </div>
  );
});

// --- Main App Component ---
export default function App() {
  const isElectron = !!(window as any).electronAPI;

  useEffect(() => {
    document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', 'light');
  }, []);

  const [loading, setLoading] = useState(true);
  const [showSplash, setShowSplash] = useState(false);
  const { user, accessToken, login: storeLogin, register: storeRegister, logout: storeLogout, checkAuth, setAuth } = useAuthStore();
  const isAuthenticated = !!accessToken;

  const [currentView, setCurrentView] = useState<'dashboard' | 'devices' | 'settings' | 'host' | 'billing' | 'documentation' | 'profile' | 'support'>('dashboard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [sessionCode, setSessionCode] = useState('');
  const [accessPassword, setAccessPassword] = useState('');
  const [showManualPassword, setShowManualPassword] = useState(false);
  // Initialize as viewer window early if URL points to it
  const isViewer = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('view') === 'viewer';
  const [isViewerWindow, setIsViewerWindow] = useState(isViewer);
  
  // Persistent Client ID for signaling stability (survives re-mounts/Strict Mode)
  const [viewerClientId] = useState(() => {
    if (typeof window === 'undefined') return '';
    let cid = sessionStorage.getItem('viewer_client_id');
    if (!cid) {
      cid = 'v-' + Math.random().toString(36).substring(2, 15);
      sessionStorage.setItem('viewer_client_id', cid);
    }
    return cid;
  });
  
  const [windowDeviceName, setWindowDeviceName] = useState('');
  const [errorModal, setErrorModal] = useState<{show: boolean, title: string, message: string} | null>(null);

  const showError = (title: string, message: string) => {
    setErrorModal({ show: true, title: title || 'System Error', message });
  };

  const [hostSessionId, setHostSessionId] = useState('');
  const [hostStatus, setHostStatus] = useState<'idle' | 'connecting' | 'error' | 'status' | ''>('');
  const [hostMessage, setHostMessage] = useState('');
  const [hostError, setHostError] = useState('');
  const [hostAccessKey, setHostAccessKey] = useState('');
  const [devicePassword, setDevicePassword] = useState(localStorage.getItem('device_password') || '');
  const [isAutoHostEnabled, setIsAutoHostEnabled] = useState(localStorage.getItem('is_auto_host_enabled') === 'true');
  const [showHostPassword, setShowHostPassword] = useState(false);

  const [serverIP, setServerIP] = useState(localStorage.getItem('remote_link_server_ip') || '127.0.0.1');
  const [localIP, setLocalIP] = useState('127.0.0.1');
  const [showSettings, setShowSettings] = useState(false);
  const [isPackaged, setIsPackaged] = useState(false);

  useEffect(() => {
    if ((window as any).electronAPI?.isPackaged) {
      (window as any).electronAPI.isPackaged().then(setIsPackaged);
    }
  }, []);

  const getApiUrl = (port: number, path: string) => {
    if (isPackaged) {
      // In production, everything goes through the proxy on 443
      // Billing is mounted at /billing in production (see Caddyfile)
      // Signal is /api/signal, etc. But if the path is /billing/current, we don't prepend /api
      return `https://${serverIP}${path}`;
    }
    return `http://${serverIP}:${port}${path}`;
  };

  const [viewerStatus, setViewerStatus] = useState<'idle' | 'connecting' | 'error' | 'connected' | 'streaming' | 'connection_lost'>('idle');
  const [viewerError, setViewerError] = useState('');
  const videoPlayerRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const candidatesBuffer = useRef<RTCIceCandidateInit[]>([]);
  const controlChannelRef = useRef<RTCDataChannel | null>(null);
  const volumeIntervalRef = useRef<any>(null);
  const reassemblyMap = useRef<Map<bigint, any>>(new Map());

  // Throttled mouse movement
  const lastMouseMoveRef = useRef<number>(0);
  const MOUSE_THROTTLE_MS = 16; // ~60fps mouse updates

  const throttledMouseMove = (event: any) => {
    const now = Date.now();
    if (now - lastMouseMoveRef.current < MOUSE_THROTTLE_MS) return;
    lastMouseMoveRef.current = now;
    if (controlChannelRef.current?.readyState === 'open') {
        controlChannelRef.current.send(JSON.stringify(event));
    }
  };

  const handleLogout = async () => {
    await storeLogout();
  };
  const lastClipboardRef = useRef<string>('');
  
  
  // --- New Device Management State ---
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<any | null>(null); // { device }
  const [promptPassword, setPromptPassword] = useState('');
  const [promptRemember, setPromptRemember] = useState(true);
  const [showPromptPassword, setShowPromptPassword] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addKey, setAddKey] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [showAddPassword, setShowAddPassword] = useState(false);

  const [contextMenuMsg, setContextMenuMsg] = useState(''); // Tooltip offline
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState('');

  const [actionModal, setActionModal] = useState<{ type: 'rename' | 'password' | 'remove' | 'regenerate', device: any } | null>(null);
  const [actionValue, setActionValue] = useState('');

  // --- Dynamic Notifications ---
  const [notifications, setNotifications] = useState<any[]>([
    { action: 'Security scan completed.', time: 'Just now', icon: ShieldCheck, color: 'bg-[#E6F1FD]' },
    { action: 'Client initialized.', time: 'Just now', icon: Activity, color: 'bg-[#E6F1FD]' },
  ]);

  const addNotification = (action: string, iconType: 'host' | 'security' | 'session' | 'system' = 'system') => {
    const iconMap = {
      host: Radio,
      security: ShieldCheck,
      session: User,
      system: Activity
    };
    const colorMap = {
      host: 'bg-[#EDEEFC]',
      security: 'bg-[#E6F1FD]',
      session: 'bg-[#F2F2F2]',
      system: 'bg-[#E6F1FD]'
    };
    
    const newNotif = {
      action,
      time: 'Just now',
      icon: iconMap[iconType],
      color: colorMap[iconType]
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 9)]);
  };

  // Sync actionValue when modal opens
  useEffect(() => {
    if (actionModal) {
      if (actionModal.type === 'rename') setActionValue(actionModal.device.device_name || '');
      else if (actionModal.type === 'password') setActionValue('');
      else setActionValue('');
    }
  }, [actionModal]);

  useEffect(() => {
    const handleGlobalClick = () => { if (contextMenuId) setContextMenuId(null); };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, [contextMenuId]);

  const handleDisconnect = () => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setRemoteStream(null);
    setViewerStatus('idle');
    pollDevices();
  };

  // Initialize Viewer Window from URL - runs only once on true mount
  const viewerConnectedRef = useRef(false);
  useEffect(() => {
    if (viewerConnectedRef.current) return; // Guard for React Strict Mode double-fire
    const params = new URLSearchParams(window.location.search);
    if (params.get('view') === 'viewer') {
      viewerConnectedRef.current = true;
      const sid = params.get('sessionId') || '';
      const sip = params.get('serverIP') || '';
      const tok = params.get('token') || '';
      const dname = params.get('deviceName') || '';
      
      setSessionCode(sid);
      setServerIP(sip);
      setAuth({ email: 'node.viewer@synclink.io' } as any, tok, '', false); 
      setWindowDeviceName(dname);
      
      console.log(`[Window] Launched in Viewer Mode for Node: ${sid}`);
      console.log(`[Window] Joining with Persistent ID: ${viewerClientId}`);
      
      setViewerStatus('connecting');
      if (isElectron) {
        (window as any).electronAPI.connectToHost(sid, sip, tok, viewerClientId).then(() => {
           setViewerStatus('connected');
        }).catch((e: any) => {
           viewerConnectedRef.current = false; // Allow retry on error
           showError('Mesh Fault', e.message || 'The secure connection could not be established.');
        });
      } else {
        showError('Browser Limitation', 'Mesh connections require the native desktop application.');
        setViewerStatus('error');
      }
    }
  }, []); // Empty deps: only run once on mount

  useEffect(() => {
    if (!isElectron) return;
    const removeHostStatusListener = (window as any).electronAPI.onHostStatus((status: string) => {
      console.log(`[Renderer] Host Status: ${status}`);
      if (status.startsWith('Registered:')) {
        const sid = status.split('Registered: ')[1];
        setHostSessionId(sid);
        setHostStatus('status');
      } else if (status.startsWith('WebRTC:')) {
        setHostStatus('status');
      } else if (status === 'error' || status === 'disconnected') {
        setHostStatus('idle');
      }
    });
    return () => removeHostStatusListener();
  }, [isElectron]);

  const pollDevices = async () => {
    try {
      const { data } = await api.get('/api/devices/mine');
      setDevices(data);
      setGlobalError('');
      
      // Auto-sync local host status if we find ourselves in the list as online
      const self = data.find((d: any) => d.access_key === hostAccessKey);
      if (self && self.is_online) {
        setHostStatus('status');
        setHostSessionId(self.access_key);
      }
    } catch (e: any) {
      if (e.response?.status === 401 && !isViewerWindow) {
        // Handled by api interceptor mostly, but ensure we reflect it
        handleLogout();
        showError('Session Expired', 'Your authentication session has timed out. Please sign in again.');
      }
    }
  };

  useEffect(() => {
    if (isAuthenticated && (accessToken || isViewerWindow)) {
      // If we are a viewer window and don't have a token yet, wait for it
      if (isViewerWindow && !accessToken) return;
      
      pollDevices();
      
      // Establish long-lived presence monitor
      const getWsUrl = () => {
        if (isPackaged) {
           return `wss://${serverIP}/api/signal`;
        }
        return `ws://${serverIP}:3002`;
      };
      const wsUrl = getWsUrl();
      const monitor = new WebSocket(wsUrl);
      
      monitor.onopen = () => {
        api.get('/api/devices/mine').then(({ data }) => {
          setDevices(data);
          // Standardize keys before subscription to signaling service (V5 Sync)
          const keys = data.map((d: any) => String(d.access_key || '').toLowerCase().replace(/\s/g, ''));
          monitor.send(JSON.stringify({ 
             type: 'subscribe-presence', 
             accessKeys: keys
          }));
        }).catch(err => {
          console.error('[Monitor] Initial fetch failed:', err);
        });
      };

      monitor.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'presence-update') {
             // Robust Case-Insensitive & Space-Agnostic Comparison (V5 Hardening)
             const incomingId = String(data.sessionId || '').toLowerCase().replace(/\s/g, '');
             
             // Check if status changed to add notification
             const deviceMatch = devices.find(d => String(d.access_key || '').toLowerCase().replace(/\s/g, '') === incomingId);
             if (deviceMatch && deviceMatch.is_online !== (data.status === 'online')) {
               addNotification(`${deviceMatch.device_name} is now ${data.status}`, 'host');
             }
             
             setDevices(prev => prev.map(d => {
               const localId = String(d.access_key || '').toLowerCase().replace(/\s/g, '');
               return localId === incomingId 
                ? { ...d, is_online: data.status === 'online' } 
                : d;
             }));
          }
        } catch {}
      };
      
      const handleFocus = () => pollDevices();
      window.addEventListener('focus', handleFocus);
      
      return () => {
        monitor.close();
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [isAuthenticated, accessToken, serverIP, isViewerWindow]);
  
  // Handlers for the UI
  const handleDeviceClick = async (device: any) => {
    if (!device.is_online) {
      showError('Endpoint Unreachable', `${device.device_name} is currently offline. Please ensure the host service is running.`);
      return;
    }
    
    // Attempt direct connection bypass
    try {
      const { data } = await api.post('/api/devices/verify-access', { accessKey: device.access_key, password: '' });
      // Launch in NEW WINDOW
      if (isElectron) {
        await (window as any).electronAPI.openViewerWindow(device.access_key, serverIP, data.token, device.device_name);
      }
    } catch (e: any) {
      if (e.response?.status === 401) {
        setShowPasswordPrompt(device);
        setPromptPassword('');
        setPromptRemember(false);
      } else {
        showError('Handshake Failed', e.response?.data?.error || e.message || 'The secure connection could not be established.');
      }
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => api.delete(`/api/devices/${id}`)));
      pollDevices();
      setGlobalError(`Successfully removed ${ids.length} devices.`);
    } catch (e: any) {
      setGlobalError('Failed to remove some devices: ' + e.message);
    }
  };

  const submitPasswordPrompt = async () => {
    if (!showPasswordPrompt || !promptPassword) return;
    const device = showPasswordPrompt;
    setViewerStatus('connecting');
    try {
      const { data } = await api.post('/api/devices/verify-access', { accessKey: device.access_key, password: promptPassword });
      if (promptRemember) {
          await api.post(`/api/devices/${device.id}/trust`);
      }
      if (isElectron) {
        await (window as any).electronAPI.connectToHost(device.access_key, serverIP, data.token);
      }
      setSessionCode(device.access_key);
      setViewerStatus('connected');
      setShowPasswordPrompt(null);
    } catch (e: any) {
      setViewerStatus('idle');
      setGlobalError(e.message || 'Connection failed.');
    }
  };

  const handleAddDevice = async () => {
    try {
      await api.post('/api/devices/add-existing', { accessKey: addKey.replace(/\s/g, ''), password: addPassword });
      setShowAddModal(false);
      setAddKey('');
      setAddPassword('');
      pollDevices();
    } catch (e: any) {
      setGlobalError(e.response?.data?.error || e.message || 'Network error adding device');
    }
  };

  const handleRename = async (device: any) => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      await api.patch(`/api/devices/${device.id}/name`, { device_name: actionValue });
      pollDevices();
      setActionModal(null);
      if (selectedDevice?.id === device.id) setSelectedDevice({ ...selectedDevice, device_name: actionValue });
    } catch (e: any) { setGlobalError(e.message); }
  };

  const handleRemove = async (device: any) => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      await api.delete(`/api/devices/${device.id}`);
      pollDevices();
      setActionModal(null);
      if (selectedDevice?.id === device.id) setSelectedDevice(null);
    } catch (e: any) { setGlobalError(e.message); }
  };

  const handleRevokeTrust = async (id: string) => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      await api.delete(`/api/devices/${id}/trust`);
      setGlobalError('Success: Trust revoked for this device.');
      pollDevices();
    } catch (e) {}
  };



  const handleSetPassword = async (device: any) => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      
      // If "device" is null, we are updating the local machine's access password
      if (!device) {
         setDevicePassword(actionValue);
         localStorage.setItem('device_password', actionValue);
         if (deviceId) {
            await api.post('/api/devices/set-password', { deviceId: deviceId, password: actionValue });
         }
         setActionModal(null);
         setActionValue('');
      } else {
         await api.post('/api/devices/set-password', { deviceId: device.id, password: actionValue });
         pollDevices();
         setActionModal(null);
         setActionValue('');
      }
    } catch (e: any) { setGlobalError(e.message); }
  };


  const [deviceId, setDeviceId] = useState('');
  const [viewerStep, setViewerStep] = useState<1 | 2>(1);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (viewerStatus === 'streaming' && controlChannelRef.current?.readyState === 'open') {
        controlChannelRef.current.send(JSON.stringify({ type: 'keydown', keyCode: e.keyCode }));
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (viewerStatus === 'streaming' && controlChannelRef.current?.readyState === 'open') {
        controlChannelRef.current.send(JSON.stringify({ type: 'keyup', keyCode: e.keyCode }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [viewerStatus]);

  useEffect(() => {
    if (viewerStatus !== 'streaming' || !isElectron) return;
    const interval = setInterval(async () => {
      const text = await (window as any).electronAPI.clipboard.readText();
      if (text && text !== lastClipboardRef.current) {
        lastClipboardRef.current = text;
        if (controlChannelRef.current?.readyState === 'open') {
          controlChannelRef.current.send(JSON.stringify({ type: 'clipboard', text }));
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [viewerStatus]);

  const [showBillingModal, setShowBillingModal] = useState(false);
  const [billingPlans, setBillingPlans] = useState<any[]>([]);
  const [currentPlan, setCurrentPlan] = useState<any>(null);
  const [billingLoading, setBillingLoading] = useState(false);

  const [fileReceivedModal, setFileReceivedModal] = useState<{name: string, path: string} | null>(null);

  useEffect(() => {
    if (!isElectron) return;
    const api = (window as any).electronAPI;
    if (!api?.onFileReceived) return;
    const unsub = api.onFileReceived((data: any) => {
      setFileReceivedModal(data);
    });
    return () => unsub();
  }, [isElectron]);

  const fetchBillingInfo = async () => {
    try {
      setShowBillingModal(true);
      setBillingLoading(true);
      const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
      if (!creds?.token) return;

      const [plansRes, currentRes] = await Promise.all([
        fetch(getApiUrl(3003, '/billing/plans')),
        fetch(getApiUrl(3003, '/billing/current'), {
          headers: { 'Authorization': `Bearer ${creds.token}` }
        })
      ]);

      if (plansRes.ok) setBillingPlans(await plansRes.json());
      if (currentRes.ok) setCurrentPlan(await currentRes.json());
    } catch (err: any) {
      console.error('Failed to fetch billing info', err);
      setGlobalError('Failed to load billing details: ' + err.message);
      setShowBillingModal(false);
    } finally {
      setBillingLoading(false);
    }
  };

  const handleSubscribe = async (planName: string) => {
    try {
      setBillingLoading(true);
      const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
      const res = await fetch(getApiUrl(3003, '/billing/subscribe'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${creds.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planName, paymentMethodId: 'pm_card_visa' })
      });
      if (!res.ok) throw new Error(await res.text());
      fetchBillingInfo();
    } catch (err: any) {
      setGlobalError('Subscription failed: ' + err.message);
      setBillingLoading(false);
    }
  };

  const loadDeviceInfo = async () => {
    try {
      const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
      if (!creds?.token) return;
      
      let localKey = isElectron ? await (window as any).electronAPI.getDeterministicKey() : null;
      let deviceUuid = '';

      // 1. Fetch what the server thinks are our devices
      const { data: fetchedDevices } = await api.get('/api/devices/mine');
      setDevices(fetchedDevices);

      // 2. Check if our local identity is still valid in the DB
      let existingInDb = null;
      if (localKey && Array.isArray(fetchedDevices)) {
        existingInDb = fetchedDevices.find((d: any) => d.access_key === localKey);
      }

      if (!localKey || !existingInDb) {
        // We have no key, or our key was deleted from the server. Register fresh!
        console.log(`[Identity] No valid local key found${localKey ? ' (Stale)' : ''}. Registering...`);
        const machineName = (isElectron && (window as any).electronAPI.getMachineName) 
          ? await (window as any).electronAPI.getMachineName() 
          : 'RemoteLink Web User';
        const { data: newDevice } = await api.post('/api/devices/register', { 
           name: machineName, 
           accessKey: localKey || undefined 
        });
        
        localKey = newDevice.access_key;
        deviceUuid = newDevice.id;
        console.log(`[Identity] Registered NEW Identity: ${localKey}`);
        pollDevices(); // Update the list again
      } else {
        deviceUuid = existingInDb.id;
        console.log(`[Identity] Verified existing identity: ${localKey}`);
      }

      if (localKey) {
        setDeviceId(deviceUuid);
        setHostAccessKey(localKey);
        setHostSessionId(localKey); // Update the visual registration code
      }
    } catch (e: any) {
      console.error('[Identity] Load failed:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadDeviceInfo();
  }, [isAuthenticated, serverIP]);
 
  // --- Persistent Hosting Auto-Start ---
  useEffect(() => {
    // If all required identity info is loaded and auto-host is enabled, start hosting.
    // hostStatus "" or "idle" means it hasn't started yet.
    if (isAuthenticated && hostAccessKey && deviceId && devicePassword && isAutoHostEnabled && (hostStatus === 'idle' || hostStatus === '')) {
      console.log('[Auto-Host] Identity ready, initiating automatic start...');
      handleStartHosting();
    }
  }, [isAuthenticated, hostAccessKey, deviceId, devicePassword, isAutoHostEnabled]);

  useEffect(() => {
    checkAuth().finally(() => setLoading(false));
    
    if (!isElectron) return;
    
    // Listen for Google OAuth deep link success
    const unsubDeepLink = (window as any).electronAPI.onAuthDeepLinkSuccess?.(async (tokens: any) => {
       console.log('[Auth] Deep link success received in renderer');
       // We need user info too, but for now we can just mark as authenticated
       // and let checkAuth or a /me call fix the rest
       await setAuth({ id: '', email: '', name: 'Google User', plan: 'Free', avatar: null }, tokens.accessToken, tokens.refreshToken);
       checkAuth(); 
    });

    if (isElectron) {
       (window as any).electronAPI.getLocalIP().then(setLocalIP);
    }
    
    if (isElectron) {
      // Synchronize initial hosting status from main process
      (window as any).electronAPI.getHostStatus?.().then((res: any) => {
         if (res && res.status === 'status') {
            console.log(`[Renderer] Syncing active host session: ${res.sessionId}`);
            setHostSessionId(res.sessionId);
            setHostStatus('status');
         }
      });
    }

    const removeHostListener = isElectron ? (window as any).electronAPI.onHostStatus((status: string) => {
      setHostStatus(status as any);
      setHostMessage(status);
    }) : () => {};
    
    const removeSignalingListener = isElectron ? (window as any).electronAPI.onSignalingMessage(async (data: any) => {
      console.log(`[Renderer] Received signaling FROM MAIN: ${data.type}`);
      if (data.type === 'offer') {
        console.log('[Renderer] Handling OFFER from host...');
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });
        pcRef.current = pc;

        pc.onicegatheringstatechange = () => {
          console.log(`[Renderer] ICE Gathering State: ${pc.iceGatheringState}`);
        };

        pc.onconnectionstatechange = () => {
          console.log(`[Renderer] Connection State: ${pc.connectionState}`);
          if (pc.connectionState === 'connected') {
            setViewerStatus('connected');
            clearTimeout(connectionTimeout);
          } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            console.log('[Renderer] WebRTC connection dropped.');
            setViewerStatus('connection_lost');
            clearTimeout(connectionTimeout);
          } else if (pc.connectionState === 'closed') {
            clearTimeout(connectionTimeout);
          }
        };

        const connectionTimeout = setTimeout(() => {
          if (pc.connectionState !== 'connected' && pc.connectionState !== 'closed') {
             console.warn('[Renderer] WebRTC Connection timeout (Viewer). Status:', pc.connectionState);
             setViewerStatus('connection_lost');
             pc.close();
          }
        }, 30000); // 30s timeout for ICE/handshake to be safer

        pc.ontrack = (event) => {
          console.log('[Renderer] Standard Video Track received!');
          setRemoteStream(event.streams[0]);
          if (viewerStatus !== 'streaming') setViewerStatus('streaming');
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(`[Renderer] Generated local ICE candidate: ${event.candidate.candidate.substring(0, 30)}...`);
            if (isElectron) {
              (window as any).electronAPI.sendSignalingMessage({
                type: 'ice-candidate',
                candidate: event.candidate.candidate,
                sdpMid: event.candidate.sdpMid,
                sdpMLineIndex: event.candidate.sdpMLineIndex,
                targetId: sessionCode.replace(/\s/g, '')
              });
            }
          }
        };

        pc.ondatachannel = (event) => {
          const channel = event.channel;
          console.log(`[Renderer] DataChannel received: ${channel.label}`);
          if (channel.label === 'video') {
            channel.binaryType = 'arraybuffer';
            channel.onmessage = (msg: MessageEvent) => {
              const data = new Uint8Array(msg.data);
              if (Math.random() < 0.01) console.log(`[Renderer] DataChannel MSG: ${data.length} bytes`);
              if (videoPlayerRef.current) {
                videoPlayerRef.current.feed(data);
              } else {
                if (viewerStatus !== 'streaming') setViewerStatus('streaming');
              }
            };
          } else if (channel.label === 'control') {
            controlChannelRef.current = channel;
            
            const sendKeyframeRequest = () => {
              if (channel.readyState === 'open') {
                console.log('[Renderer] Control DataChannel ACTIVE. Requesting keyframe...');
                channel.send(JSON.stringify({ type: 'request-keyframe' }));
              }
            };

            if (channel.readyState === 'open') {
              sendKeyframeRequest();
            } else {
              channel.onopen = sendKeyframeRequest;
            }

            const clipboardInterval = setInterval(async () => {
              if (viewerStatus === 'streaming' && channel.readyState === 'open') {
                const text = await (window as any).electronAPI.clipboard.readText();
                if (text && text !== lastClipboardRef.current) {
                  lastClipboardRef.current = text;
                  channel.send(JSON.stringify({ type: 'clipboard', text }));
                }
              }
            }, 1000);

            channel.onmessage = (e) => {
              try {
                const data = JSON.parse(e.data);
                if (data.type === 'clipboard' && data.text) {
                  lastClipboardRef.current = data.text;
                  if (isElectron) {
                    (window as any).electronAPI.clipboard.writeText(data.text);
                  }
                } else if (data.type === 'file-sent') {
                  setFileReceivedModal(data);
                }
              } catch (err) {}
            };

            channel.onclose = () => {
              console.log('[Renderer] Control Channel closed.');
              clearInterval(clipboardInterval);
            };
            console.log('[Renderer] Control DataChannel ready.');
          }
        };

        try {
          console.log('[Renderer] Setting remote description (Offer)...');
          await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: data.sdp }));
          console.log('[Renderer] Remote description set. Creating Answer...');
          const answer = await pc.createAnswer();
          console.log('[Renderer] Answer created. Setting local description...');
          await pc.setLocalDescription(answer);
          console.log('[Renderer] Local description set. Sending ANSWER to host...');

          if (isElectron) {
            (window as any).electronAPI.sendSignalingMessage({
              type: 'answer',
              sdp: answer.sdp,
              targetId: sessionCode.replace(/\s/g, '')
            });
          }

          console.log(`[Renderer] Draining ${candidatesBuffer.current.length} buffered candidates`);
          candidatesBuffer.current.forEach(c => pc.addIceCandidate(c).catch(err => console.error('[Renderer] Add candidate error:', err)));
          candidatesBuffer.current = [];
        } catch (e) {
          console.error('[Renderer] Error in WebRTC handshake:', e);
        }

      } else if (data.type === 'ice-candidate') {
        console.log('[Renderer] Received ICE candidate from host');
        const cand: RTCIceCandidateInit = {
          candidate: data.candidate,
          sdpMid: data.sdpMid || data.mid,
          sdpMLineIndex: data.sdpMLineIndex ?? 0
        };
        if (pcRef.current && pcRef.current.remoteDescription) {
          pcRef.current.addIceCandidate(cand).catch(err => console.error('[Renderer] Add remote candidate error:', err));
        } else {
          console.log('[Renderer] Buffering remote candidate (No remote description yet)');
          candidatesBuffer.current.push(cand);
        }
      }
    }) : () => {};

    const removeSignalingDisconnected = isElectron ? (window as any).electronAPI.onSignalingDisconnected?.(() => {
      console.log('[Renderer] Signaling disconnected unexpectedly.');
      setViewerStatus('connection_lost');
    }) : null;

    return () => {
      if (isElectron) {
        if (unsubDeepLink) unsubDeepLink();
        removeHostListener();
        removeSignalingListener();
        if (removeSignalingDisconnected) removeSignalingDisconnected();
        pcRef.current?.close();
      }
    };
  }, [sessionCode, isElectron]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await storeLogin(email, password);
      setShowSplash(true);
      setTimeout(() => setShowSplash(false), 2000);
      localStorage.setItem('remote_link_server_ip', serverIP);
    } catch (err: any) {
      showError('Authentication Failed', err.response?.data?.error || `Could not establish secure link to ${serverIP}. Check your credentials and server status.`);
    } finally {
      setLoading(false);
    }
  };

  const simulateGoogleLogin = () => {
    setLoading(true);
    setTimeout(async () => {
      await setAuth(
        { id: 'g1', email: 'guest@google.com', name: 'Google User', plan: 'Free', avatar: null }, 
        'mock-google-token', 
        'mock-google-refresh'
      );
      setShowSplash(true);
      setTimeout(() => setShowSplash(false), 2000);
      setLoading(false);
    }, 1000);
  };

  const copyAccessKey = () => {
    navigator.clipboard.writeText(hostAccessKey);
    // Simple visual feedback could go here
  };

  const handleStartHosting = async () => {
    if (isViewerWindow) {
      console.log('[Host-Guard] Blocked handleStartHosting in Viewer Window.');
      return;
    }
    setHostStatus('connecting');
    setHostError('');
    try {
      // 1. Get Auth Credentials
      const creds = isElectron ? await (window as any).electronAPI.getToken() : { token: accessToken };
      if (!creds?.token) throw new Error('Please sign in first');

      if (!hostAccessKey) {
        throw new Error('Permanent identity not loaded. Please wait or re-sign in.');
      }

      if (!devicePassword) {
        throw new Error('Please set an access password before hosting.');
      }
      if (!deviceId) {
        throw new Error('Please wait for your device identity to load or restart the app.');
      }

      // 2. Set/Sync Password
      localStorage.setItem('device_password', devicePassword);
      await api.post('/api/devices/set-password', { deviceId, password: devicePassword });

      // 3. Start Signaling with permanent Access Key
      if (!isElectron) {
         showError('Browser Limitation', 'Hosting features require the native desktop application.');
         setHostStatus('error');
         return;
      }
      const sessionId = await (window as any).electronAPI.startHosting(hostAccessKey);
      console.log(`[Host] Identity Registered with signaling: ${sessionId}`);
      
      if (!sessionId) throw new Error('Signaling server did not return a Session ID');
      
      setHostSessionId(sessionId); 
      setHostStatus('status');
      
      // Instant UI Update: Mark our local device as online in the list
      setDevices(prev => prev.map(d => 
        d.access_key === hostAccessKey ? { ...d, is_online: true } : d
      ));

      addNotification('Broadcasting active.', 'host');
      
      // Update sidebar status immediately so it doesn't show "Offline"
      // Added a 1.5s retry to account for propagation delay across services/Redis
      await pollDevices();
      setTimeout(async () => {
        await pollDevices();
      }, 1500);
      
      // Persist hosting state
      setIsAutoHostEnabled(true);
      localStorage.setItem('is_auto_host_enabled', 'true');
    } catch (e: any) {
      console.error('[Host] Start failed:', e);
      setHostStatus('error');
      setHostError(e.message);
      addNotification(`Hosting failed: ${e.message}`, 'system');
    }
  };

  const handleStopHosting = async () => {
    try {
      if (isElectron) {
        await (window as any).electronAPI.stopHosting();
      }
      setHostStatus('idle');
      
      // Instant UI Update: Mark our local device as offline in the list
      setDevices(prev => prev.map(d => 
        d.access_key === hostAccessKey ? { ...d, is_online: false } : d
      ));

      addNotification('Broadcasting deactivated.', 'host');
      
      // Persist state
      setIsAutoHostEnabled(false);
      localStorage.setItem('is_auto_host_enabled', 'false');
    } catch (e: any) {
      console.error('[Host] Stop failed:', e);
    }
  };

  const handleFindDevice = async () => {
    if (!sessionCode) return;
    setViewerStatus('connecting');
    setViewerError('');
    try {
      const cleanKey = sessionCode.replace(/\s/g, '');
      const { data } = await api.get(`/api/devices/status?key=${cleanKey}`);
      if (!data.exists) throw new Error('Device not found. Check the access key.');
      if (!data.online) throw new Error('This machine is currently offline.');

      setViewerStep(2);
      setViewerStatus('idle');
    } catch (e: any) {
      setViewerStatus('error');
      setViewerError(e.message);
    }
  };

  const handleConnectToHost = async () => {
    if (!sessionCode || !accessPassword) return;
    setViewerStatus('connecting');
    setViewerError('');
    try {
      // 1. Verify Access and Get Token
      const { data: authData } = await api.post('/api/devices/verify-access', {
        accessKey: sessionCode.replace(/\s/g, ''),
        password: accessPassword
      });

      // 2. Connect to Signaling with One-Time Token
      if (isElectron) {
        await (window as any).electronAPI.connectToHost(sessionCode.replace(/\s/g, ''), serverIP, authData.token);
        setViewerStatus('connected');
      } else {
        showError('Browser Limitation', 'Remote viewer connections require the native desktop application.');
        setViewerStatus('error');
      }
    } catch (e: any) {
      setViewerStatus('error');
      setViewerError(e.message);
    }
  };

  const formatCode = (code: string) => {
    if (!code) return '';
    const clean = code.replace(/[^0-9]/g, '');
    if (clean.length === 9) {
      return `${clean.slice(0,3)} ${clean.slice(3,6)} ${clean.slice(6,9)}`;
    }
    return clean.match(/.{1,3}/g)?.join(' ') || clean;
  };

  // --- V8 ABSOLUTE PRIORITY ROUTING: Bypass EVERYTHING for Viewer Windows ---
  if (isViewerWindow || viewerStatus === 'streaming' || viewerStatus === 'connected' || viewerStatus === 'connection_lost') {
    return (
      <div className="min-h-screen bg-white flex flex-col relative overflow-hidden">
          {isViewerWindow && (
             <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[9999] px-6 py-2 bg-white rounded-full shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-6 duration-700">
                <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-black text-[#1C1C1C] uppercase tracking-[0.2em]">{windowDeviceName || 'SECURE LINK'}</span>
             </div>
          )}
          {viewerStatus === 'connection_lost' && (
            <div className="absolute inset-0 z-[100] bg-white/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in duration-700">
              <div className="w-24 h-24 bg-red-50 rounded-[32px] flex items-center justify-center mb-8 border border-red-100 shadow-2xl">
                <MonitorOff className="text-red-500 w-10 h-10" />
              </div>
              <h2 className="text-4xl font-black text-[#1C1C1C] mb-4 uppercase tracking-tighter">Connection Fault</h2>
              <p className="text-[10px] text-[rgba(28,28,28,0.4)] mb-12 tracking-[0.2em] font-black uppercase">The remote node has severed the secure link</p>
              <div className="flex gap-4">
                <button 
                  onClick={isViewerWindow ? () => window.close() : handleDisconnect}
                  className="snow-btn-secondary !px-12"
                >
                  TERMINATE
                </button>
                <button 
                  onClick={() => handleFindDevice()}
                  className="snow-btn !px-12"
                >
                  RE-ESTABLISH
                </button>
              </div>
            </div>
          )}
          
          <div className="flex-grow flex flex-col min-h-0">
             <VideoPlayer 
               ref={videoPlayerRef}
               viewerStatus={viewerStatus}
               setViewerStatus={setViewerStatus}
               sessionCode={sessionCode}
               onDisconnect={isViewerWindow ? () => window.close() : handleDisconnect}
               remoteStream={remoteStream}
               deviceType={isViewerWindow ? 'desktop' : selectedDevice?.device_type}
               deviceName={isViewerWindow ? windowDeviceName : (selectedDevice?.device_name || 'Remote Node')}
               onControlEvent={(event: any) => {
                 if (controlChannelRef.current?.readyState !== 'open') {
                   console.warn('[Viewer] Control channel not open yet. Event ignored.');
                   return;
                 }
                 
                 if (event instanceof Uint8Array) {
                   (controlChannelRef.current as any).send(event);
                 } else if (event.type === 'mousemove') {
                   throttledMouseMove(event);
                 } else {
                   controlChannelRef.current.send(JSON.stringify(event));
                 }
               }}
             />
          </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-full flex overflow-hidden bg-white font-inter select-none">
        <SnowSplashScreen isReady={!loading} />
        {/* LEFT — Branded Input Panel */}
        <div className="flex-1 flex flex-col items-center justify-center px-20 py-12 animate-in fade-in slide-in-from-left-8 duration-700">
          <div className="w-full max-w-sm">
            {/* Minimal Logo Mark */}
            <div className="flex items-center gap-3 mb-16 group cursor-default">
              <div className="w-12 h-12 rounded-2xl bg-[#1C1C1C] flex items-center justify-center shadow-xl shadow-black/10 group-hover:scale-105 transition-transform duration-300">
                <Link size={24} className="text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-bold text-[#1C1C1C] tracking-tighter leading-none">SyncLink</span>
                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-[rgba(28,28,28,0.2)] mt-1">Desktop Auth</span>
              </div>
            </div>

            <h1 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2">Welcome Back</h1>
            <p className="text-sm font-medium text-[rgba(28,28,28,0.4)] mb-10 leading-relaxed">Enter your node credentials to access your secure network.</p>

            <form onSubmit={handleLogin} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-wider block ml-1">Work Email</label>
                <div className="relative group">
                   <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(28,28,28,0.2)] group-focus-within:text-[#1C1C1C] transition-colors">
                     <Mail size={16} />
                   </div>
                   <input
                     type="email"
                     required
                     className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-[18px] pl-12 pr-4 py-3.5 text-sm font-medium focus:bg-white focus:border-[rgba(28,28,28,0.2)] focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[rgba(28,28,28,0.2)]"
                     value={email}
                     placeholder="name@company.com"
                     onChange={(e) => setEmail(e.target.value)}
                   />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between ml-1">
                   <label className="text-[11px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-wider">Access Token</label>
                   <button type="button" className="text-[10px] font-bold text-blue-600 hover:opacity-80 transition-opacity">Forgot?</button>
                </div>
                <div className="relative group">
                   <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(28,28,28,0.2)] group-focus-within:text-[#1C1C1C] transition-colors">
                     <Lock size={16} />
                   </div>
                   <input
                     type={showLoginPassword ? "text" : "password"}
                     required
                     className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-[18px] pl-12 pr-12 py-3.5 text-sm font-medium focus:bg-white focus:border-[rgba(28,28,28,0.2)] focus:ring-4 focus:ring-black/5 outline-none transition-all placeholder:text-[rgba(28,28,28,0.2)]"
                     value={password}
                     placeholder="••••••••"
                     onChange={(e) => setPassword(e.target.value)}
                   />
                   <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors">
                     {showLoginPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                   </button>
                </div>
              </div>

              {/* Errors handled by global modal */}

              <button type="submit" className="w-full py-4 bg-[#1C1C1C] text-white rounded-none font-semibold text-sm shadow-xl shadow-black/10 hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4">
                AUTHENTICATE <ArrowRight size={18} />
              </button>
              
              <div className="pt-4 flex flex-col items-center gap-6">
                <button
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="flex items-center gap-2 text-[10px] font-bold text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C] uppercase tracking-widest transition-colors"
                >
                  <Settings size={12} /> signaling server configuration
                </button>

                {showSettings && (
                  <div className="w-full p-5 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.04)] space-y-4 animate-in slide-in-from-top-4 duration-300">
                    <div className="space-y-2">
                       <span className="text-[9px] font-black text-[rgba(28,28,28,0.3)] uppercase tracking-[0.2em] ml-1">Current Node IP</span>
                       <input
                         type="text"
                         className="w-full bg-white border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-2.5 text-xs font-mono font-bold text-[#1C1C1C] outline-none"
                         value={serverIP}
                         onChange={(e) => setServerIP(e.target.value)}
                       />
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase">Interface Detect</span>
                      <span className="text-[10px] font-mono font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{localIP}</span>
                    </div>
                  </div>
                )}
              </div>
            </form>

            <div className="mt-8 relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[rgba(28,28,28,0.06)]" /></div>
              <span className="relative z-10 bg-white px-4 text-[10px] text-[rgba(28,28,28,0.2)] uppercase tracking-widest font-bold">Or continue with</span>
            </div>

            <button 
              type="button" 
              onClick={simulateGoogleLogin}
              className="mt-6 w-full flex items-center justify-center gap-3 bg-white border border-[rgba(28,28,28,0.08)] text-[#1C1C1C] hover:bg-[#F8F9FA] hover:border-[rgba(28,28,28,0.2)] transition-all py-3.5 rounded-none text-sm font-semibold group shadow-sm active:scale-[0.99]"
            >
              <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>

          </div>
          
          <div className="mt-16 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-[0.3em]">
            Team Zain • SyncLink Engine v1.0
          </div>
        </div>

        {/* RIGHT — High Contrast Brand Panel */}
        <div className="w-[45%] bg-[#1C1C1C] relative flex flex-col items-center justify-center p-20 overflow-hidden animate-in fade-in slide-in-from-right-8 duration-1000">
           {/* Abstract Visual Elements */}
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/10 blur-[120px] rounded-full -mr-32 -mt-32" />
           <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-white/5 blur-[100px] rounded-full -ml-32 -mb-32" />
           
           <div className="relative z-10 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-[32px] bg-white text-[#1C1C1C] flex items-center justify-center shadow-2xl shadow-black/40 mb-10 group hover:rotate-6 transition-transform duration-500">
                <Link size={48} />
              </div>
              
              <h2 className="text-5xl font-extrabold text-white tracking-tighter mb-4 leading-tight">
                Secure Mesh<br/>Connectivity.
              </h2>
              <p className="text-white/40 text-lg font-medium max-w-sm leading-relaxed mb-12">
                Unifying cross-platform nodes with hardware-level security and ultra-low latency.
              </p>

              <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
                {[
                  { label: 'E2EE Setup', icon: ShieldCheck },
                  { label: 'P2P Relay', icon: Radio },
                  { label: 'Zero Trust', icon: Shield },
                  { label: 'Cross Node', icon: LayoutGrid }
                ].map((feat, idx) => (
                  <div key={idx} className="p-4 rounded-2xl bg-white/5 border border-white/5 backdrop-blur-sm flex flex-col items-start gap-3 hover:bg-white/10 hover:border-white/10 transition-all cursor-default">
                    <feat.icon size={18} className="text-white/80" />
                    <span className="text-[10px] font-bold text-white uppercase tracking-widest">{feat.label}</span>
                  </div>
                ))}
              </div>
           </div>
           
           {/* Decorative Floor */}
           <div className="absolute bottom-0 inset-x-0 h-1/2 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
        </div>
      </div>
    );
  }


  return (
    <div className="h-screen w-full bg-[#F8F9FA] text-[#1C1C1C] flex overflow-hidden font-inter selection:bg-blue-500/20 select-none">
      <SnowSplashScreen isReady={!loading} />
      
      {globalError && (
        <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-3 text-xs font-bold z-[50] flex justify-between px-6 items-center shadow-lg">
           <span>{globalError}</span>
           <button onClick={() => setGlobalError('')} className="bg-white/20 p-1 rounded-md hover:bg-white/30 transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}
      
      {/* --- SNOW UI SIDEBAR NAV --- */}
      <SnowSidebar 
        currentView={currentView}
        selectedDevice={selectedDevice}
        setCurrentView={setCurrentView}
        setSelectedDevice={setSelectedDevice}
        handleLogout={() => {
           storeLogout();
           setAuth({} as any, '', '');
        }}
        user={user}
      />

      <div className="flex-1 flex overflow-hidden ml-[212px] relative transition-all duration-300">
        <main className="flex-1 flex flex-col overflow-hidden relative bg-white">
          {/* Workspace Header - Re-structured for Breadcrumbs */}
          <header className="h-[64px] flex items-center justify-between px-8 flex-shrink-0 z-10 w-full bg-[#F8F9FA]/60 backdrop-blur-md border-b border-[rgba(28,28,28,0.04)]">
            <div className="flex flex-col gap-1.5">
               <div className="flex items-center gap-1.5 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">
                  <span className="hover:text-[rgba(28,28,28,0.4)] cursor-pointer transition-colors" onClick={() => setCurrentView('dashboard')}>SyncLink Nodes</span>
                  <span className="opacity-50">/</span>
                  <span className="text-[rgba(28,28,28,0.6)]">{selectedDevice ? 'Terminal' : currentView === 'host' ? 'Host' : currentView}</span>
               </div>
               <h1 className="text-2xl font-bold text-[#1C1C1C] tracking-tight capitalize">
                  {selectedDevice ? selectedDevice.device_name : currentView === 'host' ? 'Host This Device' : currentView}
               </h1>
            </div>

            <div className="flex items-center gap-6">
               <div className="flex items-center bg-white rounded-xl border border-[rgba(28,28,28,0.06)] pl-4 pr-1 py-1 shadow-sm focus-within:ring-2 focus-within:ring-blue-100 transition-all w-64 h-9">
                 <Search className="w-3.5 h-3.5 text-[rgba(28,28,28,0.2)] mr-2" />
                 <input 
                   type="text" 
                   placeholder="Search nodes, settings..." 
                   value={searchQuery}
                   onChange={e => setSearchQuery(e.target.value)}
                   className="bg-transparent text-[11px] font-medium text-[#1C1C1C] outline-none w-full placeholder:text-[rgba(28,28,28,0.2)]"
                 />
               </div>
               
               <div className="flex items-center gap-4">
                  <button onClick={pollDevices} className="p-2 text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-colors" title="Refresh Sync">
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <div className="w-8 h-8 rounded-xl bg-[rgba(28,28,28,0.04)] border border-[rgba(0,0,0,0.04)] flex items-center justify-center text-[10px] font-bold text-[#1C1C1C]">ZB</div>
               </div>
            </div>
          </header>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-8 pb-8">
            {selectedDevice ? (
               /* --- INDIVIDUAL DEVICE PREVIEW VIEW --- */
               <div className="max-w-4xl mx-auto h-full flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8 duration-500 font-inter">
                 <div className="relative mb-6">
                    <div className="w-32 h-32 rounded-[32px] flex items-center justify-center shadow-lg bg-[#1C1C1C]">
                       {selectedDevice.device_type?.toLowerCase() === 'ios' || selectedDevice.device_type?.toLowerCase() === 'android' ? 
                          <Smartphone className="text-white w-14 h-14" /> : 
                          <Monitor className="text-white w-14 h-14" />
                       }
                    </div>
                    <div className="absolute -bottom-1 -right-1 w-8 h-8 bg-[#71DD8C] rounded-full border-4 border-[#F8F9FA]" />
                 </div>

                 <h2 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2 uppercase">{selectedDevice.device_name}</h2>
                 <div className="flex items-center gap-3 text-[rgba(28,28,28,0.4)] text-[11px] font-bold mb-10 tracking-widest uppercase">
                    <span className="bg-[rgba(28,28,28,0.05)] px-2 py-1 rounded-lg font-mono text-[#1C1C1C]">#{selectedDevice.access_key}</span>
                    <div className="w-1.5 h-1.5 rounded-full bg-[rgba(28,28,28,0.1)]" />
                    <span>Secure Link Ready</span>
                 </div>

                 <div className="flex gap-4 w-full max-w-sm">
                    <button 
                      onClick={() => setSelectedDevice(null)} 
                      className="flex-1 py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] bg-white border border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] transition shadow-sm"
                    >
                      Go Back
                    </button>
                    <button 
                      onClick={() => handleDeviceClick(selectedDevice)} 
                      disabled={viewerStatus === 'connecting'} 
                      className="flex-1 py-3.5 rounded-2xl font-bold text-[11px] uppercase tracking-widest text-white bg-[#1C1C1C] shadow-lg shadow-black/10 flex items-center justify-center gap-2 transition active:scale-[0.98]"
                    >
                      {viewerStatus === 'connecting' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <>Establish Link <Zap size={14} /></>}
                    </button>
                 </div>
               </div>
            ) : currentView === 'dashboard' ? (
              /* --- SNOW UI DASHBOARD VIEW --- */
              <div className="w-full animate-in fade-in duration-700">
                 <SnowDashboard devices={devices} />
              </div>
            ) : currentView === 'host' ? (
              /* --- HOST THIS DEVICE VIEW --- */
              <div className="w-full pt-4 animate-in fade-in duration-700">
                 <SnowHost 
                    status={hostStatus}
                    accessKey={hostAccessKey}
                    isAutoHost={isAutoHostEnabled}
                    setIsAutoHost={(val) => {
                      setIsAutoHostEnabled(val);
                      localStorage.setItem('is_auto_host_enabled', String(val));
                    }}
                    handleStartHosting={handleStartHosting}
                    handleStopHosting={handleStopHosting}
                    copyAccessKey={copyAccessKey}
                    openPasswordModal={() => setActionModal({ type: 'password', device: null })}
                 />
              </div>
            ) : currentView === 'billing' ? (
              /* --- BILLING VIEW --- */
              <div className="w-full pt-4 animate-in fade-in duration-700">
                 <SnowBilling user={user} />
              </div>
            ) : currentView === 'documentation' ? (
              /* --- SNOW UI DOCUMENTATION VIEW --- */
              <div className="w-full h-full animate-in fade-in duration-700">
                 <SnowDocumentation />
              </div>
            ) : currentView === 'profile' ? (
              /* --- SNOW UI PROFILE VIEW --- */
              <div className="w-full h-full pt-8 animate-in fade-in duration-700 px-8">
                 <SnowProfile user={user} logout={storeLogout} />
              </div>
            ) : currentView === 'support' ? (
              /* --- SNOW UI SUPPORT VIEW --- */
              <div className="w-full h-full pt-8 animate-in fade-in duration-700 px-8">
                 <SnowSupport />
              </div>
            ) : currentView === 'devices' ? (
              /* --- SNOW UI DEVICES VIEW --- */
              <div className="w-full h-full animate-in fade-in duration-700 pt-2">
                 <SnowDevices 
                   devices={devices}
                   searchQuery={searchQuery}
                   setSearchQuery={setSearchQuery}
                   setSelectedDevice={setSelectedDevice}
                   handleDeviceClick={handleDeviceClick}
                   setActionModal={setActionModal}
                   setShowAddModal={setShowAddModal}
                   handleBulkDelete={handleBulkDelete}
                 />
              </div>
            ) : currentView === 'settings' ? (
              /* --- SETTINGS VIEW --- */
              <div className="max-w-4xl mx-auto space-y-6 pt-2 animate-in fade-in duration-500 font-inter">
                 <section className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
                    <h3 className="text-lg font-bold text-[#1C1C1C] mb-6 tracking-tight">System Preferences</h3>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
                         <div className="flex flex-col">
                            <span className="font-bold text-sm text-[#1C1C1C]">Relay Server Address</span>
                            <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1 tracking-tight">The signaling endpoint for P2P connection establishment</span>
                         </div>
                         <div className="flex items-center bg-white px-3 py-1.5 rounded-xl border border-[rgba(28,28,28,0.08)]">
                            <span className="text-xs font-mono text-[#1C1C1C]">{serverIP}</span>
                         </div>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
                         <div className="flex flex-col">
                            <span className="font-bold text-sm text-[#1C1C1C]">Auto-Start Hosting</span>
                            <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1 tracking-tight">Automatically broadcast this machine upon app launch</span>
                         </div>
                         <label className="relative inline-flex items-center cursor-pointer">
                           <input type="checkbox" className="sr-only peer" checked={isAutoHostEnabled} onChange={(e) => {
                               setIsAutoHostEnabled(e.target.checked);
                               localStorage.setItem('is_auto_host_enabled', String(e.target.checked));
                           }} />
                           <div className="w-9 h-5 bg-[rgba(28,28,28,0.1)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1C1C1C]"></div>
                         </label>
                      </div>

                      <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
                         <div className="flex flex-col">
                            <span className="font-bold text-sm text-[#1C1C1C]">Node Identifier</span>
                            <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1 tracking-tight">This name helps identify this specific node on your device map.</span>
                         </div>
                         <button onClick={() => setActionModal({ type: 'rename', device: null })} className="px-4 py-2 font-bold text-[11px] uppercase tracking-widest bg-white border border-[rgba(28,28,28,0.08)] hover:border-[rgba(28,28,28,0.3)] text-[#1C1C1C] rounded-xl transition-all shadow-sm">
                            Modify Nickname
                         </button>
                      </div>
                    </div>
                 </section>
              </div>
            ) : null}
          </div>
        </main>

        {/* --- SNOW UI RIGHT SIDEBAR --- */}
        <SnowRightBar devices={devices} notifications={notifications} onDeviceClick={(dev) => { setSelectedDevice(dev); setCurrentView('devices'); }} />
      </div>

      {/* MODALS LAYER */}
      
      {/* Password Prompt Modal */}
      {showPasswordPrompt && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-white p-8 rounded-[24px] shadow-2xl border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300">
             <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-bold text-[#1C1C1C] tracking-tight uppercase">Authentication Required</h3>
                <button onClick={() => setShowPasswordPrompt(null)} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] hover:bg-[#F8F9FA] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
             </div>
              <div className="relative mb-8">
                <input 
                  type={showPromptPassword ? "text" : "password"} 
                  placeholder="Network Hardware Key" 
                  value={promptPassword} 
                  onChange={e => setPromptPassword(e.target.value)} 
                  className="purity-input font-mono text-center text-2xl tracking-[0.2em] pr-12" 
                  autoFocus 
                />
                <button onClick={() => setShowPromptPassword(!showPromptPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors">
                   {showPromptPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
             <label className="flex items-center gap-3 cursor-pointer mb-8 p-4 rounded-2xl bg-[#F8F9FA] border border-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.1)] transition-all">
                <input type="checkbox" checked={promptRemember} onChange={e => setPromptRemember(e.target.checked)} className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-[#1C1C1C] focus:ring-[#1C1C1C]" />
                <span className="text-xs font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Remember this machine</span>
             </label>
             <button onClick={submitPasswordPrompt} disabled={!promptPassword || viewerStatus === 'connecting'} className="snow-btn w-full">ESTABLISH SECURE LINK</button>
           </div>
        </div>
      )}

      {/* Add Device Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
           <div className="w-full max-w-md bg-white p-8 rounded-[24px] shadow-2xl border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300">
             <div className="flex justify-between items-center mb-8">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#F8F9FA] rounded-[18px] flex items-center justify-center text-[#1C1C1C] shadow-sm border border-[rgba(28,28,28,0.04)]">
                    <Plus className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1C1C1C] tracking-tight uppercase">Import Node</h3>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] hover:bg-[#F8F9FA] rounded-xl transition-colors"><X className="w-5 h-5" /></button>
             </div>
             
             <div className="space-y-6 mb-10">
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] ml-1">Network ID</label>
                 <input type="text" placeholder="000 000 000" value={addKey} onChange={e => setAddKey(formatCode(e.target.value))} className="purity-input font-mono text-center tracking-[0.2em]" />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] ml-1">Security Token</label>
                 <div className="relative">
                   <input type={showAddPassword ? "text" : "password"} placeholder="••••••••" value={addPassword} onChange={e => setAddPassword(e.target.value)} className="purity-input font-mono text-center pr-12" />
                   <button onClick={() => setShowAddPassword(!showAddPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors">
                      {showAddPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                   </button>
                 </div>
               </div>
             </div>
              <button onClick={handleAddDevice} disabled={!addKey || !addPassword} className="snow-btn w-full disabled:opacity-50 tracking-widest">ADD TO MESH NETWORK</button>
            </div>
         </div>
       )}

      {/* Device Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 bg-[#1C1C1C]/20 backdrop-blur-md animate-in fade-in duration-300">
          <div className="w-full max-w-sm bg-white p-8 rounded-[24px] shadow-2xl border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300">
            <div className="mb-8 text-center">
              <h3 className="text-xl font-black text-[#1C1C1C] mb-2 tracking-tight uppercase">
                {actionModal.type === 'rename' ? 'Modify Identity' : 
                 actionModal.type === 'password' ? 'Hardware Key' :
                 actionModal.type === 'remove' ? 'Sever Connection' : ''}
              </h3>
              <p className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] leading-relaxed uppercase tracking-[0.2em]">
                {actionModal.type === 'rename' ? 'Set a persistent nickname for this machine.' :
                 actionModal.type === 'password' ? 'Update the hardware access credentials.' :
                 actionModal.type === 'remove' ? `Unlink ${actionModal.device.device_name} from your account?` : ''}
              </p>
            </div>

            {(actionModal.type === 'rename' || actionModal.type === 'password') && (
              <div className="space-y-4">
                <input 
                  autoFocus
                  type={actionModal.type === 'password' ? 'password' : 'text'}
                  placeholder={actionModal.type === 'password' ? 'Secure Crypt Key' : 'e.g. Workstation Alpha'}
                  className="purity-input w-full font-mono text-center tracking-widest"
                  value={actionValue}
                  onChange={e => setActionValue(e.target.value)}
                />
              </div>
            )}

            <div className="flex gap-4">
              <button 
                onClick={() => setActionModal(null)}
                className="snow-btn-secondary flex-1 uppercase text-[10px] font-black tracking-widest"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (actionModal.type === 'rename') handleRename(actionModal.device);
                  if (actionModal.type === 'remove') handleRemove(actionModal.device);
                  if (actionModal.type === 'password') handleSetPassword(actionModal.device);
                }}
                className={`snow-btn flex-1 uppercase text-[10px] font-black tracking-widest ${actionModal.type === 'remove' ? 'bg-red-600 hover:bg-red-700 !shadow-none' : ''}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Profile/Billing Modal */}
      {showBillingModal && (
        <div className="fixed inset-0 z-[200] bg-[#1C1C1C]/20 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in" onClick={() => setShowBillingModal(false)}>
          <div className="bg-white shadow-2xl rounded-[32px] p-10 w-[800px] max-w-full max-h-[90vh] overflow-y-auto custom-scrollbar relative border border-[rgba(28,28,28,0.06)]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-start mb-12 border-b border-[rgba(28,28,28,0.06)] pb-8">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 bg-[#F8F9FA] rounded-[24px] flex items-center justify-center text-[#1C1C1C] border border-[rgba(28,28,28,0.08)]">
                  <CreditCard className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-3xl font-black text-[#1C1C1C] tracking-tighter uppercase">Cloud Topology</h3>
                  <div className="flex items-center gap-3 mt-2">
                     <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest border border-blue-100/50">{currentPlan?.plan || 'Global Basic'}</span>
                     <span className="text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">System Service Plan</span>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowBillingModal(false)} className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] hover:bg-[#F8F9FA] rounded-[14px] transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            {billingLoading && !billingPlans.length ? (
               <div className="py-20 flex justify-center"><RefreshCw className="w-10 h-10 animate-spin text-[#1C1C1C]/10" /></div>
            ) : (
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {billingPlans.map((plan: any) => (
                   <div key={plan.name} className={`p-8 rounded-[28px] border transition-all duration-300 ${currentPlan?.plan === plan.name ? 'bg-blue-50/20 border-blue-100 shadow-sm' : 'bg-white border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] hover:shadow-xl hover:shadow-black/5'}`}>
                     <div className="flex justify-between items-center mb-6">
                       <h4 className="font-bold text-[#1C1C1C] text-lg uppercase tracking-tight">{plan.name}</h4>
                       <span className="text-3xl font-black text-[#1C1C1C]">${plan.price}</span>
                     </div>
                     <ul className="text-[11px] space-y-4 mb-10 text-[rgba(28,28,28,0.5)] font-bold uppercase tracking-widest">
                       {plan.features.map((f: string, i: number) => <li key={i} className="flex items-start gap-3"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {f}</li>)}
                     </ul>
                     <button 
                       onClick={() => handleSubscribe(plan.name)}
                       disabled={currentPlan?.plan === plan.name || billingLoading}
                       className={`w-full py-4 rounded-none text-[10px] font-black uppercase tracking-[0.2em] transition-all ${currentPlan?.plan === plan.name ? 'bg-[rgba(28,28,28,0.04)] text-[rgba(28,28,28,0.2)] cursor-not-allowed' : 'bg-[#1C1C1C] text-white hover:opacity-90 active:scale-[0.98]'}`}
                     >
                       {currentPlan?.plan === plan.name ? 'CURRENT ACTIVE TIER' : 'RESTRUCTURE NODE'}
                     </button>
                   </div>
                 ))}
               </div>
            )}
          {/* File Received Modal */}
      {fileReceivedModal && (
        <div className="fixed inset-0 z-[300] bg-[#1C1C1C]/20 backdrop-blur-md flex items-center justify-center p-6 animate-in zoom-in duration-300">
          <div className="bg-white border border-[rgba(28,28,28,0.06)] shadow-2xl rounded-[32px] p-10 w-[450px] max-w-full flex flex-col items-center text-center relative">
            <div className="w-20 h-20 bg-[#F8F9FA] rounded-[24px] flex items-center justify-center text-[#1C1C1C] mb-8 shadow-sm border border-[rgba(28,28,28,0.04)]">
              <DownloadCloud className="w-10 h-10" />
            </div>
            <h3 className="text-2xl font-black text-[#1C1C1C] mb-2 uppercase tracking-tighter">Payload Delivered</h3>
            <p className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] mb-10 truncate w-full px-4 uppercase tracking-[0.2em]" title={fileReceivedModal.name}>{fileReceivedModal.name}</p>
            
            <div className="flex gap-4 w-full">
              <button 
                onClick={() => setFileReceivedModal(null)} 
                className="snow-btn-secondary flex-1 uppercase text-[10px] font-black tracking-widest"
              >
                DISMISS
              </button>
              <button 
                onClick={() => {
                  (window as any).electronAPI.openPath(fileReceivedModal.path);
                  setFileReceivedModal(null);
                }} 
                className="snow-btn flex-1 uppercase text-[10px] font-black tracking-widest"
              >
                REVEAL FILE
              </button>
            </div>
          </div>
        </div>
      )}
       </div>
        </div>
      )}
        {/* Global Error Modal */}
      {errorModal && errorModal.show && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-[#1C1C1C]/40 backdrop-blur-xl animate-in fade-in duration-300">
          <div className="w-full max-w-md bg-white p-10 rounded-[32px] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.3)] border border-[rgba(28,28,28,0.06)] animate-in zoom-in-95 duration-300 text-center">
             <div className="w-20 h-20 bg-red-50 rounded-[28px] flex items-center justify-center text-red-500 mx-auto mb-8 border border-red-100">
                <ShieldOff className="w-10 h-10" />
             </div>
             <h3 className="text-2xl font-black text-[#1C1C1C] mb-3 tracking-tighter uppercase">{errorModal.title}</h3>
             <p className="text-xs font-bold text-[rgba(28,28,28,0.4)] leading-relaxed uppercase tracking-[0.1em] mb-10">
               {errorModal.message}
             </p>
             <button 
               onClick={() => setErrorModal(null)}
               className="snow-btn w-full tracking-[0.2em] font-black"
             >
               ACKNOWLEDGE
             </button>
          </div>
        </div>
      )}
    </div>
  );
}
