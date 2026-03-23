import React, { useState, useEffect, useRef } from 'react';
// Force-syncing file state to resolve HMR/Vite discrepancies.
import {
  Activity, Monitor, ArrowLeft, ArrowRight, Zap, LogOut, Copy, Settings, MousePointer2, Loader2, Play, KeyRound, Shield, Smartphone, Plus, Search, MoreVertical, CheckCircle2, X
, Sun, Moon, Edit2, Trash2, ShieldOff, RefreshCw} from 'lucide-react';

import { useImperativeHandle, forwardRef } from 'react';

// --- Video Player Component (WebCodecs + Canvas) ---
// --- Video Player Component (WebCodecs + Canvas) ---
const VideoPlayer = forwardRef(({ viewerStatus, setViewerStatus, sessionCode, onControlEvent, onDisconnect }: any, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [latency, setLatency] = useState<number>(0);
  const decoderRef = useRef<any>(null);
  const [hasReceivedKeyframe, setHasReceivedKeyframe] = useState(false);
  const [transferProgress, setTransferProgress] = useState<{name: string, p: number} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      <div className="flex items-center justify-between bg-slate-100 dark:bg-white/5 backdrop-blur-md p-4 rounded-2xl border border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Monitor className="text-slate-900 dark:text-white w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Viewing Remote Host</h2>
            <p className="text-[10px] text-slate-500 dark:text-white/40 font-mono tracking-widest leading-none mt-1">{sessionCode}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
            {transferProgress && (
              <div className="flex flex-col items-end gap-1">
                <span className="text-[8px] font-bold text-blue-400 uppercase tracking-widest">Sending {transferProgress.name}</span>
                <div className="w-24 h-1 bg-blue-500/20 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: `${transferProgress.p}%` }} />
                </div>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                
                const CHUNK_SIZE = 16 * 1024; // 16KB
                const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
                const reader = new FileReader();

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
                  
                  // Throttling to prevent overwhelming the data channel
                  if (i % 5 === 0) await new Promise(r => setTimeout(r, 10));
                }
                
                setTimeout(() => setTransferProgress(null), 2000);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg border border-blue-500/20 text-blue-400 transition"
              title="Transfer File"
            >
              <Plus className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-full border border-emerald-500/20">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">
                {latency <= 0 ? 'STABLE' : `${latency}ms`} Latency
              </span>
            </div>
           <button 
             onClick={onDisconnect} 
             className="text-slate-500 dark:text-white/40 hover:text-slate-900 dark:text-white transition-colors"
           >
             <ArrowLeft className="w-5 h-5" />
           </button>
        </div>
      </div>
      
      <div className="flex-grow bg-black rounded-3xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl relative group cursor-none">
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
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

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

  const [viewerStatus, setViewerStatus] = useState<'idle' | 'connecting' | 'error' | 'connected' | 'streaming' | 'connection_lost'>('idle');
  const [viewerError, setViewerError] = useState('');
  const videoPlayerRef = useRef<any>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const candidatesBuffer = useRef<RTCIceCandidateInit[]>([]);
  const controlChannelRef = useRef<RTCDataChannel | null>(null);
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
    setIsAuthenticated(false);
    await (window as any).electronAPI.deleteToken();
  };
  const lastClipboardRef = useRef<string>('');
  
  
  // --- New Device Management State ---
  const [devices, setDevices] = useState<any[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [showPasswordPrompt, setShowPasswordPrompt] = useState<any | null>(null); // { device }
  const [promptPassword, setPromptPassword] = useState('');
  const [promptRemember, setPromptRemember] = useState(true);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addKey, setAddKey] = useState('');
  const [addPassword, setAddPassword] = useState('');

  const [contextMenuMsg, setContextMenuMsg] = useState(''); // Tooltip offline
  const [contextMenuId, setContextMenuId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState('');

  const [actionModal, setActionModal] = useState<{ type: 'rename' | 'password' | 'remove' | 'regenerate', device: any } | null>(null);
  const [actionValue, setActionValue] = useState('');

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
    setViewerStatus('idle');
    pollDevices();
  };

  const pollDevices = async () => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      if (!creds?.token) return;
      const res = await fetch(`http://${serverIP}:3001/api/devices/mine`, {
        headers: { 'Authorization': `Bearer ${creds.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
        setGlobalError('');
      } else if (res.status === 401) {
        const creds = await (window as any).electronAPI.getToken();
        if (creds?.refresh) {
          await handleRefresh(creds.refresh);
          pollDevices();
          return;
        }
        await (window as any).electronAPI.deleteToken();
        setIsAuthenticated(false);
        setGlobalError('Session expired. Please log in again.');
      }
    } catch (e: any) {
      if (e.message.includes('401')) handleLogout();
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      pollDevices();
      const interval = setInterval(pollDevices, 10000); // 10s polling for online status
      
      const handleFocus = () => pollDevices();
      window.addEventListener('focus', handleFocus);
      
      return () => {
        clearInterval(interval);
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [isAuthenticated, serverIP]);
  
  // Handlers for the UI
  const handleDeviceClick = async (device: any) => {
    if (!device.is_online) {
      setGlobalError(`${device.device_name} is currently offline.`);
      return;
    }
    setSelectedDevice(device);
    setViewerStatus('connecting');
    setViewerError('');
    try {
      const creds = await (window as any).electronAPI.getToken();
      const res = await fetch(`http://${serverIP}:3001/api/devices/verify-access`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creds.token}`
        },
        body: JSON.stringify({ accessKey: device.access_key, password: '' })
      });
      const data = await res.json();
      if (res.ok) {
        // Trusted bypass logic succeeded!
        await (window as any).electronAPI.connectToHost(device.access_key, serverIP, data.token);
        setSessionCode(device.access_key);
        setViewerStatus('connected');
      } else if (res.status === 401) {
        // Password required
        setViewerStatus('idle');
        setPromptPassword('');
        setPromptRemember(true);
        setShowPasswordPrompt(device);
      } else {
        throw new Error(data.error || 'Failed to verify access');
      }
    } catch (e: any) {
      setViewerStatus('idle');
      setGlobalError(e.message || 'Connection failed.');
    }
  };

  const submitPasswordPrompt = async () => {
    if (!showPasswordPrompt || !promptPassword) return;
    const device = showPasswordPrompt;
    setViewerStatus('connecting');
    try {
      const creds = await (window as any).electronAPI.getToken();
      const res = await fetch(`http://${serverIP}:3001/api/devices/verify-access`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creds.token}`
        },
        body: JSON.stringify({ accessKey: device.access_key, password: promptPassword })
      });
      const data = await res.json();
      if (res.ok) {
        if (promptRemember) {
           await fetch(`http://${serverIP}:3001/api/devices/${device.id}/trust`, {
             method: 'POST',
             headers: { 'Authorization': `Bearer ${creds.token}` }
           });
        }
        await (window as any).electronAPI.connectToHost(device.access_key, serverIP, data.token);
        setSessionCode(device.access_key);
        setViewerStatus('connected');
        setShowPasswordPrompt(null);
      } else {
        throw new Error(data.error || 'Access Denied');
      }
    } catch (e: any) {
      setViewerStatus('idle');
      setGlobalError(e.message || 'Connection failed.');
    }
  };

  const handleAddDevice = async () => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      const res = await fetch(`http://${serverIP}:3001/api/devices/add-existing`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creds.token}`
        },
        body: JSON.stringify({ accessKey: addKey, password: addPassword })
      });
      const data = await res.json();
      if (res.ok) {
        setShowAddModal(false);
        setAddKey('');
        setAddPassword('');
        pollDevices();
      } else {
        setGlobalError(data.error || 'Failed to add device');
      }
    } catch (e) {
      setGlobalError('Network error adding device');
    }
  };

  const handleRename = async (device: any) => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      const res = await fetch(`http://${serverIP}:3001/api/devices/${device.id}/name`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${creds.token}`
        },
        body: JSON.stringify({ device_name: actionValue })
      });
      if (!res.ok) throw new Error('Rename failed');
      pollDevices();
      setActionModal(null);
      if (selectedDevice?.id === device.id) setSelectedDevice({ ...selectedDevice, device_name: actionValue });
    } catch (e: any) { setGlobalError(e.message); }
  };

  const handleRemove = async (device: any) => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      const res = await fetch(`http://${serverIP}:3001/api/devices/${device.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${creds.token}` }
      });
      if (!res.ok) throw new Error('Removal failed');
      pollDevices();
      setActionModal(null);
      if (selectedDevice?.id === device.id) setSelectedDevice(null);
    } catch (e: any) { setGlobalError(e.message); }
  };

  const handleRevokeTrust = async (id: string) => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      await fetch(`http://${serverIP}:3001/api/devices/${id}/trust`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${creds.token}` }
      });
      setGlobalError('Success: Trust revoked for this device.');
      pollDevices();
    } catch (e) {}
  };

  const handleRegenerateDeviceKey = async (device: any) => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      const res = await fetch(`http://${serverIP}:3001/api/devices/regenerate-key`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${creds.token}` },
        body: JSON.stringify({ deviceId: device.id })
      });
      if (!res.ok) throw new Error('Regen failed');
      pollDevices();
      setActionModal(null);
    } catch (e: any) { setGlobalError(e.message); }
  };

  const handleSetPassword = async (device: any) => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      const res = await fetch(`http://${serverIP}:3001/api/devices/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${creds.token}` },
        body: JSON.stringify({ deviceId: device.id, password: actionValue })
      });
      if (!res.ok) throw new Error('Password update failed');
      pollDevices();
      setActionModal(null);
      setGlobalError('Success: Hardware password updated.');
    } catch (e: any) { setGlobalError(e.message); }
  };

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
      let deviceUuid = '';

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
        
        if (newDevice.accessKey) {
          localKey = newDevice.accessKey;
          deviceUuid = newDevice.id;
          await (window as any).electronAPI.setDeviceAccessKey(localKey);
        } else {
          console.error('[Identity] Registration returned no key:', newDevice);
        }
      } else {
        // We have a local key, but we need the database UUID for password/regen actions
        const listRes = await fetch(`http://${serverIP}:3001/api/devices/mine`, {
          headers: { 'Authorization': `Bearer ${creds.token}` }
        });
        
        if (listRes.ok) {
          const fetchedDevices = await listRes.json();
          setDevices(fetchedDevices); // Populate device list immediately on load
          if (Array.isArray(fetchedDevices)) {
            const existing = fetchedDevices.find((d: any) => d.accessKey === localKey);
            if (existing) {
              deviceUuid = existing.id;
            }
          } else {
            console.error('[Identity] Device list is not an array:', devices);
          }
        } else if (listRes.status === 401) {
          console.warn('[Identity] Session expired or invalid. Attempting refresh...');
          const creds = await (window as any).electronAPI.getToken();
          if (creds?.refresh) {
            await handleRefresh(creds.refresh);
            // Retry once after refresh
            loadDeviceInfo();
            return;
          }
          handleLogout();
        } else {
          console.error('[Identity] Failed to fetch device list:', listRes.status);
        }
      }

      if (localKey) {
        setDeviceId(deviceUuid);
        setHostAccessKey(localKey);
        console.log(`[Identity] Locked Identity: ${localKey} (ID: ${deviceUuid})`);
      }
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
             console.warn('[Renderer] WebRTC Connection timeout.');
             setViewerStatus('connection_lost');
             pc.close();
          }
        }, 15000); // 15s timeout for ICE/handshake

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

    const removeSignalingDisconnected = (window as any).electronAPI.onSignalingDisconnected?.(() => {
      console.log('[Renderer] Signaling disconnected unexpectedly.');
      setViewerStatus('connection_lost');
    });

    return () => {
      removeHostListener();
      removeSignalingListener();
      if (removeSignalingDisconnected) removeSignalingDisconnected();
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
      let res = await fetch(`http://${serverIP}:3001/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      let data = await res.json();
      
      // Auto-register if user doesn't exist (smooth onboarding for demo purposes)
      if (!res.ok && data.error === 'Invalid credentials') {
        const regRes = await fetch(`http://${serverIP}:3001/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: email.split('@')[0] })
        });
        if (regRes.ok) {
          res = regRes;
          data = await regRes.json();
        }
      }

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

      if (!hostAccessKey) {
        throw new Error('Permanent identity not loaded. Please wait or re-sign in.');
      }

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
      console.log(`[Host] Identity Registered with signaling: ${sessionId}`);
      
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#080808]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-blue-500/20 rounded-full" />
            <div className="absolute inset-0 w-16 h-16 border-4 border-t-blue-500 rounded-full animate-spin" />
          </div>
          <span className="text-slate-500 dark:text-white/40 text-xs font-bold uppercase tracking-[0.2em]">Initializing</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#080808] p-8">
        <div className="w-full max-w-md bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/10 rounded-[2.5rem] p-10 backdrop-blur-3xl shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="mb-10 text-center">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-blue-600/20">
              <Zap className="text-slate-900 dark:text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-[900] text-slate-900 dark:text-white tracking-tight mb-2 uppercase">RemoteLink</h1>
            <p className="text-slate-500 dark:text-white/40 text-sm tracking-wide font-medium">Access power from anywhere.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest pl-4">Email Address</label>
               <input 
                type="email" 
                required
                className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-2xl p-4 outline-none focus:border-blue-500/50 focus:bg-slate-50 dark:bg-white/[0.05] transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
               <label className="text-[10px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-widest pl-4">Password</label>
               <input 
                type="password" 
                required
                className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-2xl p-4 outline-none focus:border-blue-500/50 focus:bg-slate-50 dark:bg-white/[0.05] transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="text-red-400 text-xs font-medium text-center bg-red-500/10 py-3 rounded-xl border border-red-500/20">{error}</div>}
            
            <div className="pt-2">
              <div className="flex items-center justify-between">
                <button 
                  type="button"
                  onClick={() => setShowSettings(!showSettings)}
                  className="text-[10px] font-bold text-slate-400 dark:text-white/20 hover:text-slate-600 dark:text-white/50 transition-colors uppercase tracking-widest flex items-center gap-2"
                >
                  <Settings className={`w-3 h-3 ${showSettings ? 'animate-spin-slow' : ''}`} />
                  {showSettings ? 'Hide Network Settings' : 'Advanced Network Settings'}
                </button>
                <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="text-slate-500 dark:text-white/30 hover:text-slate-900 dark:text-white transition group flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
                  {theme === 'dark' ? <><Sun className="w-3 h-3 group-hover:rotate-90 transition-transform" /> Light Mode</> : <><Moon className="w-3 h-3 group-hover:-rotate-12 transition-transform" /> Dark Mode</>}
                </button>
              </div>
              
              {showSettings && (
                <div className="mt-4 p-4 bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-[0.2em]">Signaling Server IP</label>
                    <input 
                      type="text"
                      className="w-full bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 text-slate-700 dark:text-white/70 text-xs rounded-xl p-3 outline-none focus:border-blue-500/30 transition-all font-mono"
                      value={serverIP}
                      onChange={(e) => setServerIP(e.target.value)}
                      placeholder="e.g. 192.168.1.15"
                    />
                  </div>
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[9px] font-medium text-slate-400 dark:text-white/20 uppercase tracking-widest">This Device IP</span>
                    <span className="text-[9px] font-mono text-blue-400/50">{localIP}</span>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-blue-600/20 hover:scale-[1.02] active:scale-95 uppercase tracking-widest text-sm mt-4">
              Unlock Terminal
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- Main Dashboard ---
  if (viewerStatus === 'streaming' || viewerStatus === 'connected' || viewerStatus === 'connection_lost') {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#080808] p-8 flex flex-col relative">
          <div className="absolute top-4 right-4 z-50 bg-white/80 dark:bg-black/80 p-2 rounded border border-slate-200 dark:border-white/10 text-[8px] font-mono text-slate-500 dark:text-white/40 uppercase">
            Debug: {viewerStatus} | {viewerError || 'No Errors'}
          </div>

          {viewerStatus === 'connection_lost' && (
            <div className="absolute inset-0 z-[100] bg-slate-100/95 dark:bg-[#050505]/95 backdrop-blur-xl flex flex-col items-center justify-center animate-in fade-in">
              <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mb-8 border border-red-500/20 shadow-2xl shadow-red-500/10">
                <Monitor className="text-red-500 w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tight">Connection Lost</h2>
              <p className="text-slate-500 dark:text-white/40 text-sm mb-10 tracking-wide font-medium">The remote host went offline or the network dropped.</p>
              <div className="flex gap-4">
                <button 
                  onClick={handleDisconnect}
                  className="px-8 py-4 rounded-2xl border border-slate-200 dark:border-white/10 text-slate-700 dark:text-white/70 hover:bg-slate-100 dark:bg-white/5 transition-all font-bold text-xs uppercase tracking-widest"
                >
                  Return Home
                </button>
                <button 
                  onClick={() => handleFindDevice()}
                  className="px-8 py-4 rounded-2xl bg-blue-600 hover:bg-blue-500 flex items-center gap-2 text-slate-900 dark:text-white transition-all font-bold text-xs uppercase tracking-widest shadow-lg shadow-blue-500/20"
                >
                  Reconnect
                </button>
              </div>
            </div>
          )}

          <VideoPlayer 
            ref={videoPlayerRef}
            viewerStatus={viewerStatus} 
            setViewerStatus={setViewerStatus} 
            sessionCode={sessionCode} 
            onDisconnect={handleDisconnect}
            onControlEvent={(event: any) => {
              if (controlChannelRef.current?.readyState !== 'open') return;
              
              if (event instanceof Uint8Array) {
                // Binary Data (File Transfer)
                (controlChannelRef.current as any).send(event);
              } else if (event.type === 'mousemove') {
                throttledMouseMove(event);
              } else {
                // Standard JSON Control Event (Mouse/KB/Clipboard)
                controlChannelRef.current.send(JSON.stringify(event));
              }
            }}
          />
      </div>
    );
  }


  return (
    <div className="h-screen w-full bg-slate-50 dark:bg-[#080808] text-slate-900 dark:text-white font-sans selection:bg-blue-500/30 flex overflow-hidden">
      {globalError && (
        <div className="absolute top-0 left-0 right-0 bg-red-600 text-slate-900 dark:text-white text-center py-2 text-xs font-bold z-[100] flex justify-between px-4 items-center animate-in slide-in-from-top-4">
           <span>{globalError}</span>
           <button onClick={() => setGlobalError('')} className="hover:bg-black/20 p-1 rounded"><X className="w-3 h-3" /></button>
        </div>
      )}
      
      {/* SIDEBAR: My Devices */}
      <div className="w-[340px] border-r border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0a0a] flex flex-col z-10 shrink-0">
        <div className="p-6 border-b border-slate-200 dark:border-white/5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Zap className="text-slate-900 dark:text-white w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white/90">My Devices</h2>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="w-8 h-8 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 rounded-full flex items-center justify-center border border-slate-200 dark:border-white/10 transition" title="Toggle Theme">
                {theme === 'dark' ? <Sun className="w-4 h-4 text-slate-500 dark:text-white/40" /> : <Moon className="w-4 h-4 text-slate-500 dark:text-white/40" />}
              </button>
              <button title="Add Existing Device" onClick={() => setShowAddModal(true)} className="w-8 h-8 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 rounded-full flex items-center justify-center border border-slate-200 dark:border-white/10 transition">
                <Plus className="w-4 h-4" />
              </button>
              <button 
                onClick={handleLogout}
                className="w-8 h-8 bg-red-500/10 hover:bg-red-500/20 rounded-full flex items-center justify-center text-red-400 border border-red-500/20 transition"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-white/30" />
            <input 
              type="text" 
              placeholder="Search devices..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs font-mono text-slate-800 dark:text-white/80 outline-none focus:border-blue-500/50 transition"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {devices.filter(d => !searchQuery || d.device_name?.toLowerCase().includes(searchQuery.toLowerCase())).map(device => (
            <div 
              key={device.id} 
              onContextMenu={(e) => { e.preventDefault(); setContextMenuId(contextMenuId === device.id ? null : device.id); }}
              onClick={() => {
                if (!device.is_online) { setGlobalError(`${device.device_name} is currently offline.`); return; }
                handleDeviceClick(device);
              }}
              className={`relative p-4 rounded-2xl border transition-all cursor-pointer group ${selectedDevice?.id === device.id ? 'bg-blue-600/10 border-blue-500/30' : 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/5 hover:bg-slate-100 dark:bg-white/[0.04]'}`}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 bg-slate-100 dark:bg-white/5 rounded-xl flex items-center justify-center shadow-inner">
                    {device.device_type === 'ios' || device.device_type === 'android' ? 
                      <Smartphone className={`w-5 h-5 ${device.is_online ? 'text-emerald-400' : 'text-slate-400 dark:text-gray-500'}`} /> : 
                      <Monitor className={`w-5 h-5 ${device.is_online ? 'text-emerald-400' : 'text-slate-400 dark:text-gray-500'}`} />
                    }
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white/90 truncate max-w-[150px]">{device.device_name || 'Unnamed Device'}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${device.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}`} />
                      <span className="text-[10px] font-mono text-slate-500 dark:text-white/40 uppercase tracking-wider">{device.is_online ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setContextMenuId(contextMenuId === device.id ? null : device.id); }} className="p-1 opacity-0 group-hover:opacity-100 transition"><MoreVertical className="w-4 h-4 text-slate-500 dark:text-white/40" /></button>
              </div>

              {contextMenuId === device.id && (
                <div className="absolute right-2 top-12 w-56 bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 shadow-2xl rounded-xl p-2 z-50 flex flex-col gap-1 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                  {device.is_online && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeviceClick(device); setContextMenuId(null); }}
                      className="flex items-center gap-3 px-3 py-2.5 text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-emerald-600 dark:text-emerald-400 transition-colors"
                    >
                      <Play className="w-4 h-4" /> Connect Now
                    </button>
                  )}
                  <div className="h-px bg-slate-200 dark:bg-white/5 my-1" />
                  <button onClick={(e) => { e.stopPropagation(); setActionModal({ type: 'rename', device }); setActionValue(device.device_name); setContextMenuId(null); }} className="flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-700 dark:text-white/70 transition-colors">
                    <Edit2 className="w-4 h-4" /> Rename Device
                  </button>
                  
                  {device.is_owned && (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setActionModal({ type: 'password', device }); setActionValue(''); setContextMenuId(null); }} className="flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-700 dark:text-white/70 transition-colors">
                        <KeyRound className="w-4 h-4" /> Change Password
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); setActionModal({ type: 'regenerate', device }); setContextMenuId(null); }} className="flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-700 dark:text-white/70 transition-colors">
                        <RefreshCw className="w-4 h-4" /> Regenerate Key
                      </button>
                    </>
                  )}

                  {!device.is_owned && (
                    <button onClick={(e) => { e.stopPropagation(); handleRevokeTrust(device.id); setContextMenuId(null); }} className="flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg text-slate-700 dark:text-white/70 transition-colors">
                      <ShieldOff className="w-4 h-4" /> Revoke Trust
                    </button>
                  )}

                  <div className="h-px bg-slate-200 dark:bg-white/5 my-1" />
                  <button onClick={(e) => { e.stopPropagation(); setActionModal({ type: 'remove', device }); setContextMenuId(null); }} className="flex items-center gap-3 px-3 py-2 text-xs font-bold hover:bg-red-500/10 text-red-500 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" /> {device.is_owned ? 'Delete Device' : 'Unlink Device'}
                  </button>
                </div>
              )}
            </div>
          ))}
          {devices.length === 0 && (
            <div className="text-center p-8 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl mt-4">
               <Monitor className="w-8 h-8 text-slate-400 dark:text-white/20 mx-auto mb-3" />
               <p className="text-xs text-slate-500 dark:text-white/40 font-mono">No devices linked.</p>
            </div>
          )}
        </div>
      </div>

      {/* MAIN PANEL */}
      <div className="flex-1 bg-slate-100 dark:bg-[#050505] relative overflow-y-auto">
        <div className="max-w-4xl mx-auto p-12 w-full h-full flex flex-col items-center justify-center">
          
          {!selectedDevice ? (
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
               <section className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-3xl p-8 flex flex-col items-center relative overflow-hidden group hover:border-slate-300 dark:border-white/20 transition">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-2xl">
                    <KeyRound className="text-blue-400 w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">Connect Manually</h3>
                  <p className="text-slate-500 dark:text-white/40 text-center text-xs mb-8">Enter an access key and password to connect to an external machine.</p>
                  <div className="w-full space-y-3 mt-auto">
                    <input type="text" placeholder="000 000 000" className="w-full bg-slate-200 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl p-4 text-center text-xl font-mono focus:border-blue-500 outline-none" value={sessionCode} onChange={(e) => setSessionCode(formatCode(e.target.value))} />
                    <input type="password" placeholder="Password" className="w-full bg-slate-200 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl p-4 text-center text-sm focus:border-blue-500 outline-none" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} />
                    <button onClick={handleConnectToHost} disabled={!sessionCode || !accessPassword || viewerStatus === 'connecting'} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-slate-900 dark:text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 uppercase text-xs tracking-wider">{viewerStatus === 'connecting' ? 'Connecting...' : 'Connect'}</button>
                  </div>
               </section>

               <section className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-3xl p-8 flex flex-col items-center relative overflow-hidden group hover:border-slate-300 dark:border-white/20 transition">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20 shadow-2xl">
                    <Activity className="text-emerald-400 w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">Host Machine</h3>
                  <p className="text-slate-500 dark:text-white/40 text-center text-xs mb-6">Allow remote viewers to access this physical machine.</p>
                  
                  {hostAccessKey && (
                     <div className="w-full bg-white dark:bg-[#111] p-6 rounded-2xl border border-slate-200 dark:border-white/5 text-center mb-4">
                       <span className="text-[9px] font-bold text-emerald-400/50 uppercase tracking-widest">{hostSessionId ? 'Broadcasting ID' : 'Your Permanent Key'}</span>
                       <div 
                         onClick={copyAccessKey} 
                         className="text-2xl font-mono text-emerald-400 mt-2 mb-4 cursor-pointer hover:scale-105 transition-transform active:scale-95" 
                         title="Click to copy host key"
                       >
                         {formatCode(hostAccessKey)}
                       </div>
                       {hostSessionId ? 
                         <button onClick={async () => { await (window as any).electronAPI.stopHosting(); setHostSessionId(''); }} className="w-full bg-red-500/10 text-red-400 text-xs py-2 rounded-lg font-bold">Stop Broadcasting</button> :
                         <div className="flex gap-2"><button onClick={copyAccessKey} className="flex-1 bg-slate-100 dark:bg-white/5 text-xs py-2 rounded-lg hover:bg-slate-200 dark:bg-white/10">Copy</button><button onClick={handleRegenerateDeviceKey} className="flex-1 bg-red-500/10 text-red-500/70 text-xs py-2 rounded-lg hover:bg-red-500/20">Regenerate</button></div>
                       }
                     </div>
                  )}

                  {!hostSessionId && (
                     <div className="w-full mt-auto space-y-3">
                       <input type="password" placeholder="Set Access Password..." className="w-full bg-slate-200 dark:bg-black/40 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl p-4 text-center text-sm focus:border-emerald-500 outline-none" value={devicePassword} onChange={e => setDevicePassword(e.target.value)} />
                       <button onClick={handleStartHosting} disabled={hostStatus === 'connecting'} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-900 dark:text-white font-bold py-4 rounded-xl text-center uppercase text-xs tracking-wider">{hostStatus === 'connecting' ? 'Starting...' : 'Start Hosting'}</button>
                     </div>
                  )}
               </section>
            </div>
          ) : (
            <div className="w-full max-w-2xl bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-[3rem] p-12 flex flex-col items-center animate-in fade-in slide-in-from-right-8">
               <div className="w-32 h-32 bg-blue-500/10 rounded-[2.5rem] flex items-center justify-center mb-8 border border-blue-500/20 shadow-2xl">
                 {selectedDevice.device_type === 'ios' || selectedDevice.device_type === 'android' ? 
                    <Smartphone className="text-blue-400 w-16 h-16" /> : 
                    <Monitor className="text-blue-400 w-16 h-16" />
                 }
               </div>
               
               <div className="flex items-center gap-2 mb-2">
                 <h2 className="text-4xl font-[900] uppercase tracking-tight">{selectedDevice.device_name || 'Unnamed'}</h2>
                 {selectedDevice.is_owned && <Shield className="w-5 h-5 text-emerald-400 ml-2" />}
               </div>
               
               <div className="flex gap-6 mt-4 opacity-60 font-mono text-sm">
                 <span>ID: {formatCode(selectedDevice.access_key)}</span>
                 <span className="uppercase text-blue-400">{selectedDevice.device_type}</span>
               </div>
               
               <div className="mt-12 w-full flex gap-4">
                 <button onClick={() => setSelectedDevice(null)} className="w-1/3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:bg-white/10 rounded-2xl py-5 font-bold uppercase tracking-widest text-xs transition">Back</button>
                 <button onClick={() => handleDeviceClick(selectedDevice)} disabled={viewerStatus === 'connecting'} className="w-2/3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl py-5 font-black uppercase tracking-widest text-sm flex justify-center items-center gap-2 shadow-2xl shadow-blue-500/20 transition">
                   {viewerStatus === 'connecting' ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Connect <ArrowRight className="w-4 h-4 ml-2" /></>}
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>

      {showPasswordPrompt && (
        <div className="absolute inset-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center animate-in fade-in">
           <div className="max-w-md w-full bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold uppercase tracking-widest">Connect to {showPasswordPrompt.device_name || 'Device'}</h3>
                <button onClick={() => setShowPasswordPrompt(null)} className="p-2 hover:bg-slate-200 dark:bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
             </div>
             <input type="password" placeholder="Device Password" value={promptPassword} onChange={e => setPromptPassword(e.target.value)} className="w-full bg-black border border-slate-200 dark:border-white/10 rounded-xl p-4 mb-4 outline-none focus:border-blue-500 font-mono text-center text-lg" autoFocus />
             <label className="flex items-center gap-3 cursor-pointer mb-8 opacity-70 hover:opacity-100">
                <input type="checkbox" checked={promptRemember} onChange={e => setPromptRemember(e.target.checked)} className="w-5 h-5 rounded border-slate-300 dark:border-white/20" />
                <span className="text-sm font-medium">Trust this device (skip password next time)</span>
             </label>
             <button onClick={submitPasswordPrompt} disabled={!promptPassword || viewerStatus === 'connecting'} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-4 rounded-xl font-bold uppercase tracking-widest text-sm">Submit</button>
           </div>
        </div>
      )}

      {showAddModal && (
        <div className="absolute inset-0 z-50 bg-white/80 dark:bg-black/80 backdrop-blur-xl flex items-center justify-center animate-in fade-in">
           <div className="max-w-md w-full bg-white dark:bg-[#111] border border-slate-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold uppercase tracking-widest">Add Device</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-200 dark:bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
             </div>
             <p className="text-xs text-slate-600 dark:text-white/50 mb-6 leading-relaxed">Enter the access key and password of a device you want to save to your personal list (for example, a friend's PC or a work computer).</p>
             <div className="space-y-4 mb-8">
               <input type="text" placeholder="Access Key" value={addKey} onChange={e => setAddKey(e.target.value)} className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl p-4 outline-none focus:border-emerald-500 font-mono" />
               <input type="password" placeholder="Password" value={addPassword} onChange={e => setAddPassword(e.target.value)} className="w-full bg-white dark:bg-black border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white rounded-xl p-4 outline-none focus:border-emerald-500 font-mono" />
             </div>
             <button onClick={handleAddDevice} disabled={!addKey || !addPassword} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-4 rounded-xl font-bold uppercase tracking-widest text-sm">Save Device</button>
           </div>
        </div>
      )}

      {/* Device Action Modal */}
      {actionModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setActionModal(null)} />
          <div className="w-full max-w-sm bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-white/10 rounded-3xl p-8 z-10 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
            <div className="mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 uppercase tracking-tight">
                {actionModal.type === 'rename' ? 'Rename Device' : 
                 actionModal.type === 'password' ? 'Hardware Password' :
                 actionModal.type === 'remove' ? 'Remove Device' : 'Regenerate Key'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-white/40 font-medium">
                {actionModal.type === 'rename' ? 'Give this machine a unique name to identify it easily.' :
                 actionModal.type === 'password' ? 'This password will be required when others try to view this host.' :
                 actionModal.type === 'remove' ? `Are you sure you want to ${actionModal.device.is_owned ? 'permanently delete' : 'unlink'} ${actionModal.device.device_name}?` :
                 'This will change the permanent access key. Existing linked machines will need to be re-added.'}
              </p>
            </div>

            {(actionModal.type === 'rename' || actionModal.type === 'password') && (
              <input 
                autoFocus
                type={actionModal.type === 'password' ? 'password' : 'text'}
                placeholder={actionModal.type === 'password' ? 'New hardware password' : 'Work PC, Living Room, etc.'}
                className="w-full bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-xl p-4 mb-6 outline-none focus:border-blue-500 transition-all font-mono text-sm"
                value={actionValue}
                onChange={e => setActionValue(e.target.value)}
              />
            )}

            <div className="flex gap-3">
              <button 
                onClick={() => setActionModal(null)}
                className="flex-1 py-3 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-white/70 font-bold rounded-xl text-xs uppercase tracking-widest transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (actionModal.type === 'rename') handleRename(actionModal.device);
                  if (actionModal.type === 'remove') handleRemove(actionModal.device);
                  if (actionModal.type === 'password') handleSetPassword(actionModal.device);
                  if (actionModal.type === 'regenerate') handleRegenerateDeviceKey(actionModal.device);
                }}
                className={`flex-1 py-3 font-bold rounded-xl text-xs uppercase tracking-widest transition-all ${actionModal.type === 'remove' ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/20' : 'bg-blue-600 hover:bg-blue-500 text-slate-900 dark:text-white shadow-lg shadow-blue-600/20'}`}
              >
                {actionModal.type === 'remove' ? 'Confirm' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
