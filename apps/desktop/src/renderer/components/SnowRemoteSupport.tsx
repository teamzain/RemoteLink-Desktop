import React, { useState } from 'react';
import { 
  Monitor, 
  Copy, 
  RefreshCw, 
  Search, 
  ChevronDown, 
  Info,
  Clock,
  History,
  Shield,
  Zap,
  MoreHorizontal
} from 'lucide-react';
import { t } from '../lib/translations';
import { useAuthStore } from '../store/authStore';

interface SnowRemoteSupportProps {
  localAuthKey: string | null;
  devicePassword: string;
  onCopyAccessKey: () => void;
  onOpenSetPassword: () => void;
  onConnect: (partnerId: string) => void;
  onStartHosting: () => void;
  onStopHosting: () => void;
  hostStatus: string;
}

export const SnowRemoteSupport: React.FC<SnowRemoteSupportProps> = ({
  localAuthKey,
  devicePassword,
  onCopyAccessKey,
  onOpenSetPassword,
  onConnect,
  onStartHosting,
  onStopHosting,
  hostStatus
}) => {
  const { user } = useAuthStore();
  const lang = user?.language;
  const [partnerId, setPartnerId] = useState('');
  const [activeTab, setActiveTab] = useState<'id' | 'sessions'>('id');
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);

  const formatId = (id: string | null) => {
    if (!id) return '--- --- ---';
    const clean = id.replace(/\D/g, '');
    return (clean.match(/.{1,3}/g) || [clean]).join(' ');
  };

  const handleCopyId = () => {
    onCopyAccessKey();
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyPwd = () => {
    if (devicePassword) {
      navigator.clipboard.writeText(devicePassword);
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
    }
  };

  const isOnline = hostStatus.includes('Online') || hostStatus.includes('WebRTC') || hostStatus.includes('Registered');

  return (
    <div className="flex flex-col h-full w-full bg-white dark:bg-[#080808] font-lato animate-in fade-in duration-500">
      
      {/* Top Tab Switcher */}
      <div className="flex justify-center py-6 border-b border-gray-100 dark:border-white/5">
        <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('id')}
            className={`px-8 py-2 text-[13px] font-semibold rounded-lg transition-all ${
              activeTab === 'id' 
                ? 'bg-white dark:bg-white/10 text-[#1D6DF5] shadow-sm' 
                : 'text-gray-500 dark:text-[#A0A0A0] hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            RemoteLink ID
          </button>
          <button 
            onClick={() => setActiveTab('sessions')}
            className={`px-8 py-2 text-[13px] font-semibold rounded-lg transition-all ${
              activeTab === 'sessions' 
                ? 'bg-white dark:bg-white/10 text-[#1D6DF5] shadow-sm' 
                : 'text-gray-500 dark:text-[#A0A0A0] hover:text-gray-700 dark:hover:text-white'
            }`}
          >
            Sessions
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-start pt-12 px-6 overflow-y-auto">
        <div className="w-full max-w-5xl">
          
          {activeTab === 'id' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-gray-100 dark:border-white/5 rounded-2xl overflow-hidden bg-white dark:bg-[#0F0F0F] shadow-sm animate-in zoom-in-95 duration-300">
              {/* Left Column: Allow remote control */}
              <div className="p-10 border-r border-gray-100 dark:border-white/5">
                <h3 className="text-lg font-bold text-gray-800 dark:text-[#F5F5F5] mb-8">Allow remote control</h3>
                
                <div className="space-y-6">
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-6 border border-transparent dark:border-white/5 group transition-all">
                    <div className="flex flex-col mb-4">
                      <span className="text-[11px] font-bold text-gray-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-2">Your ID</span>
                      <div className="flex items-center justify-between">
                        <span className="text-3xl font-bold text-gray-800 dark:text-[#F5F5F5] tracking-wider leading-none">
                          {formatId(localAuthKey)}
                        </span>
                        <button 
                          onClick={handleCopyId}
                          className="p-2 text-gray-400 hover:text-[#1D6DF5] transition-colors"
                          title="Copy ID"
                        >
                          {copiedId ? <Monitor size={18} className="text-emerald-500" /> : <Copy size={18} />}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[11px] font-bold text-gray-400 dark:text-[#A0A0A0] uppercase tracking-widest mb-2">Password</span>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-gray-700 dark:text-[#D1D1D1] tracking-wider leading-none">
                          {devicePassword || '--------'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button 
                            onClick={onOpenSetPassword}
                            className="p-2 text-gray-400 hover:text-[#1D6DF5] transition-colors"
                            title="Generate new password"
                          >
                            <RefreshCw size={18} />
                          </button>
                          <button 
                            onClick={handleCopyPwd}
                            className="p-2 text-gray-400 hover:text-[#1D6DF5] transition-colors"
                            title="Copy Password"
                          >
                            {copiedPwd ? <Monitor size={18} className="text-emerald-500" /> : <Copy size={18} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 px-1">
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" />
                      <div className="w-4 h-4 border-2 border-gray-300 dark:border-white/20 rounded peer-checked:bg-[#1D6DF5] peer-checked:border-[#1D6DF5] transition-all"></div>
                    </div>
                    <span className="text-[13px] text-gray-500 dark:text-[#A0A0A0]">Grant Easy Access to this device</span>
                    <Info size={14} className="text-gray-300 dark:text-[#555555]" />
                  </div>
                </div>
              </div>

              {/* Right Column: Control remote device */}
              <div className="p-10 flex flex-col">
                <h3 className="text-lg font-bold text-gray-800 dark:text-[#F5F5F5] mb-8">Control remote device</h3>
                
                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="relative">
                    <button className="flex items-center gap-2 text-[14px] font-semibold text-blue-600 mb-4 hover:opacity-80 transition-opacity">
                      Remote control <ChevronDown size={14} />
                    </button>
                    
                    <div className="relative">
                      <div className="absolute -top-2 left-3 px-1 bg-white dark:bg-[#0F0F0F] text-[10px] font-bold text-gray-400 dark:text-[#A0A0A0] uppercase tracking-wider z-10">
                        ID, IP address, or hostname
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            placeholder="Enter end user's ID, IP, or hostname"
                            value={partnerId}
                            onChange={(e) => setPartnerId(e.target.value)}
                            className="w-full h-12 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 text-[14px] text-gray-800 dark:text-white outline-none focus:border-[#1D6DF5] transition-all"
                          />
                          <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-600 transition-colors">
                            <ChevronDown size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button 
                      onClick={() => onConnect(partnerId)}
                      disabled={!partnerId}
                      className="px-10 py-3 bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-[#555555] font-bold text-[13px] rounded-lg border border-transparent disabled:opacity-50 transition-all hover:bg-gray-200 dark:hover:bg-white/10"
                    >
                      Connect
                    </button>
                  </div>

                  <div className="mt-auto space-y-4 pt-12">
                    <div className="flex items-center justify-between group cursor-pointer py-2 border-b border-gray-50 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <Clock size={16} className="text-gray-400" />
                        <span className="text-[13px] text-gray-700 dark:text-[#D1D1D1]">Recent connections</span>
                      </div>
                      <ChevronDown size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                    <div className="flex items-center justify-between group cursor-pointer py-2 border-b border-gray-50 dark:border-white/5">
                      <div className="flex items-center gap-3">
                        <History size={16} className="text-gray-400" />
                        <span className="text-[13px] text-gray-700 dark:text-[#D1D1D1]">Session history</span>
                      </div>
                      <ChevronDown size={14} className="text-gray-300 opacity-0 group-hover:opacity-100 transition-all" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0F0F0F] rounded-2xl border border-gray-100 dark:border-white/5 p-12 text-center animate-in slide-in-from-bottom-4 duration-500">
               <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Clock size={40} className="text-gray-300" />
               </div>
               <h3 className="text-xl font-bold text-gray-800 dark:text-[#F5F5F5] mb-2">No active sessions</h3>
               <p className="text-gray-400 dark:text-[#A0A0A0] max-w-sm mx-auto">
                 Once you start a remote control session, it will appear here for easy management.
               </p>
               <button 
                 onClick={() => setShowAddSessionModal(true)}
                 className="mt-8 px-8 py-3 bg-[#1D6DF5] text-white rounded-xl font-bold text-[14px] hover:opacity-90 transition-all shadow-lg shadow-blue-500/20"
               >
                 Start a new session
               </button>
            </div>
          )}

          {/* Quick Actions Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
            <div className="p-6 bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center text-blue-600 mb-4">
                <Zap size={20} />
              </div>
              <h4 className="text-[14px] font-bold text-gray-800 dark:text-[#F5F5F5] mb-1">Instant Support</h4>
              <p className="text-[12px] text-gray-400 dark:text-[#A0A0A0]">Connect to a remote device without installation.</p>
            </div>
            <div className="p-6 bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center text-emerald-600 mb-4">
                <Shield size={20} />
              </div>
              <h4 className="text-[14px] font-bold text-gray-800 dark:text-[#F5F5F5] mb-1">Secure Unattended</h4>
              <p className="text-[12px] text-gray-400 dark:text-[#A0A0A0]">Set up permanent access with custom password.</p>
            </div>
            <div className="p-6 bg-white dark:bg-[#111111] rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md transition-all cursor-pointer group">
              <div className="w-10 h-10 bg-purple-50 dark:bg-purple-900/20 rounded-xl flex items-center justify-center text-purple-600 mb-4">
                <MoreHorizontal size={20} />
              </div>
              <h4 className="text-[14px] font-bold text-gray-800 dark:text-[#F5F5F5] mb-1">More tools</h4>
              <p className="text-[12px] text-gray-400 dark:text-[#A0A0A0]">File transfer, chat, and system diagnostics.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <div className="px-6 py-3 bg-gray-50 dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-white/5 flex items-center gap-3">
        <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <span className="text-[12px] font-medium text-gray-500 dark:text-[#A0A0A0]">
          {t('ready_to_connect', lang) || 'Ready to connect'}
        </span>
      </div>

      {/* Add Session Modal */}
      {showAddSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1C1C1C] rounded-[24px] w-[500px] shadow-2xl p-6 font-sans">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h3 className="text-[20px] font-semibold text-[#1C1C1C] dark:text-[#F5F5F5]">Session name</h3>
                <button className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                </button>
              </div>
              <button className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21v-7"/><path d="M4 10V3"/><path d="M12 21v-9"/><path d="M12 8V3"/><path d="M20 21v-5"/><path d="M20 12V3"/><path d="M1 14h6"/><path d="M9 8h6"/><path d="M17 16h6"/></svg>
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-[#A0A0A0]">
                  Session link
                  <Info size={14} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-medium text-[#1C1C1C] dark:text-[#F5F5F5]">quicksupport.me/s100310059</span>
                  <button className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-1.5 text-[13px] text-gray-500 dark:text-[#A0A0A0]">
                  Session code
                  <Info size={14} />
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[14px] font-medium text-[#1C1C1C] dark:text-[#F5F5F5]">100 310 059</span>
                  <button className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
                    <Copy size={14} />
                  </button>
                </div>
              </div>

              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-100 dark:border-white/10"></div>
                </div>
                <div className="relative flex justify-center text-[12px]">
                  <span className="px-2 bg-white dark:bg-[#1C1C1C] text-gray-400 dark:text-[#A0A0A0]">Or</span>
                </div>
              </div>

              <div className="mb-6">
                <input 
                  type="email" 
                  placeholder="End user's email" 
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] text-[13px] text-gray-800 dark:text-[#F5F5F5] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-400"
                />
              </div>

              <div className="flex items-center justify-end gap-3 mt-8">
                <button 
                  onClick={() => setShowAddSessionModal(false)}
                  className="text-[13px] font-medium text-gray-600 dark:text-[#A0A0A0] hover:text-gray-800 dark:hover:text-white transition-colors px-3 py-2"
                >
                  Cancel
                </button>
                <div className="flex rounded-lg overflow-hidden shadow-sm">
                  <button className="bg-[#2B52D0] hover:bg-[#2040A0] text-white px-5 py-2 text-[13px] font-medium transition-colors border-r border-blue-700/30">
                    Start
                  </button>
                  <button className="bg-[#2B52D0] hover:bg-[#2040A0] text-white px-2 py-2 flex items-center justify-center transition-colors">
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
