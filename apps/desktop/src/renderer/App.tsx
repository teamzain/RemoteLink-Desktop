import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, 
  KeyRound, 
  Loader2, 
  Activity, 
  ArrowLeft,
  Copy,
  LogOut,
  Zap,
  Shield,
  Settings,
  Play
} from 'lucide-react';

import { useImperativeHandle, forwardRef } from 'react';

// --- Video Player Component (WebCodecs + Canvas) ---
// --- Video Player Component (WebCodecs + Canvas) ---
const VideoPlayer = forwardRef<any, { 
  viewerStatus: string; 
  setViewerStatus: (s: any) => void;
  sessionCode: string;
}>(({ viewerStatus, setViewerStatus, sessionCode }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [latency, setLatency] = useState<number>(0);
  const decoderRef = useRef<any>(null);

  const handleBuffer = (buffer: Uint8Array) => {
    if (!decoderRef.current || decoderRef.current.state !== 'configured') return;
    
    if (viewerStatus !== 'streaming') {
      console.log('[Viewer] First video chunk received via DataChannel!');
      setViewerStatus('streaming');
    }
    
    const dataView = new DataView(buffer.buffer, buffer.byteOffset, 8);
    const timestampBig = dataView.getBigUint64(0, true);
    const now = Date.now();
    const frameLatency = now - Number(timestampBig);
    
    if (Math.random() < 0.05) setLatency(frameLatency);

    const chunkData = new Uint8Array(buffer.buffer, buffer.byteOffset + 8, buffer.byteLength - 8);
    let type: 'key' | 'delta' = 'delta';
    if (chunkData.length > 4) {
      const typeByte = chunkData[4] & 0x1F;
      if (typeByte === 5 || typeByte === 7) type = 'key';
    }

    const encodedChunk = new (window as any).EncodedVideoChunk({
      type: type,
      timestamp: Number(timestampBig) * 1000, // Convert to microseconds
      data: chunkData,
    });

    try {
      decoderRef.current.decode(encodedChunk);
    } catch (e) {
      console.warn('Decode failed:', e);
    }
  };

  useImperativeHandle(ref, () => ({
    feed: (buffer: Uint8Array) => {
      if (Math.random() < 0.01) console.log(`[VideoPlayer] Feeding chunk, size: ${buffer.length}`);
      handleBuffer(buffer);
    }
  }));

  useEffect(() => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    const decoder = new (window as any).VideoDecoder({
      output: (frame: any) => {
        if (Math.random() < 0.05) console.log(`[VideoPlayer] Decoder OUTPUT frame! size: ${frame.displayWidth}x${frame.displayHeight}`);
        ctx.drawImage(frame, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
        frame.close();
      },
      error: (e: any) => {
        console.error('VideoDecoder error:', e);
        setViewerStatus('error');
      },
    });

    decoder.configure({
      codec: 'avc1.42E029', // Baseline profile Level 4.1 for 1080p 
      optimizeForLatency: true,
    });
    
    decoderRef.current = decoder;

    return () => {
      if (decoder.state !== 'closed') decoder.close();
      decoderRef.current = null;
    };
  }, [setViewerStatus]);

  return (
    <div className="w-full h-full flex flex-col gap-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Monitor className="text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-tight">Viewing Remote Host</h2>
            <p className="text-[10px] text-white/40 font-mono tracking-widest leading-none mt-1">{sessionCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
             <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
             <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">{latency}ms Latency</span>
           </div>
           <button 
             onClick={() => window.location.reload()} 
             className="text-white/40 hover:text-white transition-colors"
           >
             <ArrowLeft className="w-5 h-5" />
           </button>
        </div>
      </div>
      
      <div className="flex-grow bg-black rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative group">
        <canvas ref={canvasRef} className="w-full h-full object-contain" width={1920} height={1080} />
        <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border-2 border-blue-500/20 rounded-3xl" />
      </div>
    </div>
  );
});

// --- Main App Component ---
export default function App() {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('test@example.com');
  const [password, setPassword] = useState('password123');
  const [sessionCode, setSessionCode] = useState('');
  const [error, setError] = useState('');

  const [hostSessionId, setHostSessionId] = useState('');
  const [hostStatus, setHostStatus] = useState<'idle' | 'connecting' | 'error' | 'status'>('idle');
  const [hostMessage, setHostMessage] = useState('');
  const [hostError, setHostError] = useState('');

  const [serverIP, setServerIP] = useState(localStorage.getItem('remote_link_server_ip') || '127.0.0.1');
  const [localIP, setLocalIP] = useState('127.0.0.1');
  const [showSettings, setShowSettings] = useState(false);

  const [viewerStatus, setViewerStatus] = useState<'idle' | 'connecting' | 'error' | 'connected' | 'streaming'>('idle');
  const [viewerError, setViewerError] = useState('');
  const videoPlayerRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const candidatesBuffer = useRef<RTCIceCandidateInit[]>([]);

  useEffect(() => {
    checkToken();
    (window as any).electronAPI.getLocalIP().then(setLocalIP);
    const removeHostListener = (window as any).electronAPI.onHostStatus((status: string) => {
      setHostStatus('status');
      setHostMessage(status);
    });
    
    const removeSignalingListener = (window as any).electronAPI.onSignalingMessage(async (data: any) => {
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
          }
        };

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log(`[Renderer] Generated local ICE candidate: ${event.candidate.candidate.substring(0, 30)}...`);
            (window as any).electronAPI.sendSignalingMessage({
              type: 'ice-candidate',
              candidate: event.candidate.candidate,
              mid: event.candidate.sdpMid,
              targetId: sessionCode.replace(/\s/g, '')
            });
          }
        };

        pc.ondatachannel = (event) => {
          const channel = event.channel;
          console.log(`[Renderer] DataChannel received: ${channel.label}`);
          if (channel.label === 'video') {
            channel.binaryType = 'arraybuffer';
            channel.onmessage = (msg: MessageEvent) => {
              if (videoPlayerRef.current) {
                videoPlayerRef.current.feed(new Uint8Array(msg.data));
              } else {
                // If ref not ready yet, just try to force status so it mounts
                if (viewerStatus !== 'connected' && viewerStatus !== 'streaming') setViewerStatus('connected');
              }
            };
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

          (window as any).electronAPI.sendSignalingMessage({
            type: 'answer',
            sdp: answer.sdp,
            targetId: sessionCode.replace(/\s/g, '')
          });

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
          sdpMid: data.mid,
          sdpMLineIndex: 0
        };
        if (pcRef.current && pcRef.current.remoteDescription) {
          pcRef.current.addIceCandidate(cand).catch(err => console.error('[Renderer] Add remote candidate error:', err));
        } else {
          console.log('[Renderer] Buffering remote candidate (No remote description yet)');
          candidatesBuffer.current.push(cand);
        }
      }
    });

    return () => {
      removeHostListener();
      removeSignalingListener();
      pcRef.current?.close();
    };
  }, [sessionCode]);

  const checkToken = async () => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      if (creds?.token) setIsAuthenticated(true);
      else if (creds?.refresh) handleRefresh(creds.refresh);
    } catch (err) {
      console.error('Failed to load credentials', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async (refreshToken: string) => {
    try {
      const res = await fetch(`http://${serverIP}:3001/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken })
      });
      if (res.ok) {
        const data = await res.json();
        await (window as any).electronAPI.setToken(data.token, data.refreshToken);
        setIsAuthenticated(true);
      } else {
        await (window as any).electronAPI.deleteToken();
      }
    } catch (e) {
      await (window as any).electronAPI.deleteToken();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`http://${serverIP}:3001/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('remote_link_server_ip', serverIP);
        await (window as any).electronAPI.setToken(data.token, data.refreshToken);
        setIsAuthenticated(true);
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError(`Network error connecting to ${serverIP}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartHosting = async () => {
    setHostStatus('connecting');
    setHostError('');
    try {
      const sessionId = await (window as any).electronAPI.startHosting();
      setHostSessionId(sessionId);
      setHostStatus('idle');
    } catch (e: any) {
      setHostStatus('error');
      setHostError(e.message);
    }
  };

  const handleConnectToHost = async () => {
    if (!sessionCode) return;
    setViewerStatus('connecting');
    setViewerError('');
    try {
      await (window as any).electronAPI.connectToHost(sessionCode, serverIP);
      setViewerStatus('connected');
    } catch (e: any) {
      setViewerStatus('error');
      setViewerError(e.message);
    }
  };

  const formatCode = (code: string) => {
    if (!code) return '';
    const clean = code.replace(/\s/g, '');
    return clean.match(/.{1,3}/g)?.join(' ') || clean;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-t-blue-500 rounded-full animate-spin" />
          </div>
          <span className="text-white/40 text-xs font-bold uppercase tracking-[0.2em]">Initializing</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#080808] p-8">
        <div className="w-full max-w-md bg-white/[0.02] border border-white/10 rounded-[2.5rem] p-10 backdrop-blur-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="mb-10 text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-600/20">
              <Zap className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-[900] text-white tracking-tight mb-2 uppercase">RemoteLink</h1>
            <p className="text-white/40 text-sm tracking-wide font-medium">Access power from anywhere.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest pl-4">Email Address</label>
               <input 
                type="email" 
                required
                className="w-full bg-white/[0.03] border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest pl-4">Password</label>
               <input 
                type="password" 
                required
                className="w-full bg-white/[0.03] border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-blue-500/50 focus:bg-white/[0.05] transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="text-red-400 text-xs font-medium text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">{error}</div>}
            
            <div className="pt-2">
              <button 
                type="button"
                onClick={() => setShowSettings(!showSettings)}
                className="text-[10px] font-bold text-white/20 hover:text-white/50 transition-colors uppercase tracking-widest flex items-center gap-2"
              >
                <Settings className={`w-3 h-3 ${showSettings ? 'animate-spin-slow' : ''}`} />
                {showSettings ? 'Hide Network Settings' : 'Advanced Network Settings'}
              </button>
              
              {showSettings && (
                <div className="mt-4 p-4 bg-white/[0.02] border border-white/5 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-white/30 uppercase tracking-[0.2em]">Signaling Server IP</label>
                    <input 
                      type="text"
                      className="w-full bg-white/[0.03] border border-white/5 text-white/70 text-xs rounded-xl p-3 outline-none focus:border-blue-500/30 transition-all font-mono"
                      value={serverIP}
                      onChange={(e) => setServerIP(e.target.value)}
                      placeholder="e.g. 192.168.1.15"
                    />
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-medium text-white/20 uppercase tracking-widest">This Device IP</span>
                    <span className="text-[9px] font-mono text-blue-400/50">{localIP}</span>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-95 uppercase tracking-widest text-sm mt-4">
              Unlock Terminal
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Dashboard ---
  if (viewerStatus === 'streaming' || viewerStatus === 'connected') {
    return (
      <div className="min-h-screen bg-[#080808] p-8 flex flex-col">
          <VideoPlayer 
            ref={videoPlayerRef}
            viewerStatus={viewerStatus} 
            setViewerStatus={setViewerStatus} 
            sessionCode={sessionCode} 
          />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#080808] text-white p-8 font-sans selection:bg-blue-500/30">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-16 animate-in fade-in slide-in-from-top-4 duration-700">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
               <Zap className="text-white w-6 h-6" />
             </div>
             <div>
               <h2 className="text-lg font-black uppercase tracking-tight">Terminal Console</h2>
               <div className="flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Systems Nominal</span>
               </div>
             </div>
           </div>
           
           <div className="flex items-center gap-6">
             <button className="w-10 h-10 rounded-full flex items-center justify-center bg-white/5 border border-white/10 text-white/40 hover:text-white transition-colors">
               <Settings className="w-5 h-5" />
             </button>
             <button 
               onClick={async () => { await (window as any).electronAPI.deleteToken(); setIsAuthenticated(false); }}
               className="flex items-center gap-2 text-white/40 hover:text-red-400 transition-colors uppercase text-[10px] font-bold tracking-[0.2em]"
             >
               <LogOut className="w-4 h-4" /> Sign Out
             </button>
           </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Host Module */}
          <section className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-10 flex flex-col items-center relative overflow-hidden group hover:border-white/20 transition-all duration-500 animate-in fade-in slide-in-from-left-8 duration-700 delay-100">
            <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 blur-[80px] group-hover:bg-emerald-500/10 transition-all" />
            
            <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-8 border border-emerald-500/20 shadow-2xl shadow-emerald-500/5">
              <Monitor className="text-emerald-400 w-10 h-10" />
            </div>
            
            <h3 className="text-2xl font-[900] mb-3 uppercase tracking-tight">Host Machine</h3>
            <p className="text-white/40 text-center text-sm leading-relaxed mb-10 max-w-[280px] font-medium">Broadcast this workstation to a remote viewer securely.</p>
            
            {hostSessionId ? (
              <div className="w-full flex flex-col items-center">
                <div className="w-full bg-black/40 border border-white/5 rounded-3xl p-8 mb-8 text-center relative pointer-events-none">
                   <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.3em] block mb-4">Secure Access Key</span>
                   <div className="text-4xl font-black text-white tracking-widest Lato mb-2">
                     {formatCode(hostSessionId)}
                   </div>
                   <div className="flex items-center justify-center gap-2 mt-4">
                     <div className="px-3 py-1 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active Broadcasting</span>
                     </div>
                   </div>
                </div>
                <div className="flex gap-4 w-full">
                  <button 
                    onClick={() => { navigator.clipboard.writeText(formatCode(hostSessionId)); }}
                    className="flex-grow bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl border border-white/10 transition-all flex items-center justify-center gap-2 text-xs uppercase tracking-widest"
                  >
                    <Copy className="w-4 h-4" /> Copy ID
                  </button>
                  <button 
                    onClick={async () => { await (window as any).electronAPI.stopHosting(); setHostSessionId(''); }}
                    className="flex-grow bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold py-4 rounded-2xl border border-red-500/20 transition-all text-xs uppercase tracking-widest"
                  >
                    Kill Link
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full mt-auto">
                {hostStatus === 'status' && (
                  <div className="bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-center mb-4 animate-pulse">
                    {hostMessage}
                  </div>
                )}
                {hostError && (
                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs font-bold text-center mb-4">
                    {hostError}
                  </div>
                )}
                <button 
                  onClick={handleStartHosting}
                  disabled={hostStatus === 'connecting'}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black py-6 rounded-3xl transition-all shadow-xl shadow-emerald-600/20 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm"
                >
                  {hostStatus === 'connecting' ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Initialize Host <Play className="w-4 h-4 fill-current ml-2" /></>}
                </button>
              </div>
            )}
          </section>

          {/* Viewer Module */}
          <section className="bg-white/[0.02] border border-white/5 rounded-[3rem] p-10 flex flex-col items-center relative overflow-hidden group hover:border-white/20 transition-all duration-500 animate-in fade-in slide-in-from-right-8 duration-700 delay-200">
            <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 blur-[80px] group-hover:bg-blue-500/10 transition-all" />
            
            <div className="w-20 h-20 bg-blue-500/10 rounded-[2rem] flex items-center justify-center mb-8 border border-blue-500/20 shadow-2xl shadow-blue-500/5">
              <KeyRound className="text-blue-400 w-10 h-10" />
            </div>
            
            <h3 className="text-2xl font-[900] mb-3 uppercase tracking-tight">Connect Remote</h3>
            <p className="text-white/40 text-center text-sm leading-relaxed mb-10 max-w-[280px] font-medium">Link to a remote machine by entering its secure access key below.</p>
            
            <div className="w-full mt-auto">
              {viewerError && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-2xl text-xs font-bold text-center mb-4">
                  {viewerError}
                </div>
              )}
              
              <div className="relative mb-6">
                <input 
                  type="text" 
                  placeholder="000 000 000" 
                  className="w-full bg-black/40 border border-white/10 text-white rounded-[2rem] p-8 outline-none focus:border-blue-500 focus:bg-white/[0.04] transition-all text-center text-3xl font-black tracking-[0.2em] Lato disabled:opacity-50"
                  value={sessionCode}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\s/g, '');
                    if (raw.length <= 9) setSessionCode(formatCode(raw));
                  }}
                  disabled={viewerStatus === 'connecting'}
                />
              </div>
              
              <button 
                onClick={handleConnectToHost}
                disabled={viewerStatus === 'connecting' || !sessionCode}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-6 rounded-3xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm"
              >
                {viewerStatus === 'connecting' ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Request Access <Shield className="w-4 h-4 ml-2" /></>}
              </button>
            </div>
          </section>
        </main>
        
        {/* Footer info */}
        <footer className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between text-white/20 uppercase text-[10px] font-black tracking-[0.3em]">
           <div className="flex items-center gap-8">
             <span>Protocol: WebRTC Hybrid</span>
             <span>Region: us-east-1</span>
           </div>
           <div className="flex items-center gap-4">
             <div className="w-2 h-2 bg-emerald-500 rounded-full" />
             <span>Encrypted Tunnel Active</span>
           </div>
        </footer>
      </div>
    </div>
  );
}
