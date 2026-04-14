import React from 'react';
import { 
  Zap, 
  Shield, 
  Copy, 
  RefreshCw, 
  Power, 
  Globe, 
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FolderPlus
} from 'lucide-react';

interface SnowHostProps {
  status: 'idle' | 'connecting' | 'error' | 'status' | '';
  accessKey: string;
  isAutoHost: boolean;
  setIsAutoHost: (val: boolean) => void;
  handleStartHosting: () => void;
  handleStopHosting: () => void;
  copyAccessKey: () => void;
  openPasswordModal: () => void;
  bandwidth: string;
  activeUsers: number;
  isRegistered?: boolean;
  onRegister?: () => void;
}

export const SnowHost: React.FC<SnowHostProps> = ({ 
  status, 
  accessKey, 
  isAutoHost, 
  setIsAutoHost,
  handleStartHosting,
  handleStopHosting,
  copyAccessKey,
  openPasswordModal,
  bandwidth,
  activeUsers,
  isRegistered = true,
  onRegister
}) => {
  const isOnline = status === 'status' || status === 'connecting';
  const isConnecting = status === 'connecting';

  if (!isRegistered) {
    return (
      <div className="max-w-4xl mx-auto min-h-[60vh] flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-8 duration-700 font-inter">
        <div className="w-24 h-24 rounded-[32px] bg-[rgba(28,28,28,0.04)] border border-[rgba(28,28,28,0.06)] flex items-center justify-center mb-8 relative group">
          <Globe size={40} className="text-[rgba(28,28,28,0.2)] group-hover:text-[#1C1C1C] transition-colors duration-500" />
          <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full border border-[rgba(28,28,28,0.06)] flex items-center justify-center shadow-sm">
             <Shield size={12} className="text-orange-400" />
          </div>
        </div>

        <h2 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-4 uppercase text-center">Identity Not Initialized</h2>
        <p className="text-sm text-[rgba(28,28,28,0.4)] font-medium text-center max-w-md mb-12 leading-relaxed">
          This device is currently used solely for viewing. To allow other devices to control or view this machine, you must initialize its secure network identity.
        </p>

        <div className="flex flex-col items-center gap-6 w-full max-w-sm">
           <button 
             onClick={onRegister}
             className="w-full h-14 bg-[#1C1C1C] text-white rounded-2xl font-bold text-xs uppercase tracking-[0.2em] hover:opacity-90 transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-3 group"
           >
             <Zap size={16} className="group-hover:scale-110 transition-transform" fill="currentColor" />
             Initialize This Node
           </button>
           
           <div className="flex items-center gap-6 pt-4 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">
              <div className="flex items-center gap-2">
                 <Lock size={12} /> Encrypted
              </div>
              <div className="w-1 h-1 rounded-full bg-[rgba(28,28,28,0.1)]" />
              <div className="flex items-center gap-2">
                 <Shield size={12} /> Secure Link
              </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-inter">
      
      {/* Hero Status Card */}
      <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm relative overflow-hidden">
        {/* Background Accent */}
        <div className={`absolute top-0 right-0 w-32 h-32 blur-[80px] opacity-20 ${isOnline ? 'bg-green-400' : 'bg-blue-400'}`} />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 relative z-10">
          <div className="flex items-center gap-5">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 ${isOnline ? 'bg-[rgba(113,221,140,0.1)] text-[#71DD8C]' : 'bg-[rgba(28,28,28,0.04)] text-[rgba(28,28,28,0.2)]'}`}>
              {isConnecting ? <Loader2 size={32} className="animate-spin" /> : <Zap size={32} fill={isOnline ? 'currentColor' : 'none'} />}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-[#1C1C1C] tracking-tight text-nowrap">
                  {isOnline ? 'Broadcasting Active' : 'Hosting is Offline'}
                </h2>
                {isOnline && !isConnecting && (
                  <div className="flex items-center gap-2 bg-[#71DD8C]/10 px-2 py-0.5 rounded-full border border-[#71DD8C]/20">
                    <div className="w-2 h-2 rounded-full bg-[#71DD8C] animate-pulse" />
                    <span className="text-[10px] font-black text-[#71DD8C] tracking-widest uppercase">LIVE</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-[rgba(28,28,28,0.4)] font-medium mt-1">
                {isOnline ? 'Your secure node identity is visible to authorized peers.' : 'Enable hosting to allow remote access to this device.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
             {isOnline && (
               <button 
                 onClick={() => (window as any).electronAPI?.sendFileToViewer()}
                 className="h-11 px-6 bg-blue-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-100 transition-all flex items-center gap-2 border border-blue-100"
               >
                 <FolderPlus size={16} /> Deploy Payload
               </button>
             )}
             {isOnline ? (
               <button 
                 onClick={handleStopHosting}
                 className="h-11 px-6 bg-red-50 text-red-600 rounded-xl font-bold text-sm hover:bg-red-100 transition-all flex items-center gap-2 border border-red-100"
               >
                 <Power size={16} /> Stop Hosting
               </button>
             ) : (
               <button 
                 onClick={handleStartHosting}
                 disabled={isConnecting}
                 className="h-11 px-8 bg-[#1C1C1C] text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-black/10 disabled:opacity-50"
               >
                 {isConnecting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />} Start Hosting
               </button>
             )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Network Identity */}
        <div className="bg-[#F9F9FA] rounded-[24px] border border-[rgba(28,28,28,0.04)] p-6">
          <div className="flex items-center gap-2 mb-4">
            <Globe size={16} className="text-[rgba(28,28,28,0.4)]" />
            <h3 className="text-sm font-semibold text-[#1C1C1C]">Network Identity</h3>
          </div>
          
          <div className="flex flex-col gap-4">
            <div className="bg-white rounded-xl p-4 border border-[rgba(28,28,28,0.1)] flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mb-1">Access Key</span>
                <span className="text-lg font-mono font-bold text-[#1C1C1C] tracking-wider">{accessKey || '--- --- ---'}</span>
              </div>
              <button 
                onClick={copyAccessKey}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-[rgba(28,28,28,0.02)] hover:bg-[rgba(28,28,28,0.05)] text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-all"
              >
                <Copy size={18} />
              </button>
            </div>
            
            <p className="text-xs text-[rgba(28,28,28,0.4)] leading-relaxed px-1">
              Share this key with authorized users to establish a P2P link. Keep it secure.
            </p>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm">
           <div className="flex items-center gap-2 mb-4">
            <Shield size={16} className="text-[rgba(28,28,28,0.4)]" />
            <h3 className="text-sm font-semibold text-[#1C1C1C]">Host Security</h3>
          </div>

          <div className="flex flex-col gap-3">
             <div className="flex items-center justify-between py-2 border-b border-[rgba(0,0,0,0.04)]">
                <div className="flex flex-col">
                   <span className="text-xs font-bold text-[#1C1C1C]">Auto-Start</span>
                   <span className="text-[10px] text-[rgba(28,28,28,0.4)]">Launch host on boot</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" className="sr-only peer" checked={isAutoHost} onChange={(e) => setIsAutoHost(e.target.checked)} />
                  <div className="w-9 h-5 bg-[rgba(28,28,28,0.1)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1C1C1C]"></div>
                </label>
             </div>

             <div className="flex items-center justify-between py-2">
                <div className="flex flex-col">
                   <span className="text-xs font-bold text-[#1C1C1C]">Device Password</span>
                   <span className="text-[10px] text-[rgba(28,28,28,0.4)]">Encrypted host-side PIN</span>
                </div>
                <button 
                  onClick={openPasswordModal}
                  className="px-3 py-1.5 bg-[rgba(28,28,28,0.02)] hover:bg-[rgba(28,28,28,0.05)] border border-[rgba(28,28,28,0.1)] rounded-lg text-xs font-bold text-[#1C1C1C] transition-all"
                >
                  Configure
                </button>
             </div>
          </div>
          
          <div className="mt-4 p-3 bg-blue-50/50 border border-blue-100/50 rounded-xl flex gap-3">
             <Lock size={14} className="text-blue-400 shrink-0 mt-0.5" />
             <p className="text-[10px] text-blue-600/80 font-medium leading-normal">
               End-to-end encryption is active. Your local session is never stored on the signaling server.
             </p>
          </div>
        </div>

      </div>

      {/* Connection Log Section */}
      <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm overflow-hidden">
        <h3 className="text-sm font-semibold text-[#1C1C1C] mb-4">Traffic Insights</h3>
        <div className="space-y-4">
           {[
             { name: 'Bandwidth', val: `${bandwidth || '0.00'} Mbps`, icon: RefreshCw },
             { name: 'Active Users', val: `${activeUsers || 0} Authorized`, icon: Zap },
             { name: 'Stability', val: isOnline ? '99.9% High' : 'Offline', icon: CheckCircle2, color: isOnline ? 'text-green-500' : 'text-[rgba(28,28,28,0.2)]' }
           ].map((stat, i) => (
             <div key={i} className="flex items-center justify-between p-3 rounded-xl hover:bg-[rgba(28,28,28,0.01)] transition-all">
               <div className="flex items-center gap-3">
                 <stat.icon size={16} className={`text-[rgba(28,28,28,0.2)] ${stat.name === 'Bandwidth' && Number(bandwidth) > 0 ? 'animate-spin-slow' : ''}`} />
                 <span className="text-sm font-medium text-[#1C1C1C] opacity-80">{stat.name}</span>
               </div>
               <span className={`text-sm font-bold ${stat.color || 'text-[#1C1C1C]'}`}>{stat.val}</span>
             </div>
           ))}
        </div>
      </div>

    </div>
  );
};
