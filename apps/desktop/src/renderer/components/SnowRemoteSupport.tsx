import React, { useEffect, useRef, useState } from 'react';
import {
  Monitor,
  Copy,
  RefreshCw,
  ChevronDown,
  Info,
  Clock,
  History,
  Zap,
  Mail,
  CheckCircle2,
  AlertCircle,
  Users,
  X as CloseIcon,
  Trash2,
  ArrowRight
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';
import {
  RecentConnection,
  formatAccessKey,
  getRecentConnections,
  removeRecentConnection,
} from '../lib/recentConnections';

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
  onJoinMeeting?: (meetingId: string) => void;
  isAutoHostEnabled?: boolean;
  onToggleAutoHost?: (next: boolean) => void;
  /** Shown under Connect when device lookup fails (signed-in Remote Support). */
  remoteLookupError?: string | null;
  /** True while /lookup or /status is in progress. */
  isRemoteLookupConnecting?: boolean;
  initialTab?: 'id' | 'sessions';
  openCreateSessionSignal?: number;
  openJoinSessionSignal?: number;
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
  onJoinSessionInvite,
  onJoinMeeting,
  isAutoHostEnabled,
  onToggleAutoHost,
  remoteLookupError,
  isRemoteLookupConnecting,
  initialTab,
  openCreateSessionSignal,
  openJoinSessionSignal,
}) => {
  const { user } = useAuthStore();
  const [partnerId, setPartnerId] = useState('');
  const [activeTab, setActiveTab] = useState<'id' | 'sessions'>('id');
  const [showAddSessionModal, setShowAddSessionModal] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [sessionName, setSessionName] = useState('Remote support invite');
  const [sessionEmail, setSessionEmail] = useState('');
  const [sessionInviteStatus, setSessionInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [sessionInviteMessage, setSessionInviteMessage] = useState('');
  const [remoteSessions, setRemoteSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [showJoinSessionModal, setShowJoinSessionModal] = useState(false);
  const [joinSessionCode, setJoinSessionCode] = useState('');
  const [joinSessionPassword, setJoinSessionPassword] = useState('');
  const [recentConnections, setRecentConnections] = useState<RecentConnection[]>(() => getRecentConnections());
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [easyAccess, setEasyAccess] = useState<boolean>(() =>
    typeof isAutoHostEnabled === 'boolean'
      ? isAutoHostEnabled
      : localStorage.getItem('is_auto_host_enabled') !== 'false'
  );
  const recentDropdownRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof isAutoHostEnabled === 'boolean') setEasyAccess(isAutoHostEnabled);
  }, [isAutoHostEnabled]);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!openCreateSessionSignal) return;
    setActiveTab('sessions');
    setShowJoinSessionModal(false);
    setShowAddSessionModal(true);
  }, [openCreateSessionSignal]);

  useEffect(() => {
    if (!openJoinSessionSignal) return;
    setActiveTab('sessions');
    setShowAddSessionModal(false);
    setShowJoinSessionModal(true);
  }, [openJoinSessionSignal]);

  const refreshRecentConnections = () => setRecentConnections(getRecentConnections());

  // Re-read recent connections whenever this view re-mounts and when window regains focus
  useEffect(() => {
    refreshRecentConnections();
    const handler = () => refreshRecentConnections();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, []);

  // Close the recent-IDs dropdown on outside click
  useEffect(() => {
    if (!showRecentDropdown) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (recentDropdownRef.current?.contains(target)) return;
      if (inputWrapperRef.current?.contains(target)) return;
      setShowRecentDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showRecentDropdown]);

  const formatId = (id: string | null) => formatAccessKey(id);
  const cleanPartnerId = partnerId.replace(/\D/g, '');
  const canConnect = cleanPartnerId.length >= 6;

  const handlePartnerIdChange = (value: string) => {
    const formatted = formatAccessKey(value.replace(/\D/g, '').slice(0, 9));
    setPartnerId(formatted);
  };

  const handleConnect = () => {
    if (!canConnect) return;
    onConnect(cleanPartnerId);
  };

  const handleEasyAccessToggle = (checked: boolean) => {
    setEasyAccess(checked);
    localStorage.setItem('is_auto_host_enabled', String(checked));
    localStorage.setItem('remote365_require_password', checked ? 'false' : 'true');
    if (onToggleAutoHost) {
      onToggleAutoHost(checked);
    } else if (checked) {
      onStartHosting();
    } else {
      onStopHosting();
    }
  };

  const handlePickRecent = (entry: RecentConnection) => {
    setPartnerId(formatAccessKey(entry.accessKey));
    setShowRecentDropdown(false);
    onConnect(entry.accessKey);
  };

  const handleRemoveRecent = (event: React.MouseEvent, entry: RecentConnection) => {
    event.stopPropagation();
    setRecentConnections(removeRecentConnection(entry.accessKey));
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

  const copyText = async (text: string) => {
    const value = String(text || '');
    if (!value) return false;
    const electronApi = (window as any).electronAPI;
    try {
      if (electronApi?.clipboard?.writeText) {
        await electronApi.clipboard.writeText(value);
        return true;
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
      const input = document.createElement('textarea');
      input.value = value;
      input.setAttribute('readonly', 'true');
      input.style.position = 'fixed';
      input.style.opacity = '0';
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(input);
      return ok;
    } catch (error) {
      console.error('[RemoteSupport] Clipboard copy failed', error);
      return false;
    }
  };

  const isOnline = hostStatus.includes('Online') || hostStatus.includes('WebRTC') || hostStatus.includes('Registered');
  const sessionCode = (localAuthKey || '').replace(/\s/g, '');
  const sessionLink = `remotelink://join?code=${encodeURIComponent(sessionCode)}&password=${encodeURIComponent(devicePassword || '')}`;
  const getSessionExpiresAt = (session: any) => {
    if (session?.expiresAt) return new Date(session.expiresAt);
    const ttlMs = session?.type === 'VIDEO_MEETING' ? 30 * 60 * 1000 : 60 * 60 * 1000;
    return new Date(new Date(session?.createdAt || Date.now()).getTime() + ttlMs);
  };
  const isSessionJoinable = (session: any) =>
    String(session?.status || 'ACTIVE').toUpperCase() === 'ACTIVE' &&
    !session?.isExpired &&
    getSessionExpiresAt(session).getTime() > Date.now();
  const handleOpenSessionRow = (session: any) => {
    if (!isSessionJoinable(session)) return;
    const code = String(session.sessionCode || '').replace(/[^a-zA-Z0-9]/g, '');
    if (!code) return;
    if (session.type === 'VIDEO_MEETING') {
      onJoinMeeting?.(formatId(code));
      return;
    }
    onJoinSessionInvite?.(code);
  };

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
      const copied = await copyText(sessionLink);
      setSessionInviteStatus('sent');
      setSessionInviteMessage(sessionEmail.trim()
        ? `Invite sent by email.${copied ? ' The invite link was copied too.' : ''}`
        : copied ? 'Support invite link copied. Share it anywhere.' : 'Support invite created, but clipboard copy was blocked.');
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
            Support sessions
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

                  <label className="flex items-center gap-3 px-1 cursor-pointer select-none group">
                    <span className="relative inline-flex items-center">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={easyAccess}
                        onChange={(event) => handleEasyAccessToggle(event.target.checked)}
                      />
                      <span className="w-4 h-4 border-2 border-gray-300 dark:border-white/20 rounded peer-checked:bg-[#1D6DF5] peer-checked:border-[#1D6DF5] transition-all flex items-center justify-center">
                        {easyAccess && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                      </span>
                    </span>
                    <span className="text-[13px] text-gray-500 dark:text-[#A0A0A0] group-hover:text-gray-700 dark:group-hover:text-white transition-colors">
                      Grant Easy Access without password
                    </span>
                    <span title="When enabled, this device starts hosting automatically and trusted users can connect without entering a device password.">
                      <Info size={14} className="text-gray-300 dark:text-[#555555]" />
                    </span>
                  </label>
                </div>
              </div>

              {/* Right Column: Control remote device */}
              <div className="p-10 flex flex-col">
                <h3 className="text-lg font-bold text-gray-800 dark:text-[#F5F5F5] mb-8">Control remote device</h3>

                <div className="space-y-6 flex-1 flex flex-col">
                  <div className="relative">
                    <div className="flex items-center gap-2 text-[14px] font-semibold text-blue-600 mb-4">
                      Remote control
                    </div>

                    <div className="relative">
                      <div className="absolute -top-2 left-3 px-1 bg-white dark:bg-[#0F0F0F] text-[10px] font-bold text-gray-400 dark:text-[#A0A0A0] uppercase tracking-wider z-10">
                        ID, IP address, or hostname
                      </div>
                      <div className="flex gap-2">
                        <div className="relative flex-1" ref={inputWrapperRef}>
                          <input
                            type="text"
                            placeholder="Enter end user's ID"
                            value={partnerId}
                            onChange={(e) => handlePartnerIdChange(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleConnect();
                              }
                            }}
                            onFocus={() => { if (recentConnections.length > 0) setShowRecentDropdown(true); }}
                            className="w-full h-12 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 pr-10 text-[14px] font-mono tracking-wider text-gray-800 dark:text-white outline-none focus:border-[#1D6DF5] transition-all"
                          />
                          {recentConnections.length > 0 && (
                            <button
                              type="button"
                              onClick={() => setShowRecentDropdown((value) => !value)}
                              className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${showRecentDropdown ? 'text-[#1D6DF5]' : 'text-gray-300 hover:text-gray-600 dark:hover:text-gray-200'}`}
                              title="Pick a recent connection"
                            >
                              <ChevronDown size={18} className={showRecentDropdown ? 'rotate-180 transition-transform' : 'transition-transform'} />
                            </button>
                          )}
                          {showRecentDropdown && recentConnections.length > 0 && (
                            <div
                              ref={recentDropdownRef}
                              className="absolute left-0 right-0 top-full mt-2 z-20 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-[#151515] shadow-2xl overflow-hidden"
                            >
                              <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-gray-400 dark:text-[#A0A0A0] border-b border-gray-50 dark:border-white/5">
                                Recent IDs
                              </div>
                              <div className="max-h-[220px] overflow-y-auto">
                                {recentConnections.map((entry) => (
                                  <button
                                    key={entry.accessKey}
                                    type="button"
                                    onClick={() => handlePickRecent(entry)}
                                    className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 text-left transition-colors"
                                  >
                                    <Clock size={14} className="text-gray-400 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="text-[13px] font-mono tracking-wider text-gray-800 dark:text-[#F5F5F5]">{formatAccessKey(entry.accessKey)}</div>
                                      {entry.name && (
                                        <div className="text-[11px] text-gray-400 dark:text-[#A0A0A0] truncate">{entry.name}</div>
                                      )}
                                    </div>
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onClick={(e) => handleRemoveRecent(e, entry)}
                                      className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-300 hover:text-red-500 transition-colors"
                                      title="Remove from recent"
                                    >
                                      <CloseIcon size={12} />
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 space-y-2">
                    <button
                      type="button"
                      onClick={handleConnect}
                      disabled={!canConnect || isRemoteLookupConnecting}
                      className={`px-10 py-3 font-bold text-[13px] rounded-lg transition-all flex items-center gap-2 ${
                        canConnect && !isRemoteLookupConnecting
                          ? 'bg-[#1D6DF5] text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                          : 'bg-gray-100 dark:bg-white/5 text-gray-400 dark:text-[#555555] cursor-not-allowed'
                      }`}
                    >
                      {isRemoteLookupConnecting ? <RefreshCw size={14} className="animate-spin" /> : null}
                      Connect
                      {canConnect && !isRemoteLookupConnecting && <ArrowRight size={14} />}
                    </button>
                    {remoteLookupError ? (
                      <p className="text-[12px] font-medium text-red-500 dark:text-red-400 max-w-md">{remoteLookupError}</p>
                    ) : null}
                  </div>

                  <div className="mt-auto space-y-3 pt-12">
                    <div>
                      <button
                        type="button"
                        onClick={() => setRecentExpanded((value) => !value)}
                        className="w-full flex items-center justify-between py-2 border-b border-gray-50 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <Clock size={16} className="text-gray-400 group-hover:text-[#1D6DF5] transition-colors" />
                          <span className="text-[13px] text-gray-700 dark:text-[#D1D1D1]">Recent connections</span>
                          {recentConnections.length > 0 && (
                            <span className="text-[11px] font-medium text-gray-400">{recentConnections.length}</span>
                          )}
                        </div>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${recentExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {recentExpanded && (
                        <div className="mt-3 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                          {recentConnections.length === 0 ? (
                            <p className="px-3 py-3 text-[12px] text-gray-400 dark:text-[#A0A0A0]">
                              No recent connections yet. Once you connect to a device, it will appear here.
                            </p>
                          ) : (
                            recentConnections.map((entry) => (
                              <button
                                key={entry.accessKey}
                                type="button"
                                onClick={() => handlePickRecent(entry)}
                                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5 text-left transition-colors"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-mono tracking-wider text-gray-800 dark:text-[#F5F5F5]">
                                    {formatAccessKey(entry.accessKey)}
                                  </div>
                                  {entry.name && (
                                    <div className="text-[11px] text-gray-400 dark:text-[#A0A0A0] truncate">{entry.name}</div>
                                  )}
                                </div>
                                <span className="text-[11px] text-gray-400">
                                  {new Date(entry.lastConnectedAt).toLocaleDateString()}
                                </span>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => handleRemoveRecent(e, entry)}
                                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/10 text-gray-300 hover:text-red-500 transition-colors"
                                  title="Remove"
                                >
                                  <Trash2 size={12} />
                                </span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          const next = !historyExpanded;
                          setHistoryExpanded(next);
                          if (next && remoteSessions.length === 0) fetchRemoteSessions();
                        }}
                        className="w-full flex items-center justify-between py-2 border-b border-gray-50 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <History size={16} className="text-gray-400 group-hover:text-[#1D6DF5] transition-colors" />
                          <span className="text-[13px] text-gray-700 dark:text-[#D1D1D1]">Session history</span>
                          {remoteSessions.length > 0 && (
                            <span className="text-[11px] font-medium text-gray-400">{remoteSessions.length}</span>
                          )}
                        </div>
                        <ChevronDown size={14} className={`text-gray-400 transition-transform ${historyExpanded ? 'rotate-180' : ''}`} />
                      </button>
                      {historyExpanded && (
                        <div className="mt-3 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                          {loadingSessions ? (
                            <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-gray-400">
                              <RefreshCw size={12} className="animate-spin" />
                              Loading sessions...
                            </div>
                          ) : remoteSessions.length === 0 ? (
                            <button
                              type="button"
                              onClick={() => setActiveTab('sessions')}
                              className="w-full text-left px-3 py-3 text-[12px] text-gray-400 dark:text-[#A0A0A0] hover:text-blue-600 transition-colors"
                            >
                              No support invites yet. Click to open the Support invites tab.
                            </button>
                          ) : (
                            <>
                              {remoteSessions.slice(0, 4).map((session) => (
                                <div
                                  key={session.id}
                                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-white/5"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="text-[13px] font-medium text-gray-800 dark:text-[#F5F5F5] truncate">{session.name}</div>
                                    <div className="text-[11px] font-mono tracking-wider text-gray-400">{formatAccessKey(session.sessionCode)}</div>
                                  </div>
                                  <span className="text-[11px] text-gray-400">
                                    {new Date(session.createdAt).toLocaleDateString()}
                                  </span>
                                </div>
                              ))}
                              <button
                                type="button"
                                onClick={() => setActiveTab('sessions')}
                                className="w-full text-left px-3 py-2 text-[12px] font-medium text-blue-600 hover:underline"
                              >
                                View all support invites
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#0F0F0F] rounded-2xl border border-gray-100 dark:border-white/5 p-12 text-center animate-in slide-in-from-bottom-4 duration-500">
               <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                 <Clock size={40} className="text-[#1D6DF5]" />
               </div>
               <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#1D6DF5] mb-4">
                 Coming soon
               </div>
               <h3 className="text-xl font-bold text-gray-800 dark:text-[#F5F5F5] mb-2">Support sessions</h3>
               <p className="text-gray-400 dark:text-[#A0A0A0] max-w-md mx-auto">
                 Managed support sessions are being prepared. RemoteLink ID access is available now from the main tab.
               </p>
            </div>
          ) && false ? (
            <div className="bg-white dark:bg-[#0F0F0F] rounded-2xl border border-gray-100 dark:border-white/5 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
              <div className="px-6 py-5 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 dark:text-[#F5F5F5]">Support invites</h3>
                  <p className="text-[12px] text-gray-400 dark:text-[#A0A0A0]">Remote desktop invite links and collaborators.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchRemoteSessions}
                    className="w-9 h-9 rounded-lg bg-gray-50 dark:bg-white/5 text-gray-500 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 flex items-center justify-center"
                    title="Refresh support invites"
                  >
                    <RefreshCw size={15} className={loadingSessions ? 'animate-spin' : ''} />
                  </button>
                  <button
                    onClick={() => setShowAddSessionModal(true)}
                    className="px-4 py-2 bg-[#1D6DF5] text-white rounded-lg text-[12px] font-bold hover:bg-blue-700 transition-colors"
                  >
                    New invite
                  </button>
                  <button
                    onClick={() => setShowJoinSessionModal(true)}
                    className="px-4 py-2 bg-[#00193F] text-white rounded-lg text-[12px] font-bold hover:bg-[#002255] transition-colors"
                  >
                    Join invite
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
                      const joinable = isSessionJoinable(session);
                      const expiresAt = getSessionExpiresAt(session);
                      return (
                        <tr
                          key={session.id}
                          onClick={() => handleOpenSessionRow(session)}
                          className={`text-[13px] text-gray-700 dark:text-[#D1D1D1] transition-colors ${
                            joinable
                              ? 'cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-500/10'
                              : 'cursor-not-allowed opacity-60'
                          }`}
                          title={joinable ? 'Open this session' : 'This session link has expired'}
                        >
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 dark:text-[#F5F5F5]">{session.name}</div>
                            <div className="text-[11px] text-gray-400">
                              By {session.createdBy?.name || session.createdBy?.email || 'You'} • Expires {expiresAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                            </div>
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
                            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              joinable
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'
                                : 'bg-gray-100 dark:bg-white/5 text-gray-500'
                            }`}>
                              {joinable ? 'ACTIVE' : 'EXPIRED'}
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
               <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6">
                 <Clock size={40} className="text-[#1D6DF5]" />
               </div>
               <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 dark:bg-blue-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-[#1D6DF5] mb-4">
                 Coming soon
               </div>
               <h3 className="text-xl font-bold text-gray-800 dark:text-[#F5F5F5] mb-2">Support sessions</h3>
               <p className="text-gray-400 dark:text-[#A0A0A0] max-w-sm mx-auto">
                 Managed support sessions are being prepared. RemoteLink ID access is available now from the main tab.
               </p>
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
                  Invite link
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
                  Remote ID
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
                    {sessionEmail ? 'Send invite' : 'Copy invite link'}
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
              <h3 className="text-[22px] font-bold text-[#1C1C1C] dark:text-[#F5F5F5]">Join support invite</h3>
              <p className="text-[13px] text-gray-500 dark:text-[#A0A0A0] mt-1">Enter the Remote 365 session code shared by the host.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Remote ID or invite code</label>
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
