import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy, Eye, EyeOff, Lock, LogIn, Monitor, RefreshCw, Settings, Video, Wand2, X } from 'lucide-react';
import logo from '../assets/logo.png';
import api from '../lib/api';

interface SnowLandingProps {
  hostAccessKey: string | null;
  hostStatus: string;
  devicePassword: string;
  isAutoHostEnabled: boolean;
  isAuthenticated: boolean;
  connectStep: 1 | 2;
  sessionCode: string;
  accessPassword: string;
  connectError: string | null;
  connectStatus: string;
  targetDeviceName: string | null;
  targetPasswordRequired: boolean;
  lockoutSeconds: number;
  onCopyAccessKey: () => void;
  onToggleAutoHost: () => void;
  onOpenSetPassword: () => void;
  onStartHosting: () => void;
  onStopHosting: () => void;
  onSignIn: () => void;
  onSignUp: () => void;
  onSessionCodeChange: (code: string) => void;
  onAccessPasswordChange: (pwd: string) => void;
  onFindDevice: () => void;
  onConnectToHost: () => void;
  onBackToStep1: () => void;
  onJoinMeeting: (meetingId: string) => void;
  onCreateMeeting: (meetingId: string) => void;
  isElectron: boolean;
}

const InfoDot = () => <span className="tv-info-dot">i</span>;

export const SnowLanding: React.FC<SnowLandingProps> = ({
  hostAccessKey,
  hostStatus,
  devicePassword,
  isAutoHostEnabled,
  isAuthenticated,
  connectStep,
  sessionCode,
  accessPassword,
  connectError,
  connectStatus,
  targetDeviceName,
  targetPasswordRequired,
  lockoutSeconds,
  onCopyAccessKey,
  onToggleAutoHost,
  onOpenSetPassword,
  onSignIn,
  onSignUp,
  onSessionCodeChange,
  onAccessPasswordChange,
  onFindDevice,
  onConnectToHost,
  onBackToStep1,
  onJoinMeeting,
  onCreateMeeting,
}) => {
  const [copied, setCopied] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [joinMode, setJoinMode] = useState<'session' | 'meeting'>('session');
  const [meetingCode, setMeetingCode] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [startWithWindows, setStartWithWindows] = useState(() => localStorage.getItem('remote365_start_with_windows') !== 'false');
  const [easyAccess, setEasyAccess] = useState(() => localStorage.getItem('is_auto_host_enabled') !== 'false');
  const [syncClipboard, setSyncClipboard] = useState(() => localStorage.getItem('remote365_sync_clipboard') !== 'false');
  const [autoMinimize, setAutoMinimize] = useState(() => localStorage.getItem('remote365_auto_minimize_host') !== 'false');
  const [deviceName, setDeviceName] = useState(() => localStorage.getItem('remote365_device_name') || '');
  const [videoQuality, setVideoQuality] = useState(() => localStorage.getItem('remote365_video_quality') || 'balanced');
  const [streamFps, setStreamFps] = useState(() => localStorage.getItem('remote365_stream_fps') || '60');
  const [requirePassword, setRequirePassword] = useState(() => localStorage.getItem('remote365_require_password') !== 'false');
  const [showConnectionAlerts, setShowConnectionAlerts] = useState(() => localStorage.getItem('remote365_connection_alerts') !== 'false');

  const formatCode = (code: string) => {
    if (!code) return '';
    const c = code.replace(/[^0-9]/g, '');
    if (c.length === 9) return `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6, 9)}`;
    return c.match(/.{1,3}/g)?.join(' ') || c;
  };

  const displayAccessKey = hostAccessKey ? formatCode(hostAccessKey) : '';

  const extractMeetingCode = (value: string) => {
    const trimmed = value.trim();
    try {
      const parsed = new URL(trimmed);
      return parsed.searchParams.get('code') || parsed.pathname.split('/').filter(Boolean).pop() || trimmed;
    } catch {
      return trimmed;
    }
  };

  const formatMeetingCode = (code: string) => {
    const clean = String(code || '').replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length === 9) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
    return code.trim();
  };

  const handleCopy = () => {
    if (displayAccessKey) onCopyAccessKey();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copyText = (text: string) => {
    const electronApi = (window as any).electronAPI;
    if (electronApi?.clipboard?.writeText) return electronApi.clipboard.writeText(text);
    return navigator.clipboard.writeText(text);
  };

  const updateStartWithWindows = (checked: boolean) => {
    setStartWithWindows(checked);
    localStorage.setItem('remote365_start_with_windows', String(checked));
  };

  const updateEasyAccess = (checked: boolean) => {
    setEasyAccess(checked);
    localStorage.setItem('is_auto_host_enabled', String(checked));
    if (checked && !isAutoHostEnabled) onToggleAutoHost();
  };

  const updateSyncClipboard = (checked: boolean) => {
    setSyncClipboard(checked);
    localStorage.setItem('remote365_sync_clipboard', String(checked));
  };

  const updateAutoMinimize = (checked: boolean) => {
    setAutoMinimize(checked);
    localStorage.setItem('remote365_auto_minimize_host', String(checked));
  };

  const updateDeviceName = (value: string) => {
    setDeviceName(value);
    localStorage.setItem('remote365_device_name', value);
  };

  const updateVideoQuality = (value: string) => {
    setVideoQuality(value);
    localStorage.setItem('remote365_video_quality', value);
  };

  const updateStreamFps = (value: string) => {
    setStreamFps(value);
    localStorage.setItem('remote365_stream_fps', value);
  };

  const updateRequirePassword = (checked: boolean) => {
    setRequirePassword(checked);
    localStorage.setItem('remote365_require_password', String(checked));
    const accessKey = String(hostAccessKey || localStorage.getItem('remote365_device_access_key') || '').replace(/\D/g, '');
    if (accessKey) {
      api.post('/api/devices/self-register', {
        accessKey,
        name: localStorage.getItem('remote365_device_name') || undefined,
        password: devicePassword || undefined,
        passwordRequired: checked,
      }).catch((err) => console.warn('[Settings] Failed to sync password requirement:', err?.message || err));
    }
  };

  const updateConnectionAlerts = (checked: boolean) => {
    setShowConnectionAlerts(checked);
    localStorage.setItem('remote365_connection_alerts', String(checked));
  };

  const handleJoinMeeting = () => {
    const code = formatMeetingCode(extractMeetingCode(meetingCode));
    if (code) onJoinMeeting(code);
  };

  const handleCreateMeeting = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const raw = Array.from({ length: 9 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    onCreateMeeting(formatMeetingCode(raw));
  };

  return (
    <div className="tv-landing">
      <section className="tv-brand-panel">
        <div className="tv-brand-top">
          <img src={logo} alt="Remote 365" className="tv-brand-logo" />
          <span className="tv-brand-name">Remote 365</span>
        </div>

        <div className="tv-brand-center">
          <h1>Access and support<br />from anywhere</h1>
          <button onClick={onSignIn} className="tv-signin-button">Sign in to Remote 365</button>
          <p>Don't have an account? <button onClick={onSignUp}>Create one here</button></p>
        </div>

      </section>

      <section className="tv-access-panel">
        <button onClick={() => setShowSettings(true)} className="tv-settings-button" title="Settings"><Settings size={18} /></button>

        {showSettings && (
          <div className="tv-settings-modal-wrap">
            <div className="tv-settings-modal">
              <div className="tv-settings-head">
                <div>
                  <h3>Settings</h3>
                  <p>Local access preferences</p>
                </div>
                <button onClick={() => setShowSettings(false)}><X size={16} /></button>
              </div>

              <div className="tv-settings-section">
                <h4>Device</h4>
                <label className="tv-settings-field">
                  <span>Device name</span>
                  <input
                    type="text"
                    placeholder="This laptop"
                    value={deviceName}
                    onChange={e => updateDeviceName(e.target.value)}
                  />
                </label>
                <label><input type="checkbox" checked={startWithWindows} onChange={e => updateStartWithWindows(e.target.checked)} /> Start Remote 365 with Windows</label>
                <label><input type="checkbox" checked={easyAccess} onChange={e => updateEasyAccess(e.target.checked)} /> Grant Easy Access to this device</label>
                <label><input type="checkbox" checked={requirePassword} onChange={e => updateRequirePassword(e.target.checked)} /> Require password before remote access</label>
              </div>

              <div className="tv-settings-section">
                <h4>Remote quality</h4>
                <label className="tv-settings-field">
                  <span>Video quality</span>
                  <select value={videoQuality} onChange={e => updateVideoQuality(e.target.value)}>
                    <option value="smooth">Smooth - lower bandwidth</option>
                    <option value="balanced">Balanced</option>
                    <option value="sharp">Sharp - higher quality</option>
                  </select>
                </label>
                <label className="tv-settings-field">
                  <span>Frame rate</span>
                  <select value={streamFps} onChange={e => updateStreamFps(e.target.value)}>
                    <option value="15">15 FPS</option>
                    <option value="30">30 FPS</option>
                    <option value="60">60 FPS</option>
                  </select>
                </label>
              </div>

              <div className="tv-settings-section">
                <h4>Session behavior</h4>
                <label><input type="checkbox" checked={syncClipboard} onChange={e => updateSyncClipboard(e.target.checked)} /> Sync clipboard during sessions</label>
                <label><input type="checkbox" checked={autoMinimize} onChange={e => updateAutoMinimize(e.target.checked)} /> Minimize app when a session starts</label>
                <label><input type="checkbox" checked={showConnectionAlerts} onChange={e => updateConnectionAlerts(e.target.checked)} /> Show connection alerts</label>
              </div>

              <div className="tv-settings-actions">
                <button onClick={onOpenSetPassword}>Change password</button>
                <button onClick={() => setShowSettings(false)}>Done</button>
              </div>
            </div>
          </div>
        )}

        <div className="tv-access-content">
          <p className="tv-helper-text">Share your ID and password with the supporter.</p>

          <div className="tv-credential-card">
            <div className="tv-credential-row">
              <div>
                <p className="tv-label">Your ID</p>
                <p className="tv-id">{displayAccessKey || '--- --- ---'}</p>
              </div>
              <button onClick={handleCopy} className="tv-icon-button">
                {copied ? <CheckCircle2 size={18} className="text-green-600" /> : <Copy size={18} />}
              </button>
            </div>

            <div className="tv-divider" />

            <div className="tv-credential-row">
              <div>
                <p className="tv-label">Password</p>
                <p className="tv-password">{devicePassword || 'Not set'}</p>
              </div>
              <div className="tv-icon-group">
                <button onClick={onOpenSetPassword} className="tv-icon-button"><RefreshCw size={17} /></button>
                <button onClick={() => devicePassword && copyText(devicePassword)} className="tv-icon-button">
                  <Copy size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="tv-or"><span />Or<span /></div>
          <div className="tv-join-tabs">
            <button className={joinMode === 'session' ? 'active' : ''} onClick={() => setJoinMode('session')}><Monitor size={14} /> Session</button>
            <button className={joinMode === 'meeting' ? 'active' : ''} onClick={() => setJoinMode('meeting')}><Video size={14} /> Meeting</button>
          </div>
          <p className="tv-helper-text">
            {joinMode === 'session' ? 'Enter the session code provided by the supporter.' : 'Enter a meeting code or invite link.'}
          </p>

          {joinMode === 'meeting' ? (
            <div className="tv-meeting-tools">
              <div className="tv-session-row">
                <label className="tv-session-field">
                  <span>Meeting Code</span>
                  <input
                    type="text"
                    placeholder="e.g. 123-456-789"
                    value={meetingCode}
                    onChange={e => setMeetingCode(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleJoinMeeting(); }}
                  />
                </label>
                <button onClick={handleJoinMeeting} disabled={!meetingCode.trim()} className="tv-join-button">
                  Join meeting
                </button>
              </div>
              <button onClick={handleCreateMeeting} className="tv-create-meeting-button">
                <Wand2 size={15} /> Create new meeting
              </button>
            </div>
          ) : connectStep === 1 ? (
            <div className="tv-session-row">
              <label className="tv-session-field">
                <span>Session Code</span>
                <input
                  autoFocus
                  type="text"
                  placeholder="e.g. 123 456 789"
                  maxLength={11}
                  value={sessionCode}
                  onChange={e => onSessionCodeChange(formatCode(e.target.value))}
                  onKeyDown={e => { if (e.key === 'Enter') onFindDevice(); }}
                />
              </label>
              <button onClick={onFindDevice} disabled={connectStatus === 'connecting' || !sessionCode} className="tv-join-button">
                {connectStatus === 'connecting' ? 'Checking...' : 'Join session'}
              </button>
            </div>
          ) : (
            <div className="tv-password-flow">
              <div className="tv-target-box">
                <div>
                  <p>Target device</p>
                  <strong>{formatCode(sessionCode)}</strong>
                  {targetDeviceName && <span>{targetDeviceName}</span>}
                </div>
                <i />
              </div>
              {targetPasswordRequired ? (
                <div className="tv-password-input-wrap">
                  <Lock size={15} />
                  <input
                    autoFocus
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Enter password"
                    value={accessPassword}
                    onChange={e => onAccessPasswordChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onConnectToHost(); }}
                  />
                  <button onClick={() => setShowPwd(!showPwd)}>
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              ) : (
                <div className="tv-passwordless-note">
                  <CheckCircle2 size={16} />
                  <span>This device allows passwordless access.</span>
                </div>
              )}
              <div className="tv-connect-row">
                <button onClick={onConnectToHost} disabled={connectStatus === 'connecting' || (targetPasswordRequired && !accessPassword) || lockoutSeconds > 0}>
                  {connectStatus === 'connecting' ? 'Connecting...' : 'Connect'}
                </button>
                <button onClick={onBackToStep1}>Back</button>
              </div>
            </div>
          )}

          {(connectError || lockoutSeconds > 0) && (
            <div className="tv-error">
              <AlertTriangle size={14} />
              <p>{lockoutSeconds > 0 ? `Too many attempts. Try again in ${lockoutSeconds}s.` : connectError}</p>
            </div>
          )}

          <div className="tv-options">
            <label><input type="checkbox" checked={startWithWindows} onChange={e => updateStartWithWindows(e.target.checked)} /> Start Remote 365 with Windows <InfoDot /></label>
            <label><input type="checkbox" checked={easyAccess} onChange={e => updateEasyAccess(e.target.checked)} /> Grant Easy Access to this device <InfoDot /></label>
          </div>

          {!isAuthenticated && (
            <button onClick={onSignIn} className="tv-account-link">
              <LogIn size={13} /> Have an account? Sign in to see your saved devices.
            </button>
          )}
        </div>
      </section>
    </div>
  );
};
