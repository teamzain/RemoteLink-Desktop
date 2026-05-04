import React, { useEffect, useState } from 'react';
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
  MoreHorizontal,
  Mail,
  CheckCircle2,
  AlertCircle,
  Users
} from 'lucide-react';
import { t } from '../lib/translations';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

interface SnowRemoteSupportProps {
  localAuthKey: string | null;
  devicePassword: string;
  onCopyAccessKey: () => void;
  onOpenSetPassword: () => void;
  onConnect: (partnerId: string) => void;
  onStartHosting: () => void;
  onStopHosting: () => void;
  hostStatus: string;
  onJoinSessionInvite?: (code: string, password?: string) => void;
}

export const SnowRemoteSupport: React.FC<SnowRemoteSupportProps> = ({
  localAuthKey,
  devicePassword,
  onCopyAccessKey,
  onOpenSetPassword,
  onConnect,
  onStartHosting,
  onStopHosting,
  hostStatus,
  onJoinSessionInvite
}) => {
  const { user } = useAuthStore();
  const lang = user?.language;
  const [partnerId, setPartnerId] = useState('');
  const [activeTab, setActiveTab] = useState<'id' | 'sessions'>('id');
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [sessionName, setSessionName] = useState('Remote support session');
  const [sessionEmail, setSessionEmail] = useState('');
  const [sessionInviteStatus, setSessionInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sessionInviteMessage, setSessionInviteMessage] = useState('');
  const [remoteSessions, setRemoteSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showJoinSessionModal, setShowJoinSessionModal] = useState(false);
  const [joinSessionCode, setJoinSessionCode] = useState('');
  const [joinSessionPassword, setJoinSessionPassword] = useState('');

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
      const electronApi = (window as any).electronAPI;
      if (electronApi?.clipboard?.writeText) electronApi.clipboard.writeText(devicePassword);
      else navigator.clipboard.writeText(devicePassword);
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
    }
  };

  const copyText = (text: string) => {
    const electronApi = (window as any).electronAPI;
    if (electronApi?.clipboard?.writeText) return electronApi.clipboard.writeText(text);
    return navigator.clipboard?.writeText(text);
  };

  const isOnline = hostStatus.includes('Online') || hostStatus.includes('WebRTC') || hostStatus.includes('Registered');
  const sessionCode = (localAuthKey || '').replace(/\s/g, '');
  const sessionLink = `remotelink://join?code=${encodeURIComponent(sessionCode)}&password=${encodeURIComponent(devicePassword || '')}`;

  const fetchRemoteSessions = async () => {
    setLoadingSessions(true);
    try {
      const { data } = await api.get('/api/chat/remote-sessions');
      setRemoteSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[RemoteSupport] Failed to fetch remote sessions', err);
    } finally {
      setLoadingSessions(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'sessions') fetchRemoteSessions();
  }, [activeTab]);

  const handleStartSessionInvite = async () => {
    if (!sessionCode) {
      setSessionInviteStatus('error');
      setSessionInviteMessage('This device is still getting its RemoteLink ID.');
      return;
    }

    setSessionInviteStatus('sending');
    setSessionInviteMessage('');
    try {
      if (!isOnline) onStartHosting();
      const { data } = await api.post('/api/chat/session-invites', {
        email: sessionEmail.trim() || undefined,
        sessionName,
        sessionCode,
        sessionPassword: devicePassword,
        sessionLink
      });
      if (data?.remoteSession) {
        setRemoteSessions((prev) => [data.remoteSession, ...prev.filter((session) => session.id !== data.remoteSession.id)]);
      }
      await copyText(sessionLink);
      setSessionInviteStatus('sent');
      setSessionInviteMessage(sessionEmail.trim()
        ? 'Invite sent by email. The join link was copied too.'
        : 'Session link copied. Share it anywhere.');
    } catch (err: any) {
      setSessionInviteStatus('error');
      setSessionInviteMessage(err.response?.data?.error || err.message || 'Could not create session invite.');
    }
  };

  const handleJoinSession = () => {
    const cleanCode = joinSessionCode.replace(/\D/g, '');
    if (!cleanCode) return;
    onJoinSessionInvite?.(cleanCode, joinSessionPassword.trim() || undefined);
    setShowJoinSessionModal(false);
    setJoinSessionCode('');
    setJoinSessionPassword('');
  };

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
          ) : remoteSessions.length > 0 ? (
            <div className="bg-white dark:bg-[#0F0F0F] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
              <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-[#F5F5F5]">Sessions</h3>
                  <p className="text-[12px] text-gray-400 dark:text-[#A0A0A0]">Created sessions and invited collaborators.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchRemoteSessions}
                    className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center"
                    title="Refresh sessions"
                  >
                    <RefreshCw size={15} className={loadingSessions ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => setShowAddSessionModal(true)}
                    className="px-4 py-2 bg-[#1D6DF5] text-white rounded-lg text-[12px] font-bold hover:bg-blue-700 transition-colors"
                  >
                    New session
                  </button>
                  <button
                    onClick={() => setShowJoinSessionModal(true)}
                    className="px-4 py-2 bg-[#00193F] text-white rounded-lg text-[12px] font-bold hover:bg-[#002255] transition-colors"
                  >
                    Join a session
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 dark:bg-white/5">
                    <tr className="text-[12px] text-gray-500 dark:text-[#A0A0A0]">
                      <th className="px-6 py-3 font-bold">Session</th>
                      <th className="px-6 py-3 font-bold">Code</th>
                      <th className="px-6 py-3 font-bold">Collaborators</th>
                      <th className="px-6 py-3 font-bold">Status</th>
                      <th className="px-6 py-3 font-bold">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                    {remoteSessions.map((session) => {
                      const collaborators = session.collaborators || [];
                      return (
                        <tr key={session.id} className="text-[13px] text-gray-700 dark:text-[#D1D1D1]">
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 dark:text-[#F5F5F5]">{session.name}</div>
                            <div className="text-[11px] text-gray-400">By {session.createdBy?.name || session.createdBy?.email || 'You'}</div>
                          </td>
                          <td className="px-6 py-4 font-mono">{formatId(session.sessionCode)}</td>
                          <td className="px-6 py-4">
                            {collaborators.length === 0 ? (
                              <span className="text-gray-400">No collaborators yet</span>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                {collaborators.map((collaborator: any) => (
                                  <span key={collaborator.id} className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-white/5 px-3 py-1 text-[12px]">
                                    <Users size={12} />
                                    {collaborator.user?.name || collaborator.name || collaborator.email}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-600">
                              {session.status || 'ACTIVE'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500">{new Date(session.createdAt).toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0F0F0F] rounded-2xl border border-gray-100 dark:border-white/5 p-12 text-center animate-in slide-in-from-bottom-4 duration-500">
               <div className="w-20 h-20 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                 {loadingSessions ? <RefreshCw size={40} className="text-gray-300 animate-spin" /> : <Clock size={40} className="text-gray-300" />}
               </div>
               <h3 className="text-xl font-bold text-gray-800 dark:text-[#F5F5F5] mb-2">No active sessions</h3>
               <p className="text-gray-400 dark:text-[#A0A0A0] max-w-sm mx-auto">
                 Once you start a remote control session, it will appear here for easy management.
               </p>
               <div className="mt-8 flex items-center justify-center gap-3">
                 <button 
                   onClick={() => setShowAddSessionModal(true)}
                   className="px-8 py-3 bg-[#1D6DF5] text-white rounded-xl font-bold text-[14px] hover:opacity-90 transition-all shadow-lg shadow-blue-500/20"
                 >
                   Start a new session
                 </button>
                 <button 
                   onClick={() => setShowJoinSessionModal(true)}
                   className="px-8 py-3 bg-[#00193F] text-white rounded-xl font-bold text-[14px] hover:bg-[#002255] transition-all shadow-lg shadow-blue-950/10"
                 >
                   Join a session
                 </button>
               </div>
            </div>
          )}

        </div>
      </div>

      {/* Add Session Modal */}
      {showAddSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1C1C1C] rounded-[24px] w-[500px] shadow-2xl p-6 font-sans">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <input
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  className="text-[20px] font-semibold text-[#1C1C1C] dark:text-[#F5F5F5] bg-transparent outline-none border-b border-transparent focus:border-blue-500"
                />
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
                  <span className="text-[14px] font-medium text-[#1C1C1C] dark:text-[#F5F5F5] truncate max-w-[270px]">{sessionLink}</span>
                  <button onClick={() => copyText(sessionLink)} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
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
                  <span className="text-[14px] font-medium text-[#1C1C1C] dark:text-[#F5F5F5]">{formatId(sessionCode)}</span>
                  <button onClick={() => copyText(formatId(sessionCode))} className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
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
                  value={sessionEmail}
                  onChange={(e) => {
                    setSessionEmail(e.target.value);
                    setSessionInviteStatus('idle');
                    setSessionInviteMessage('');
                  }}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] text-[13px] text-gray-800 dark:text-[#F5F5F5] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-400"
                />
              </div>

              {sessionInviteMessage && (
                <div className={`flex items-center gap-2 text-[12px] font-medium mb-2 ${sessionInviteStatus === 'error' ? 'text-red-500' : 'text-emerald-600'}`}>
                  {sessionInviteStatus === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
                  {sessionInviteMessage}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 mt-8">
                <button 
                  onClick={() => setShowAddSessionModal(false)}
                  className="text-[13px] font-medium text-gray-600 dark:text-[#A0A0A0] hover:text-gray-800 dark:hover:text-white transition-colors px-3 py-2"
                >
                  Cancel
                </button>
                <div className="flex rounded-lg overflow-hidden shadow-sm">
                  <button onClick={handleStartSessionInvite} disabled={sessionInviteStatus === 'sending'} className="bg-[#2B52D0] hover:bg-[#2040A0] disabled:opacity-60 text-white px-5 py-2 text-[13px] font-medium transition-colors border-r border-blue-700/30 flex items-center gap-2">
                    {sessionInviteStatus === 'sending' ? <RefreshCw size={14} className="animate-spin" /> : sessionEmail ? <Mail size={14} /> : <Zap size={14} />}
                    {sessionEmail ? 'Send invite' : 'Copy link'}
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

      {showJoinSessionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1C1C1C] rounded-[24px] w-full max-w-md shadow-2xl p-6 font-sans">
            <div className="mb-6">
              <h3 className="text-[22px] font-bold text-[#1C1C1C] dark:text-[#F5F5F5]">Join a session</h3>
              <p className="text-[13px] text-gray-500 dark:text-[#A0A0A0] mt-1">Enter the Remote 365 session code shared by the host.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Session code</label>
                <input
                  value={joinSessionCode}
                  onChange={(e) => setJoinSessionCode(formatId(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
                  placeholder="000 000 000"
                  className="mt-2 w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] text-[16px] font-mono tracking-wider text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Password</label>
                <input
                  value={joinSessionPassword}
                  onChange={(e) => setJoinSessionPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoinSession()}
                  placeholder="Optional"
                  className="mt-2 w-full h-12 px-4 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#0A0A0A] text-[14px] text-gray-900 dark:text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-7 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowJoinSessionModal(false)}
                className="px-4 py-2 text-[13px] font-bold text-gray-500 hover:text-gray-800 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleJoinSession}
                disabled={!joinSessionCode.replace(/\D/g, '')}
                className="px-6 py-2.5 rounded-xl bg-[#00193F] text-white disabled:opacity-50 text-[13px] font-bold hover:bg-[#002255] transition-colors"
              >
                Join session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
