import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  History,
  Info,
  RefreshCw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import {
  formatAccessKey,
  getRecentConnections,
  recordRecentConnection,
  removeRecentConnection,
  type RecentConnection,
} from '../../lib/recentConnections';
import { notify } from '../NotificationProvider';

function generateAccessPassword(): string {
  return Math.floor(Math.random() * 100000000)
    .toString()
    .padStart(8, '0');
}

interface HostDevice {
  id: string;
  device_name?: string;
  name?: string;
  access_key: string;
  has_password?: boolean;
  password_required?: boolean;
  is_online?: boolean;
}

export const WebRemoteSupport: React.FC<{ devices: HostDevice[]; onDevicesChanged?: () => void }> = ({
  devices,
  onDevicesChanged,
}) => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'id' | 'sessions'>('id');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [easyAccess, setEasyAccess] = useState(false);
  const [partnerId, setPartnerId] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [recentConnections, setRecentConnections] = useState<RecentConnection[]>(() => getRecentConnections());
  const [showRecentDropdown, setShowRecentDropdown] = useState(false);
  const [recentExpanded, setRecentExpanded] = useState(false);
  const [historyExpanded, setHistoryExpanded] = useState(false);
  const [remoteSessions, setRemoteSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [pendingConnectKey, setPendingConnectKey] = useState<string | null>(null);
  const [connectPassword, setConnectPassword] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const recentDropdownRef = useRef<HTMLDivElement>(null);
  const inputWrapperRef = useRef<HTMLDivElement>(null);

  const selected = devices.find((d) => d.id === selectedId) || devices[0] || null;

  useEffect(() => {
    if (!devices.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !devices.some((d) => d.id === selectedId)) {
      setSelectedId(devices[0].id);
    }
  }, [devices, selectedId]);

  useEffect(() => {
    if (selected) {
      setEasyAccess(selected.password_required === false);
      setRevealedPassword(null);
    }
  }, [selected?.id, selected?.password_required]);

  const refreshRecentConnections = useCallback(() => setRecentConnections(getRecentConnections()), []);

  useEffect(() => {
    refreshRecentConnections();
    const handler = () => refreshRecentConnections();
    window.addEventListener('focus', handler);
    return () => window.removeEventListener('focus', handler);
  }, [refreshRecentConnections]);

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

  const formatId = (key: string | null | undefined) => formatAccessKey(key);

  const cleanPartnerId = partnerId.replace(/\D/g, '');
  const canConnect = cleanPartnerId.length >= 6;

  const handlePartnerIdChange = (value: string) => {
    const formatted = formatAccessKey(value.replace(/\D/g, '').slice(0, 9));
    setPartnerId(formatted);
  };

  const runConnect = async (accessKey: string, password?: string) => {
    setIsConnecting(true);
    try {
      const { data } = await api.post('/api/devices/verify-access', {
        accessKey,
        password: password || undefined,
      });
      if (data?.token && data?.device?.id) {
        const name = data.device?.name;
        recordRecentConnection(accessKey, name);
        refreshRecentConnections();
        try {
          sessionStorage.setItem(
            'remotelink_viewer_handoff',
            JSON.stringify({
              deviceId: data.device.id,
              accessToken: data.token,
              deviceName: name,
              accessKey: String(accessKey).replace(/\D/g, ''),
              ts: Date.now(),
            })
          );
        } catch {
          /* ignore quota / private mode */
        }
        navigate(`/session/${data.device.id}`, {
          state: {
            accessToken: data.token,
            deviceName: name,
            accessKey,
          },
        });
        setPasswordModalOpen(false);
        setConnectPassword('');
        setPendingConnectKey(null);
      }
    } catch (error: any) {
      const status = error.response?.status;
      if (status === 401) {
        setPendingConnectKey(accessKey);
        setPasswordModalOpen(true);
      } else if (status === 409) {
        notify('That device is offline.', 'warning');
      } else {
        notify(error.response?.data?.error || 'Could not start session.', 'error');
      }
    } finally {
      setIsConnecting(false);
    }
  };

  const handleConnect = () => {
    if (!canConnect) return;
    runConnect(cleanPartnerId);
  };

  const handlePasswordSubmit = () => {
    if (!pendingConnectKey) return;
    runConnect(pendingConnectKey, connectPassword);
  };

  const handlePickRecent = (entry: RecentConnection) => {
    setPartnerId(formatAccessKey(entry.accessKey));
    setShowRecentDropdown(false);
    runConnect(entry.accessKey);
  };

  const handleRemoveRecent = (event: React.MouseEvent, entry: RecentConnection) => {
    event.stopPropagation();
    setRecentConnections(removeRecentConnection(entry.accessKey));
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      notify('Could not copy to clipboard', 'error');
    }
  };

  const handleCopyId = () => {
    if (!selected?.access_key) return;
    copyText(String(selected.access_key).replace(/\D/g, ''));
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleCopyPwd = () => {
    const pwd = revealedPassword;
    if (!pwd) return;
    copyText(pwd);
    setCopiedPwd(true);
    setTimeout(() => setCopiedPwd(false), 2000);
  };

  const rotateHostPassword = async () => {
    if (!selected) return;
    const pwd = generateAccessPassword();
    try {
      await api.post('/api/devices/set-password', {
        deviceId: selected.id,
        password: pwd,
      });
      setRevealedPassword(pwd);
      onDevicesChanged?.();
      notify('New access password saved for this device.', 'success');
    } catch (err: any) {
      notify(err.response?.data?.error || 'Could not update password', 'error');
    }
  };

  const handleEasyAccessToggle = async (checked: boolean) => {
    if (!selected) return;
    setEasyAccess(checked);
    try {
      await api.post('/api/devices/set-password', {
        deviceId: selected.id,
        passwordRequired: !checked,
      });
      onDevicesChanged?.();
      notify(checked ? 'Connections may no longer require a password when trusted.' : 'Password requirement restored.', 'success');
    } catch (err: any) {
      setEasyAccess(!checked);
      notify(err.response?.data?.error || 'Could not update easy access', 'error');
    }
  };

  const showFreeBanner = user?.plan === 'FREE';

  return (
    <div className="flex flex-col w-full font-inter">
      {showFreeBanner && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] text-amber-900">
          <span className="font-semibold">Free license (non-commercial use only).</span>{' '}
          <button
            type="button"
            onClick={() => navigate('/dashboard/billing')}
            className="font-bold text-[#1D6DF5] hover:underline"
          >
            Upgrade plan
          </button>
        </div>
      )}

      <div className="flex justify-center py-4 border-b border-[rgba(28,28,28,0.06)]">
        <div className="flex bg-[#F8F9FA] p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('id')}
            className={`px-6 sm:px-8 py-2 text-[13px] font-semibold rounded-lg transition-all ${
              activeTab === 'id'
                ? 'bg-white text-[#1D6DF5] shadow-sm border border-[rgba(28,28,28,0.04)]'
                : 'text-[rgba(28,28,28,0.45)] hover:text-[#1C1C1C]'
            }`}
          >
            RemoteLink ID
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sessions')}
            className={`px-6 sm:px-8 py-2 text-[13px] font-semibold rounded-lg transition-all ${
              activeTab === 'sessions'
                ? 'bg-white text-[#1D6DF5] shadow-sm border border-[rgba(28,28,28,0.04)]'
                : 'text-[rgba(28,28,28,0.45)] hover:text-[#1C1C1C]'
            }`}
          >
            Sessions
          </button>
        </div>
      </div>

      <div className="flex-1 pt-8 pb-4">
        {activeTab === 'id' ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 border border-[rgba(28,28,28,0.08)] rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="p-6 sm:p-10 border-b lg:border-b-0 lg:border-r border-[rgba(28,28,28,0.08)]">
              <h3 className="text-lg font-bold text-[#1C1C1C] mb-6">Allow remote control</h3>

              {!selected ? (
                <p className="text-sm text-[rgba(28,28,28,0.45)] leading-relaxed">
                  You do not have any registered devices yet. Install Remote 365 on a computer and sign in to register
                  it, then your RemoteLink ID and password will appear here.
                </p>
              ) : (
                <>
                  {devices.length > 1 && (
                    <div className="mb-4">
                      <label className="text-[10px] font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-wider">
                        Device
                      </label>
                      <select
                        value={selected.id}
                        onChange={(e) => setSelectedId(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-[rgba(28,28,28,0.1)] bg-[#F8F9FA] px-3 py-2.5 text-sm font-semibold text-[#1C1C1C] outline-none focus:border-[#1D6DF5]"
                      >
                        {devices.map((d) => (
                          <option key={d.id} value={d.id}>
                            {(d.device_name || d.name || 'Device') + (d.is_online ? ' · online' : ' · offline')}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="bg-[#F8F9FA] rounded-xl p-6 border border-[rgba(28,28,28,0.06)]">
                      <div className="flex flex-col mb-4">
                        <span className="text-[11px] font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-widest mb-2">
                          Your ID
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-2xl sm:text-3xl font-bold text-[#1C1C1C] tracking-wider leading-none">
                            {formatId(selected.access_key)}
                          </span>
                          <button
                            type="button"
                            onClick={handleCopyId}
                            className="p-2 text-[rgba(28,28,28,0.35)] hover:text-[#1D6DF5] transition-colors shrink-0"
                            title="Copy ID"
                          >
                            {copiedId ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-widest mb-2">
                          Password
                        </span>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xl sm:text-2xl font-bold text-[#1C1C1C] tracking-wider leading-none font-mono">
                            {revealedPassword
                              ? revealedPassword
                              : selected.has_password
                                ? '••••••••'
                                : '--------'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={rotateHostPassword}
                              className="p-2 text-[rgba(28,28,28,0.35)] hover:text-[#1D6DF5] transition-colors"
                              title="Generate new password"
                            >
                              <RefreshCw size={18} />
                            </button>
                            <button
                              type="button"
                              onClick={handleCopyPwd}
                              disabled={!revealedPassword}
                              className="p-2 text-[rgba(28,28,28,0.35)] hover:text-[#1D6DF5] transition-colors disabled:opacity-40 disabled:pointer-events-none"
                              title="Copy password"
                            >
                              {copiedPwd ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Copy size={18} />}
                            </button>
                          </div>
                        </div>
                        <p className="mt-2 text-[11px] text-[rgba(28,28,28,0.4)]">
                          Generate a new password to share with someone you trust. The plain password is only shown here
                          right after you create it.
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center gap-3 px-1 cursor-pointer select-none group">
                      <span className="relative inline-flex items-center">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={easyAccess}
                          onChange={(e) => handleEasyAccessToggle(e.target.checked)}
                        />
                        <span className="w-4 h-4 border-2 border-[rgba(28,28,28,0.2)] rounded peer-checked:bg-[#1D6DF5] peer-checked:border-[#1D6DF5] transition-all flex items-center justify-center">
                          {easyAccess && <CheckCircle2 size={12} className="text-white" strokeWidth={3} />}
                        </span>
                      </span>
                      <span className="text-[13px] text-[rgba(28,28,28,0.5)] group-hover:text-[#1C1C1C] transition-colors">
                        Grant Easy Access to this device
                      </span>
                      <span title="When enabled, password is not required for incoming connections (after trust is established on the host).">
                        <Info size={14} className="text-[rgba(28,28,28,0.25)]" />
                      </span>
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="p-6 sm:p-10 flex flex-col">
              <h3 className="text-lg font-bold text-[#1C1C1C] mb-6">Control remote device</h3>

              <div className="space-y-6 flex-1 flex flex-col">
                <div className="relative">
                  <div className="text-[13px] font-semibold text-[#1D6DF5] mb-3">Remote control</div>
                  <div className="relative">
                    <div className="absolute -top-2 left-3 px-1 bg-white text-[10px] font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-wider z-10">
                      ID, IP address, or hostname
                    </div>
                    <div className="relative flex-1" ref={inputWrapperRef}>
                      <input
                        type="text"
                        placeholder="Enter end user's ID"
                        value={partnerId}
                        onChange={(e) => handlePartnerIdChange(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleConnect();
                        }}
                        onFocus={() => {
                          if (recentConnections.length > 0) setShowRecentDropdown(true);
                        }}
                        className="w-full h-12 bg-white border border-[rgba(28,28,28,0.12)] rounded-xl px-4 pr-10 text-[14px] font-mono tracking-wider text-[#1C1C1C] outline-none focus:border-[#1D6DF5] transition-all"
                      />
                      {recentConnections.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setShowRecentDropdown((v) => !v)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                            showRecentDropdown ? 'text-[#1D6DF5]' : 'text-[rgba(28,28,28,0.25)] hover:text-[#1C1C1C]'
                          }`}
                          title="Recent IDs"
                        >
                          <ChevronDown size={18} className={showRecentDropdown ? 'rotate-180 transition-transform' : ''} />
                        </button>
                      )}
                      {showRecentDropdown && recentConnections.length > 0 && (
                        <div
                          ref={recentDropdownRef}
                          className="absolute left-0 right-0 top-full mt-2 z-20 rounded-xl border border-[rgba(28,28,28,0.08)] bg-white shadow-xl overflow-hidden"
                        >
                          <div className="px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-[rgba(28,28,28,0.35)] border-b border-[rgba(28,28,28,0.06)]">
                            Recent IDs
                          </div>
                          <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                            {recentConnections.map((entry) => (
                              <button
                                key={entry.accessKey}
                                type="button"
                                onClick={() => handlePickRecent(entry)}
                                className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[#F8F9FA] text-left transition-colors"
                              >
                                <Clock size={14} className="text-[rgba(28,28,28,0.35)] shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-mono tracking-wider text-[#1C1C1C]">
                                    {formatAccessKey(entry.accessKey)}
                                  </div>
                                  {entry.name && (
                                    <div className="text-[11px] text-[rgba(28,28,28,0.4)] truncate">{entry.name}</div>
                                  )}
                                </div>
                                <span
                                  role="button"
                                  tabIndex={0}
                                  onClick={(e) => handleRemoveRecent(e, entry)}
                                  className="p-1 rounded hover:bg-[rgba(28,28,28,0.06)] text-[rgba(28,28,28,0.25)] hover:text-red-500 transition-colors"
                                  title="Remove from recent"
                                >
                                  <X size={12} />
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleConnect}
                    disabled={!canConnect || isConnecting}
                    className={`px-8 py-3 font-bold text-[13px] rounded-xl transition-all flex items-center gap-2 ${
                      canConnect && !isConnecting
                        ? 'bg-[#1D6DF5] text-white hover:bg-blue-700 shadow-md shadow-blue-500/15'
                        : 'bg-[#F8F9FA] text-[rgba(28,28,28,0.3)] cursor-not-allowed'
                    }`}
                  >
                    {isConnecting ? <RefreshCw size={14} className="animate-spin" /> : null}
                    Connect
                    {canConnect && !isConnecting && <ArrowRight size={14} />}
                  </button>
                </div>

                <div className="mt-auto space-y-3 pt-8">
                  <div>
                    <button
                      type="button"
                      onClick={() => setRecentExpanded((v) => !v)}
                      className="w-full flex items-center justify-between py-2 border-b border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.12)] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <Clock size={16} className="text-[rgba(28,28,28,0.35)] group-hover:text-[#1D6DF5] transition-colors" />
                        <span className="text-[13px] text-[#1C1C1C]">Recent connections</span>
                        {recentConnections.length > 0 && (
                          <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)]">{recentConnections.length}</span>
                        )}
                      </div>
                      <ChevronDown
                        size={14}
                        className={`text-[rgba(28,28,28,0.35)] transition-transform ${recentExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {recentExpanded && (
                      <div className="mt-3 space-y-1">
                        {recentConnections.length === 0 ? (
                          <p className="px-3 py-3 text-[12px] text-[rgba(28,28,28,0.4)]">
                            No recent connections yet. After you connect to a device, it appears here on this browser.
                          </p>
                        ) : (
                          recentConnections.map((entry) => (
                            <button
                              key={entry.accessKey}
                              type="button"
                              onClick={() => handlePickRecent(entry)}
                              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#F8F9FA] text-left transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-[13px] font-mono tracking-wider text-[#1C1C1C]">
                                  {formatAccessKey(entry.accessKey)}
                                </div>
                                {entry.name && (
                                  <div className="text-[11px] text-[rgba(28,28,28,0.4)] truncate">{entry.name}</div>
                                )}
                              </div>
                              <span className="text-[11px] text-[rgba(28,28,28,0.4)]">
                                {new Date(entry.lastConnectedAt).toLocaleDateString()}
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => handleRemoveRecent(e, entry)}
                                className="p-1 rounded hover:bg-[rgba(28,28,28,0.06)] text-[rgba(28,28,28,0.25)] hover:text-red-500 transition-colors"
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
                      className="w-full flex items-center justify-between py-2 border-b border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.12)] transition-colors group"
                    >
                      <div className="flex items-center gap-3">
                        <History size={16} className="text-[rgba(28,28,28,0.35)] group-hover:text-[#1D6DF5] transition-colors" />
                        <span className="text-[13px] text-[#1C1C1C]">Session history</span>
                        {remoteSessions.length > 0 && (
                          <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)]">{remoteSessions.length}</span>
                        )}
                      </div>
                      <ChevronDown
                        size={14}
                        className={`text-[rgba(28,28,28,0.35)] transition-transform ${historyExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {historyExpanded && (
                      <div className="mt-3 space-y-1">
                        {loadingSessions ? (
                          <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-[rgba(28,28,28,0.4)]">
                            <RefreshCw size={12} className="animate-spin" />
                            Loading sessions…
                          </div>
                        ) : remoteSessions.length === 0 ? (
                          <p className="px-3 py-3 text-[12px] text-[rgba(28,28,28,0.4)]">
                            No session invites yet. Open the Sessions tab to create one.
                          </p>
                        ) : (
                          <>
                            {remoteSessions.slice(0, 5).map((session) => (
                              <div
                                key={session.id}
                                className="flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-[#F8F9FA]"
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="text-[13px] font-medium text-[#1C1C1C] truncate">{session.name}</div>
                                  <div className="text-[11px] font-mono tracking-wider text-[rgba(28,28,28,0.4)]">
                                    {formatAccessKey(session.sessionCode)}
                                  </div>
                                </div>
                                <span className="text-[11px] text-[rgba(28,28,28,0.4)] shrink-0">
                                  {new Date(session.createdAt).toLocaleDateString()}
                                </span>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => setActiveTab('sessions')}
                              className="w-full text-left px-3 py-2 text-[12px] font-semibold text-[#1D6DF5] hover:underline"
                            >
                              View all sessions →
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
          <SessionsTab
            remoteSessions={remoteSessions}
            loadingSessions={loadingSessions}
            onRefresh={fetchRemoteSessions}
            formatId={formatId}
          />
        )}
      </div>

      {selected && (
        <div className="flex justify-end pt-2 text-[11px] text-[rgba(28,28,28,0.35)]">
          ID {formatId(selected.access_key)}
        </div>
      )}

      {passwordModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6 border border-[rgba(28,28,28,0.08)]">
            <h3 className="text-lg font-bold text-[#1C1C1C]">Password required</h3>
            <p className="text-[13px] text-[rgba(28,28,28,0.45)] mt-1">
              Enter the access password for this RemoteLink ID.
            </p>
            <input
              type="password"
              autoFocus
              value={connectPassword}
              onChange={(e) => setConnectPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePasswordSubmit()}
              className="mt-4 w-full h-12 px-4 rounded-xl border border-[rgba(28,28,28,0.12)] text-[14px] outline-none focus:border-[#1D6DF5]"
              placeholder="Access password"
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setPasswordModalOpen(false);
                  setConnectPassword('');
                  setPendingConnectKey(null);
                }}
                className="px-4 py-2 text-[13px] font-semibold text-[rgba(28,28,28,0.45)] hover:text-[#1C1C1C]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePasswordSubmit}
                disabled={isConnecting || !connectPassword}
                className="px-5 py-2 rounded-xl bg-[#1D6DF5] text-white text-[13px] font-bold disabled:opacity-50"
              >
                {isConnecting ? 'Connecting…' : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const SessionsTab: React.FC<{
  remoteSessions: any[];
  loadingSessions: boolean;
  onRefresh: () => void;
  formatId: (k: string | null | undefined) => string;
}> = ({ remoteSessions, loadingSessions, onRefresh, formatId }) => (
  <div className="bg-white rounded-2xl border border-[rgba(28,28,28,0.08)] overflow-hidden shadow-sm">
    <div className="px-6 py-5 border-b border-[rgba(28,28,28,0.06)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 className="text-lg font-bold text-[#1C1C1C]">Sessions</h3>
        <p className="text-[12px] text-[rgba(28,28,28,0.4)]">Invited remote sessions linked to your account.</p>
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[rgba(28,28,28,0.1)] text-[12px] font-bold text-[#1C1C1C] hover:bg-[#F8F9FA]"
      >
        <RefreshCw size={14} className={loadingSessions ? 'animate-spin' : ''} />
        Refresh
      </button>
    </div>
    {remoteSessions.length === 0 && !loadingSessions ? (
      <div className="p-12 text-center text-[13px] text-[rgba(28,28,28,0.4)]">
        No sessions yet. Use the desktop app to send session invites, or check back later.
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-[#F8F9FA]">
            <tr className="text-[11px] text-[rgba(28,28,28,0.4)] uppercase tracking-wider">
              <th className="px-6 py-3 font-bold">Session</th>
              <th className="px-6 py-3 font-bold">Code</th>
              <th className="px-6 py-3 font-bold">Collaborators</th>
              <th className="px-6 py-3 font-bold">Status</th>
              <th className="px-6 py-3 font-bold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(28,28,28,0.06)]">
            {remoteSessions.map((session) => {
              const collaborators = session.collaborators || [];
              return (
                <tr key={session.id} className="text-[13px] text-[#1C1C1C]">
                  <td className="px-6 py-4">
                    <div className="font-bold">{session.name}</div>
                    <div className="text-[11px] text-[rgba(28,28,28,0.4)]">
                      By {session.createdBy?.name || session.createdBy?.email || 'You'}
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-[12px]">{formatId(session.sessionCode)}</td>
                  <td className="px-6 py-4">
                    {collaborators.length === 0 ? (
                      <span className="text-[rgba(28,28,28,0.35)]">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {collaborators.map((c: any) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 rounded-full bg-[#F8F9FA] px-2.5 py-0.5 text-[11px]"
                          >
                            <Users size={10} />
                            {c.user?.name || c.name || c.email}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                      {session.status || 'ACTIVE'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-[12px] text-[rgba(28,28,28,0.45)]">
                    {new Date(session.createdAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    )}
  </div>
);
