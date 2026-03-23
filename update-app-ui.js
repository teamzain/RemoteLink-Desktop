const fs = require('fs');
const path = require('path');

const appPath = path.join('f:', 'TechVision', 'RemoteLink', 'apps', 'desktop', 'src', 'renderer', 'App.tsx');
let code = fs.readFileSync(appPath, 'utf8');

// 1. Add new Lucide icons to imports
code = code.replace(
  /Monitor, ArrowLeft, ArrowRight, Zap, LogOut, Copy, Settings, MousePointer2, Loader2, Play, KeyRound, Shield/g,
  'Monitor, ArrowLeft, ArrowRight, Zap, LogOut, Copy, Settings, MousePointer2, Loader2, Play, KeyRound, Shield, Smartphone, Plus, Search, MoreVertical, CheckCircle2, X'
);

// 2. Insert new State variables right before useEffects
const stateVars = `
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

  const pollDevices = async () => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      if (!creds?.token) return;
      const res = await fetch(\`http://\${serverIP}:3001/api/devices/mine\`, {
        headers: { 'Authorization': \`Bearer \${creds.token}\` }
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(data);
      }
    } catch {}
  };

  useEffect(() => {
    if (isAuthenticated) {
      pollDevices();
      const interval = setInterval(pollDevices, 30000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated, serverIP]);
  
  // Handlers for the UI
  const handleDeviceClick = async (device: any) => {
    if (!device.is_online) return;
    setSelectedDevice(device);
    setViewerStatus('connecting');
    setViewerError('');
    try {
      const creds = await (window as any).electronAPI.getToken();
      const res = await fetch(\`http://\${serverIP}:3001/api/devices/verify-access\`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${creds.token}\`
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
      alert(e.message);
    }
  };

  const submitPasswordPrompt = async () => {
    if (!showPasswordPrompt || !promptPassword) return;
    const device = showPasswordPrompt;
    setViewerStatus('connecting');
    try {
      const creds = await (window as any).electronAPI.getToken();
      const res = await fetch(\`http://\${serverIP}:3001/api/devices/verify-access\`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${creds.token}\`
        },
        body: JSON.stringify({ accessKey: device.access_key, password: promptPassword })
      });
      const data = await res.json();
      if (res.ok) {
        if (promptRemember) {
           await fetch(\`http://\${serverIP}:3001/api/devices/\${device.id}/trust\`, {
             method: 'POST',
             headers: { 'Authorization': \`Bearer \${creds.token}\` }
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
      alert(e.message);
    }
  };

  const handleAddDevice = async () => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      const res = await fetch(\`http://\${serverIP}:3001/api/devices/add-existing\`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${creds.token}\`
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
        alert(data.error || 'Failed to add device');
      }
    } catch (e) {
      alert('Network error adding device');
    }
  };

  const handleRename = async (id: string) => {
    const newName = prompt('Enter new device name:');
    if (!newName) return;
    try {
      const creds = await (window as any).electronAPI.getToken();
      await fetch(\`http://\${serverIP}:3001/api/devices/\${id}/name\`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${creds.token}\`
        },
        body: JSON.stringify({ device_name: newName })
      });
      pollDevices();
      if (selectedDevice?.id === id) setSelectedDevice({ ...selectedDevice, device_name: newName });
    } catch (e) {}
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Are you sure you want to remove this device?')) return;
    try {
      const creds = await (window as any).electronAPI.getToken();
      await fetch(\`http://\${serverIP}:3001/api/devices/\${id}\`, {
        method: 'DELETE',
        headers: { 'Authorization': \`Bearer \${creds.token}\` }
      });
      pollDevices();
      if (selectedDevice?.id === id) setSelectedDevice(null);
    } catch (e) {}
  };

  const handleRevokeTrust = async (id: string) => {
    try {
      const creds = await (window as any).electronAPI.getToken();
      await fetch(\`http://\${serverIP}:3001/api/devices/\${id}/trust\`, {
        method: 'DELETE',
        headers: { 'Authorization': \`Bearer \${creds.token}\` }
      });
      alert("Trust revoked for this device.");
    } catch (e) {}
  };
`;

const stateAnchor = /\/\/ Phase 25: Device Security State/g;
if (code.includes('const pollDevices = async () =>')) {
  console.log('Hooks already added! Skipping hook insertion.');
} else {
  code = code.replace(stateAnchor, stateVars + '\n  // Phase 25: Device Security State');
}

// 3. Replace the Main Dashboard render block (line 782 onwards)
const newDashboardRender = `
  return (
    <div className="h-screen w-full bg-[#080808] text-white font-sans selection:bg-blue-500/30 flex overflow-hidden">
      
      {/* SIDEBAR: My Devices */}
      <div className="w-[340px] border-r border-white/10 bg-[#0a0a0a] flex flex-col z-10 shrink-0">
        <div className="p-6 border-b border-white/5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Zap className="text-white w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-white/90">My Devices</h2>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button onClick={() => setShowAddModal(true)} className="w-8 h-8 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center border border-white/10 transition">
                <Plus className="w-4 h-4" />
              </button>
              <button 
                onClick={async () => { await (window as any).electronAPI.deleteToken(); setIsAuthenticated(false); }}
                className="w-8 h-8 bg-red-500/10 hover:bg-red-500/20 rounded-full flex items-center justify-center text-red-400 border border-red-500/20 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input 
              type="text" 
              placeholder="Search devices..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl py-2 pl-9 pr-4 text-xs font-mono text-white/80 outline-none focus:border-blue-500/50 transition"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
          {devices.filter(d => !searchQuery || d.device_name.toLowerCase().includes(searchQuery.toLowerCase())).map(device => (
            <div 
              key={device.id} 
              onContextMenu={(e) => { e.preventDefault(); setContextMenuId(contextMenuId === device.id ? null : device.id); }}
              onClick={() => {
                if (!device.is_online) { alert("This device is currently offline. Ensure RemoteLink is running on that machine."); return; }
                handleDeviceClick(device);
              }}
              className={\`relative p-4 rounded-2xl border transition-all cursor-pointer group \${selectedDevice?.id === device.id ? 'bg-blue-600/10 border-blue-500/30' : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'}\`}
            >
              <div className="flex justify-between items-start">
                <div className="flex gap-3 items-center">
                  <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center shadow-inner">
                    {device.device_type === 'ios' || device.device_type === 'android' ? 
                      <Smartphone className={\`w-5 h-5 \${device.is_online ? 'text-emerald-400' : 'text-gray-500'}\`} /> : 
                      <Monitor className={\`w-5 h-5 \${device.is_online ? 'text-emerald-400' : 'text-gray-500'}\`} />
                    }
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white/90 truncate max-w-[150px]">{device.device_name}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={\`w-1.5 h-1.5 rounded-full \${device.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-gray-600'}\`} />
                      <span className="text-[10px] font-mono text-white/40 uppercase tracking-wider">{device.is_online ? 'Online' : 'Offline'}</span>
                    </div>
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setContextMenuId(contextMenuId === device.id ? null : device.id); }} className="p-1 opacity-0 group-hover:opacity-100 transition"><MoreVertical className="w-4 h-4 text-white/40" /></button>
              </div>

              {/* Context Menu inline for simplicity */}
              {contextMenuId === device.id && (
                <div className="absolute right-2 top-12 w-48 bg-[#111] border border-white/10 shadow-2xl rounded-xl p-2 z-50 flex flex-col gap-1 backdrop-blur-xl">
                  {device.is_online && <button onClick={(e) => { e.stopPropagation(); handleDeviceClick(device); setContextMenuId(null); }} className="text-left px-3 py-2 text-xs font-bold hover:bg-white/10 rounded-lg">Connect</button>}
                  <button onClick={(e) => { e.stopPropagation(); handleRename(device.id); setContextMenuId(null); }} className="text-left px-3 py-2 text-xs font-bold hover:bg-white/10 rounded-lg">Rename Device</button>
                  <button onClick={(e) => { e.stopPropagation(); handleRevokeTrust(device.id); setContextMenuId(null); }} className="text-left px-3 py-2 text-xs font-bold hover:bg-white/10 rounded-lg">Revoke Auto-Login</button>
                  <button onClick={(e) => { e.stopPropagation(); handleRemove(device.id); setContextMenuId(null); }} className="text-left px-3 py-2 text-xs font-bold hover:bg-red-500/20 text-red-400 rounded-lg">Remove Device</button>
                </div>
              )}
            </div>
          ))}
          {devices.length === 0 && (
            <div className="text-center p-8 border border-dashed border-white/10 rounded-2xl mt-4">
               <Monitor className="w-8 h-8 text-white/20 mx-auto mb-3" />
               <p className="text-xs text-white/40 font-mono">No devices linked.</p>
            </div>
          )}
        </div>
      </div>

      {/* MAIN PANEL */}
      <div className="flex-1 bg-[#050505] relative overflow-y-auto">
        <div className="max-w-4xl mx-auto p-12 w-full h-full flex flex-col items-center justify-center">
          
          {!selectedDevice ? (
            // Default "Connect by Key" & "Host Machine" Fallback Interface
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
               <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 flex flex-col items-center relative overflow-hidden group hover:border-white/20 transition">
                  <div className="w-16 h-16 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6 border border-blue-500/20 shadow-2xl">
                    <KeyRound className="text-blue-400 w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">Connect Manually</h3>
                  <p className="text-white/40 text-center text-xs mb-8">Enter an access key and password to connect to an external machine.</p>
                  <div className="w-full space-y-3 mt-auto">
                    <input type="text" placeholder="000 000 000" className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-4 text-center text-xl font-mono focus:border-blue-500 outline-none" value={sessionCode} onChange={(e) => setSessionCode(formatCode(e.target.value))} />
                    <input type="password" placeholder="Password" className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-4 text-center text-sm focus:border-blue-500 outline-none" value={accessPassword} onChange={(e) => setAccessPassword(e.target.value)} />
                    <button onClick={handleConnectToHost} disabled={!sessionCode || !accessPassword || viewerStatus === 'connecting'} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 uppercase text-xs tracking-wider">{viewerStatus === 'connecting' ? 'Connecting...' : 'Connect'}</button>
                  </div>
               </section>

               <section className="bg-white/[0.02] border border-white/5 rounded-3xl p-8 flex flex-col items-center relative overflow-hidden group hover:border-white/20 transition">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6 border border-emerald-500/20 shadow-2xl">
                    <Activity className="text-emerald-400 w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold mb-2 uppercase tracking-tight">Host Machine</h3>
                  <p className="text-white/40 text-center text-xs mb-6">Allow remote viewers to access this physical machine.</p>
                  
                  {hostAccessKey && (
                     <div className="w-full bg-[#111] p-6 rounded-2xl border border-white/5 text-center mb-4">
                       <span className="text-[9px] font-bold text-emerald-400/50 uppercase tracking-widest">{hostSessionId ? 'Broadcasting ID' : 'Your Permanent Key'}</span>
                       <div className="text-2xl font-mono text-emerald-400 mt-2 mb-4">{formatCode(hostAccessKey)}</div>
                       {hostSessionId ? 
                         <button onClick={async () => { await (window as any).electronAPI.stopHosting(); setHostSessionId(''); }} className="w-full bg-red-500/10 text-red-400 text-xs py-2 rounded-lg font-bold">Stop Broadcasting</button> :
                         <div className="flex gap-2"><button onClick={copyAccessKey} className="flex-1 bg-white/5 text-xs py-2 rounded-lg hover:bg-white/10">Copy</button><button onClick={handleRegenerateKey} className="flex-1 bg-red-500/10 text-red-500/70 text-xs py-2 rounded-lg hover:bg-red-500/20">Regenerate</button></div>
                       }
                     </div>
                  )}

                  {!hostSessionId && (
                     <div className="w-full mt-auto space-y-3">
                       <input type="password" placeholder="Set Access Password..." className="w-full bg-black/40 border border-white/10 text-white rounded-xl p-4 text-center text-sm focus:border-emerald-500 outline-none" value={devicePassword} onChange={e => setDevicePassword(e.target.value)} />
                       <button onClick={handleStartHosting} disabled={hostStatus === 'connecting'} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold py-4 rounded-xl text-center uppercase text-xs tracking-wider">{hostStatus === 'connecting' ? 'Starting...' : 'Start Hosting'}</button>
                     </div>
                  )}
               </section>
            </div>
          ) : (
            // Device Detail Interface
            <div className="w-full max-w-2xl bg-white/[0.02] border border-white/5 rounded-[3rem] p-12 flex flex-col items-center animate-in fade-in slide-in-from-right-8">
               <div className="w-32 h-32 bg-blue-500/10 rounded-[2.5rem] flex items-center justify-center mb-8 border border-blue-500/20 shadow-2xl">
                 {selectedDevice.device_type === 'ios' || selectedDevice.device_type === 'android' ? 
                    <Smartphone className="text-blue-400 w-16 h-16" /> : 
                    <Monitor className="text-blue-400 w-16 h-16" />
                 }
               </div>
               
               <div className="flex items-center gap-2 mb-2">
                 <h2 className="text-4xl font-[900] uppercase tracking-tight">{selectedDevice.device_name}</h2>
                 {selectedDevice.is_owned && <Shield className="w-5 h-5 text-emerald-400 ml-2" />}
               </div>
               
               <div className="flex gap-6 mt-4 opacity-60 font-mono text-sm">
                 <span>ID: {formatCode(selectedDevice.access_key)}</span>
                 <span className="uppercase text-blue-400">{selectedDevice.device_type}</span>
               </div>
               
               <div className="mt-12 w-full flex gap-4">
                 <button onClick={() => setSelectedDevice(null)} className="w-1/3 bg-white/5 hover:bg-white/10 rounded-2xl py-5 font-bold uppercase tracking-widest text-xs transition">Back</button>
                 <button onClick={() => handleDeviceClick(selectedDevice)} disabled={viewerStatus === 'connecting'} className="w-2/3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-2xl py-5 font-black uppercase tracking-widest text-sm flex justify-center items-center gap-2 shadow-2xl shadow-blue-500/20 transition">
                   {viewerStatus === 'connecting' ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Connect <ArrowRight className="w-4 h-4 ml-2" /></>}
                 </button>
               </div>
            </div>
          )}
        </div>
      </div>

      {/* MODALS */}
      {showPasswordPrompt && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center animate-in fade-in">
           <div className="max-w-md w-full bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold uppercase tracking-widest">Connect to {showPasswordPrompt.device_name}</h3>
                <button onClick={() => setShowPasswordPrompt(null)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
             </div>
             <input type="password" placeholder="Device Password" value={promptPassword} onChange={e => setPromptPassword(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 mb-4 outline-none focus:border-blue-500 font-mono text-center text-lg" autoFocus />
             <label className="flex items-center gap-3 cursor-pointer mb-8 opacity-70 hover:opacity-100">
                <input type="checkbox" checked={promptRemember} onChange={e => setPromptRemember(e.target.checked)} className="w-5 h-5 rounded border-white/20" />
                <span className="text-sm font-medium">Trust this device (skip password next time)</span>
             </label>
             <button onClick={submitPasswordPrompt} disabled={!promptPassword || viewerStatus === 'connecting'} className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 py-4 rounded-xl font-bold uppercase tracking-widest text-sm">Submit</button>
           </div>
        </div>
      )}

      {showAddModal && (
        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center animate-in fade-in">
           <div className="max-w-md w-full bg-[#111] border border-white/10 rounded-3xl p-8 shadow-2xl">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold uppercase tracking-widest">Add Device</h3>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-white/10 rounded-full"><X className="w-5 h-5" /></button>
             </div>
             <p className="text-xs text-white/50 mb-6 leading-relaxed">Enter the access key and password of a device you want to save to your personal list (for example, a friend's PC or a work computer).</p>
             <div className="space-y-4 mb-8">
               <input type="text" placeholder="Access Key" value={addKey} onChange={e => setAddKey(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-emerald-500 font-mono" />
               <input type="password" placeholder="Password" value={addPassword} onChange={e => setAddPassword(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl p-4 outline-none focus:border-emerald-500 font-mono" />
             </div>
             <button onClick={handleAddDevice} disabled={!addKey || !addPassword} className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 py-4 rounded-xl font-bold uppercase tracking-widest text-sm">Save Device</button>
           </div>
        </div>
      )}

    </div>
  );
}
`;

// Extract everything up to the final return 
const mainReturnRegex = /return \([\s\S]*?<div className="min-h-screen bg-\[#080808\] text-white p-8 font-sans selection:bg-blue-500\/30">[\s\S]*?;\s*}/;
code = code.replace(mainReturnRegex, newDashboardRender);

fs.writeFileSync(appPath, code);
console.log('App.tsx Updated successfully');
