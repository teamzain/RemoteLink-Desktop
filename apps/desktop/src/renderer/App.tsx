import React, { useState, useEffect, useRef } from 'react';
import {
  Activity, Monitor, ArrowLeft, ArrowRight, Zap, LogOut, Copy, Settings, MousePointer2, Loader2, Play, KeyRound, Shield
} from 'lucide-react';

import { useImperativeHandle, forwardRef } from 'react';

// --- Video Player Component (WebCodecs + Canvas) ---
// --- Video Player Component (WebCodecs + Canvas) ---
const VideoPlayer = forwardRef(({ viewerStatus, setViewerStatus, sessionCode, onControlEvent }: any, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [latency, setLatency] = useState<number>(0);
  const decoderRef = useRef<any>(null);
  const [hasReceivedKeyframe, setHasReceivedKeyframe] = useState(false);

  // --- REASSEMBLY STATE ---
  const reassemblyMap = useRef(new Map<bigint, { fragments: (Uint8Array | null)[], count: number, total: number }>());

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
        if (f) {
           fullNAL.set(f, offset);
           offset += f.length;
        }
      }
      
      feedToDecoder(fullNAL, ts);
      reassemblyMap.current.delete(ts);
      
      if (reassemblyMap.current.size > 20) {
        const oldestTs = Array.from(reassemblyMap.current.keys()).sort()[0];
        reassemblyMap.current.delete(oldestTs);
      }
    }
  };

  const feedToDecoder = (chunkData: Uint8Array, timestamp: bigint) => {
    if (!decoderRef.current || decoderRef.current.state !== 'configured') return;
    
    const now = Date.now();
    // Unique ID is (ms * 1000 + seq). Extract MS for latency.
    const msTimestamp = Number(timestamp / 1000n);
    const frameLatency = now - msTimestamp;
    if (Math.random() < 0.05) setLatency(frameLatency);

    let type: 'key' | 'delta' = 'delta';
    
    // NAL type detection: Scan the first 100 bytes for a Keyframe-related NAL (5, 7, 8)
    for (let i = 0; i < Math.min(chunkData.length - 4, 100); i++) {
        // Detect Annex-B start code: 00 00 01 (3-byte) or 00 00 00 01 (4-byte)
        if (chunkData[i] === 0 && chunkData[i+1] === 0) {
            let nalType = -1;
            if (chunkData[i+2] === 1) { 
                nalType = chunkData[i+3] & 0x1F;
            } else if (chunkData[i+2] === 0 && chunkData[i+3] === 1) {
                nalType = chunkData[i+4] & 0x1F;
            }

            if (nalType === 5 || nalType === 7 || nalType === 8) {
                type = 'key';
                if (!hasReceivedKeyframe) {
                    console.log(`[VideoPlayer] SYNC SUCCESS! Initial keyframe detected (NAL=${nalType}).`);
                    setHasReceivedKeyframe(true);
                }
                break;
            }
        }
    }

    // CRITICAL: WebCodecs REQUIRES a keyframe (Type 5/IDR) as the very first decoded chunk.
    if (!hasReceivedKeyframe) return;

    if (viewerStatus !== 'streaming') {
      setViewerStatus('streaming');
    }

    try {
      const encodedChunk = new (window as any).EncodedVideoChunk({
        type: type,
        // Use total unique ID as Microsecond timestamp for WebCodecs
        timestamp: Number(timestamp), 
        data: chunkData,
      });
      decoderRef.current.decode(encodedChunk);
    } catch (e) {
      console.warn('[VideoPlayer] Decoder push failed:', e);
    }
  };

  useImperativeHandle(ref, () => ({
    feed: (buffer: Uint8Array) => {
      handleFragment(buffer);
    }
  }));

  const initDecoder = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    if (decoderRef.current) {
       try { decoderRef.current.close(); } catch {}
    }

    const decoder = new (window as any).VideoDecoder({
      output: (frame: any) => {
        ctx.drawImage(frame, 0, 0, canvasRef.current!.width, canvasRef.current!.height);
        frame.close();
      },
      error: (e: any) => {
        console.error('[VideoPlayer] Decoder hardware error:', e);
        setHasReceivedKeyframe(false); // Force wait for next IDR
        setTimeout(initDecoder, 1000); // Attempt recovery
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
  }, []);

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
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                {latency <= 0 ? 'STABLE' : `${latency}ms`} Latency
              </span>
            </div>
           <button 
             onClick={() => window.location.reload()} 
             className="text-white/40 hover:text-white transition-colors"
           >
             <ArrowLeft className="w-5 h-5" />
           </button>
        </div>
      </div>
      
      <div className="flex-grow bg-black rounded-3xl border border-white/10 overflow-hidden shadow-2xl relative group cursor-none">
        <canvas 
          ref={canvasRef} 
          className="w-full h-full object-contain" 
          width={1920} 
          height={1080}
          onMouseMove={(e) => {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
              const x = (e.clientX - rect.left) / rect.width;
              const y = (e.clientY - rect.top) / rect.height;
              onControlEvent({ type: 'mousemove', x, y });
            }
          }}
          onMouseDown={(e) => {
            onControlEvent({ type: 'mousedown', button: e.button });
          }}
          onMouseUp={(e) => {
            onControlEvent({ type: 'mouseup', button: e.button });
          }}
          onWheel={(e) => {
            // Optional: Wheel logic
          }}
          onContextMenu={(e) => {
            e.preventDefault();
          }}
        />
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
  const controlChannelRef = useRef<RTCDataChannel | null>(null);
  const lastClipboardRef = useRef<string>('');
  
  // Phase 25: Device Security State
  const [accessPassword, setAccessPassword] = useState('');
  const [devicePassword, setDevicePassword] = useState(localStorage.getItem('device_password') || '');
  const [hostAccessKey, setHostAccessKey] = useState('');
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
    if (viewerStatus !== 'streaming') return;
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

  const loadDeviceInfo = async () => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      if (!creds?.token) return;
      
      let localKey = await (window as any).electronAPI.getDeviceAccessKey();

      if (!localKey) {
        // Auto-register this specific machine
        const machineName = await (window as any).electronAPI.getMachineName?.() || 'RemoteLink PC';
        const regRes = await fetch(`http://${serverIP}:3001/api/devices/register`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${creds.token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({ name: machineName })
        });
        const newDevice = await regRes.json();
        localKey = newDevice.accessKey;
        await (window as any).electronAPI.setDeviceAccessKey(localKey);
      }

      setDeviceId(localKey); // We don't necessarily need the DB ID anymore, but keep state for set-password
      setHostAccessKey(localKey);
      console.log(`[Identity] Loaded securely: ${localKey}`);
    } catch (e: any) {
      console.error('[Identity] Load failed:', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated) loadDeviceInfo();
  }, [isAuthenticated, serverIP]);

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
            channel.onmessage = (e) => {
              try {
                const data = JSON.parse(e.data);
                if (data.type === 'clipboard' && data.text) {
                  lastClipboardRef.current = data.text;
                  (window as any).electronAPI.clipboard.writeText(data.text);
                }
              } catch (err) {}
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

  const handleRegenerateKey = async () => {
    if (!confirm("Generating a new access key means anyone using your current key will no longer be able to connect. This cannot be undone. Are you sure?")) return;
    
    try {
      const creds = await (window as any).electronAPI.getToken();
      if (!creds?.token) return;

      const devRes = await fetch(`http://${serverIP}:3001/api/devices/?machineId=undefined`, {
        headers: { 'Authorization': `Bearer ${creds.token}` }
      }); // Temporary hack to get Device ID until we fix full flow
      const devices = await devRes.json();
      const deviceIdToRegen = devices.find((d: any) => d.accessKey === hostAccessKey)?.id;

      if (!deviceIdToRegen) {
        alert("Could not identify device to regenerate.");
        return;
      }

      const res = await fetch(`http://${serverIP}:3001/api/devices/regenerate-key`, {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${creds.token}`,
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({ deviceId: deviceIdToRegen })
      });
      const data = await res.json();
      if (data.accessKey) {
        await (window as any).electronAPI.setDeviceAccessKey(data.accessKey);
        setHostAccessKey(data.accessKey);
        alert("Access key regenerated safely.");
      }
    } catch (e) {
      alert("Failed to regenerate key.");
    }
  };

  const copyAccessKey = () => {
    navigator.clipboard.writeText(hostAccessKey);
    // Simple visual feedback could go here
  };

  const handleStartHosting = async () => {
    setHostStatus('connecting');
    setHostError('');
    try {
      // 1. Get Auth Credentials
      const creds = await (window as any).electronAPI.getToken();
      if (!creds?.token) throw new Error('Please sign in first');

      // 2. Set/Sync Password if provided (deviceId and hostAccessKey are already loaded)
      if (devicePassword && deviceId) {
        localStorage.setItem('device_password', devicePassword);
        await fetch(`http://${serverIP}:3001/api/devices/set-password`, {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${creds.token}`,
            'Content-Type': 'application/json' 
          },
          body: JSON.stringify({ deviceId, password: devicePassword })
        });
      }

      // 3. Start Signaling with permanent Access Key
      const sessionId = await (window as any).electronAPI.startHosting(hostAccessKey);
      console.log(`[Host] Initialization successful. SessionID: ${sessionId}`);
      if (!sessionId) throw new Error('Signaling server did not return a Session ID');
      
      setHostSessionId(sessionId); 
      setHostStatus('idle');
    } catch (e: any) {
      console.error('[Host] Start failed:', e);
      setHostStatus('error');
      setHostError(e.message);
    }
  };

  const handleFindDevice = async () => {
    if (!sessionCode) return;
    setViewerStatus('connecting');
    setViewerError('');
    try {
      const cleanKey = sessionCode.replace(/\s/g, '');
      const res = await fetch(`http://${serverIP}:3001/api/devices/status?key=${cleanKey}`);
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 429) throw new Error('Too many checks. Please wait.');
        throw new Error(data.error || 'Failed to check status');
      }
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
      const authRes = await fetch(`http://${serverIP}:3001/api/devices/verify-access`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessKey: sessionCode.replace(/\s/g, ''), password: accessPassword })
      });
      
      const authData = await authRes.json();
      if (!authRes.ok) {
        if (authRes.status === 429 && authData.retryAfter) {
          throw new Error(`Too many attempts. Try again in ${authData.retryAfter} seconds.`);
        }
        throw new Error(authData.error || 'Access Denied');
      }

      // 2. Connect to Signaling with One-Time Token
      await (window as any).electronAPI.connectToHost(sessionCode.replace(/\s/g, ''), serverIP, authData.token);
      setViewerStatus('connected');
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
      <div className="min-h-screen bg-[#080808] p-8 flex flex-col relative">
          <div className="absolute top-4 right-4 z-50 bg-black/80 p-2 rounded border border-white/10 text-[8px] font-mono text-white/40 uppercase">
            Debug: {viewerStatus} | {viewerError || 'No Errors'}
          </div>
          <VideoPlayer 
            ref={videoPlayerRef}
            viewerStatus={viewerStatus} 
            setViewerStatus={setViewerStatus} 
            sessionCode={sessionCode} 
            onControlEvent={(event: any) => {
              if (controlChannelRef.current?.readyState === 'open') {
                controlChannelRef.current.send(JSON.stringify(event));
              }
            }}
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
            <p className="text-white/40 text-center text-sm leading-relaxed mb-8 max-w-[280px] font-medium">Broadcast this workstation to a remote viewer securely.</p>
            
            {hostAccessKey && !devicePassword && (
              <div className="w-full bg-yellow-500/10 border-l-4 border-yellow-500 text-yellow-400 p-3 rounded-r-xl text-xs font-bold mb-6 flex items-start text-left">
                No access password set — anyone with your key can connect.
              </div>
            )}

            {hostAccessKey && (
              <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 mb-8 text-center">
                 <span className="text-[10px] font-bold text-white/20 uppercase tracking-[0.2em] block mb-1">Your Permanent Access Key</span>
                 <div className="text-xl font-black text-blue-400 tracking-widest Lato mb-2">
                   {formatCode(hostAccessKey)}
                 </div>
                 <div className="flex gap-2 justify-center">
                   <button onClick={copyAccessKey} className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1 rounded transition-colors text-white/60">Copy</button>
                   <button onClick={handleRegenerateKey} className="text-xs bg-red-500/10 hover:bg-red-500/20 px-3 py-1 rounded transition-colors text-red-400">Regenerate</button>
                 </div>
              </div>
            )}

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
                
                <div className="space-y-4 mb-8 w-full">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-white/30 uppercase tracking-widest pl-4">Machine Access Password</label>
                    <input 
                      type="password"
                      placeholder="Set access password..."
                      className="w-full bg-white/[0.03] border border-white/5 text-white rounded-2xl p-4 outline-none focus:border-emerald-500/50 transition-all text-sm"
                      value={devicePassword}
                      onChange={(e) => setDevicePassword(e.target.value)}
                    />
                  </div>
                </div>

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
              
              {viewerStep === 1 && (
                <>
                  <div className="relative mb-4">
                    <input 
                      type="text" 
                      placeholder="000 000 000" 
                      className="w-full bg-black/40 border border-white/10 text-white rounded-[2rem] p-8 outline-none focus:border-blue-500 focus:bg-white/[0.04] transition-all text-center text-4xl font-black tracking-[0.15em] Lato disabled:opacity-50"
                      value={sessionCode}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\s/g, '');
                        if (raw.length <= 9) setSessionCode(formatCode(raw));
                      }}
                      disabled={viewerStatus === 'connecting'}
                    />
                  </div>

                  <button 
                    onClick={handleFindDevice}
                    disabled={viewerStatus === 'connecting' || sessionCode.replace(/\s/g, '').length !== 9}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-6 rounded-3xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm"
                  >
                    {viewerStatus === 'connecting' ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Find Machine <ArrowRight className="w-4 h-4 ml-2" /></>}
                  </button>
                </>
              )}

              {viewerStep === 2 && (
                <>
                  <div className="mb-6 text-center">
                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">Target Identified</span>
                    <span className="text-sm font-mono text-white/60 tracking-widest">{sessionCode}</span>
                  </div>
                  <div className="relative mb-6">
                    <input 
                      type="password" 
                      placeholder="Access Password" 
                      className="w-full bg-black/20 border border-white/5 text-white rounded-2xl p-5 outline-none focus:border-blue-500/50 transition-all text-center text-sm font-bold tracking-widest uppercase disabled:opacity-50"
                      value={accessPassword}
                      onChange={(e) => setAccessPassword(e.target.value)}
                      disabled={viewerStatus === 'connecting'}
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <button 
                      onClick={() => { setViewerStep(1); setViewerError(''); }}
                      disabled={viewerStatus === 'connecting'}
                      className="w-1/3 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-white/50 font-bold py-6 rounded-3xl transition-all uppercase tracking-widest text-xs"
                    >
                      Back
                    </button>
                    <button 
                      onClick={handleConnectToHost}
                      disabled={viewerStatus === 'connecting' || !accessPassword}
                      className="w-2/3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-black py-6 rounded-3xl transition-all shadow-xl shadow-blue-600/20 flex items-center justify-center gap-3 uppercase tracking-[0.2em] text-sm"
                    >
                      {viewerStatus === 'connecting' ? <Loader2 className="w-6 h-6 animate-spin" /> : <>Connect <Shield className="w-4 h-4 ml-2" /></>}
                    </button>
                  </div>
                </>
              )}
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
