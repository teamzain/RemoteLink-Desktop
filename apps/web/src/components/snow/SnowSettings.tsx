import React, { useState } from 'react';
import { 
  Settings, 
  User, 
  Lock, 
  Bell, 
  Shield, 
  Globe, 
  Cpu, 
  CheckCircle2,
  ChevronRight,
  Server,
  Zap
} from 'lucide-react';

interface SnowSettingsProps {
  user: any;
  updateProfile: (data: any) => Promise<void>;
  updatePassword: (data: any) => Promise<void>;
  toggle2FA: (enable: boolean) => Promise<void>;
  serverIP: string;
  setServerIP: (ip: string) => void;
}

export const SnowSettings: React.FC<SnowSettingsProps> = ({ 
  user, 
  updateProfile, 
  updatePassword, 
  toggle2FA,
  serverIP,
  setServerIP
}) => {
  const [name, setName] = useState(user?.name || '');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [activeTab, setActiveTab] = useState<'general' | 'security' | 'network'>('general');

  const handleProfileSave = () => {
    updateProfile({ name });
  };

  const handlePasswordSave = () => {
    if (passwords.new === passwords.confirm) {
      updatePassword({ current_password: passwords.current, password: passwords.new });
      setPasswords({ current: '', new: '', confirm: '' });
    }
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col lg:flex-row gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 font-inter pb-20">
      
      {/* Settings Navigation */}
      <div className="w-full lg:w-64 flex flex-col gap-2 shrink-0">
         <h3 className="px-4 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest mb-4">Preference Layers</h3>
         {[
           { id: 'general', label: 'General Identity', icon: User },
           { id: 'security', label: 'Security & Auth', icon: Shield },
           { id: 'network', label: 'Node Infrastructure', icon: Globe },
         ].map(tab => (
           <button 
             key={tab.id}
             onClick={() => setActiveTab(tab.id as any)}
             className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all ${activeTab === tab.id ? 'bg-white shadow-sm border border-[rgba(28,28,28,0.06)] text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] hover:bg-white/40'}`}
           >
             <tab.icon size={18} className={activeTab === tab.id ? 'text-blue-500' : ''} />
             <span className="text-sm font-bold tracking-tight">{tab.label}</span>
             {activeTab === tab.id && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-500" />}
           </button>
         ))}
      </div>

      {/* Main Settings Panel */}
      <div className="flex-1">
        
        {activeTab === 'general' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm border border-[rgba(28,28,28,0.04)]">
              <h3 className="text-lg font-bold text-[#1C1C1C] mb-8 tracking-tight">Identity Profile</h3>
              
              <div className="flex items-center gap-8 mb-10">
                 <div className="relative group">
                    <div className="w-20 h-20 rounded-[24px] bg-[rgba(28,28,28,0.04)] border-2 border-white shadow-md flex items-center justify-center overflow-hidden">
                       <span className="text-xl font-bold text-[#1C1C1C]">{user?.name?.[0]?.toUpperCase()}</span>
                    </div>
                    <button className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#1C1C1C] text-white rounded-lg flex items-center justify-center border-2 border-white hover:scale-110 transition-transform">
                       <Cpu size={12} />
                    </button>
                 </div>
                 <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider mb-1">Authenticated via</span>
                    <span className="text-sm font-bold text-[#1C1C1C] flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full bg-blue-500" /> Web Terminal Sync
                    </span>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                 <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider ml-1">Full Name</label>
                    <input 
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      className="bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-xl px-4 py-3 text-sm font-semibold focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all" 
                    />
                 </div>
                 <div className="flex flex-col gap-1.5 opacity-50">
                    <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider ml-1">Email Address</label>
                    <input 
                      value={user?.email || ''} 
                      disabled
                      className="bg-[rgba(0,0,0,0.02)] border border-[rgba(28,28,28,0.04)] text-[#1C1C1C] rounded-xl px-4 py-3 text-sm font-semibold cursor-not-allowed" 
                    />
                 </div>
              </div>

              <button 
                onClick={handleProfileSave}
                className="px-8 py-3 bg-[#1C1C1C] text-white rounded-xl text-xs font-bold hover:opacity-90 transition-all shadow-lg shadow-black/10"
              >
                Apply Profile Changes
              </button>
            </div>

            <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm border border-[rgba(28,28,28,0.04)]">
               <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                     <h3 className="text-sm font-bold text-[#1C1C1C]">Language & Localization</h3>
                     <p className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium">Auto-detect system preferences</p>
                  </div>
                  <button className="flex items-center gap-2 text-xs font-bold text-blue-500 transition-colors">
                     English (US) <ChevronRight size={14} />
                  </button>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
            <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm border border-[rgba(28,28,28,0.04)]">
              <h3 className="text-lg font-bold text-[#1C1C1C] mb-8 tracking-tight">Access Control</h3>
              
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider ml-1">New Terminal Token</label>
                      <input 
                        type="password"
                        placeholder="••••••••"
                        value={passwords.new}
                        onChange={e => setPasswords({...passwords, new: e.target.value})}
                        className="bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-xl px-4 py-3 text-sm font-semibold focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all" 
                      />
                   </div>
                   <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider ml-1">Confirm Identity</label>
                      <input 
                        type="password"
                        placeholder="••••••••"
                        value={passwords.confirm}
                        onChange={e => setPasswords({...passwords, confirm: e.target.value})}
                        className="bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-xl px-4 py-3 text-sm font-semibold focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all" 
                      />
                   </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider ml-1">Current Authorization</label>
                    <input 
                      type="password"
                      placeholder="Required to confirm changes"
                      value={passwords.current}
                      onChange={e => setPasswords({...passwords, current: e.target.value})}
                      className="bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-xl px-4 py-3 text-sm font-semibold focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all" 
                    />
                </div>

                <button 
                  onClick={handlePasswordSave}
                  className="px-8 py-3 bg-white border border-[rgba(28,28,28,0.08)] hover:border-[rgba(28,28,28,0.2)] text-[#1C1C1C] rounded-xl text-xs font-bold transition-all shadow-sm"
                >
                  Rotate Security Credentials
                </button>
              </div>
            </div>

            <div className="bg-[#1C1C1C] rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-black/10 border border-[rgba(28,28,28,0.04)]">
               <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/20 blur-[60px] -mr-24 -mt-24 rounded-full" />
               <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
                  <div className="flex flex-col">
                     <div className="flex items-center gap-2 mb-2">
                        <Shield size={16} className="text-blue-400" />
                        <h3 className="text-base font-bold tracking-tight">Two-Factor Authentication</h3>
                     </div>
                     <p className="text-sm text-white/40 font-medium max-w-sm">
                       Secure your global node access with hardware-level identification or TOTP.
                     </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer scale-125">
                    <input type="checkbox" className="sr-only peer" checked={user?.is_2fa_enabled} onChange={(e) => toggle2FA(e.target.checked)} />
                    <div className="w-11 h-6 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white/80 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'network' && (
          <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
             <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm border border-[rgba(28,28,28,0.04)]">
                <h3 className="text-lg font-bold text-[#1C1C1C] mb-8 tracking-tight">Node Signaling Layer</h3>
                
                <div className="space-y-8">
                   <div className="p-6 bg-[#F9F9FA] rounded-[24px] border border-[rgba(28,28,28,0.02)] space-y-4">
                      <div className="flex items-center justify-between">
                         <div className="flex items-center gap-2">
                            <Server size={16} className="text-blue-500" />
                            <span className="text-xs font-bold text-[#1C1C1C]">Signaling Relay Endpoint</span>
                         </div>
                         <div className="px-2 py-0.5 bg-emerald-50 text-emerald-500 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-100">Active</div>
                      </div>
                      <input 
                        value={serverIP}
                        onChange={e => setServerIP(e.target.value)}
                        className="w-full bg-white border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-3 text-sm font-mono font-bold text-[#1C1C1C] outline-none transition-all shadow-sm focus:border-blue-500/20" 
                      />
                      <p className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium leading-relaxed">
                        Default: 127.0.0.1 (Local Mesh). Change this to your remote relay cluster IP for global node discovery.
                      </p>
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div className="bg-[#F9F9FA] p-4 rounded-xl border border-[rgba(28,28,28,0.02)] flex flex-col gap-2">
                         <span className="text-[9px] font-black text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Interface IP</span>
                         <span className="text-xs font-mono font-bold text-[#1C1C1C]">127.0.0.1</span>
                      </div>
                      <div className="bg-[#F9F9FA] p-4 rounded-xl border border-[rgba(28,28,28,0.02)] flex flex-col gap-2">
                         <span className="text-[9px] font-black text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Mesh Port</span>
                         <span className="text-xs font-mono font-bold text-[#1C1C1C]">3001-3002</span>
                      </div>
                   </div>
                </div>
             </div>

             <div className="bg-blue-50/50 border border-blue-100/50 rounded-[28px] p-8 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                   <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-500 shadow-sm border border-blue-100">
                      <Zap size={24} />
                   </div>
                   <div className="flex flex-col">
                      <h3 className="text-sm font-bold text-[#1C1C1C]">Infrastructure Health</h3>
                      <p className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium">All signaling relays are operating at Peak Performance.</p>
                   </div>
                </div>
                <button className="px-6 py-2.5 bg-white text-blue-600 rounded-xl text-[10px] font-bold border border-blue-100 shadow-sm hover:bg-blue-50 transition-all">
                   View Status
                </button>
             </div>
          </div>
        )}

      </div>

    </div>
  );
};
