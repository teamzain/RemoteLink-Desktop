import React, { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock, Copy, Eye, EyeOff, Lock, LogIn, RefreshCw, Settings } from 'lucide-react';
import logo from '../assets/logo.png';

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
  isElectron: boolean;
}

const InfoDot = () => <span className="tv-info-dot">i</span>;

export const SnowLanding: React.FC<SnowLandingProps> = ({
  hostAccessKey,
  hostStatus,
  devicePassword,
  isAuthenticated,
  connectStep,
  sessionCode,
  accessPassword,
  connectError,
  connectStatus,
  targetDeviceName,
  lockoutSeconds,
  onCopyAccessKey,
  onOpenSetPassword,
  onSignIn,
  onSignUp,
  onSessionCodeChange,
  onAccessPasswordChange,
  onFindDevice,
  onConnectToHost,
  onBackToStep1,
}) => {
  const [copied, setCopied] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const formatCode = (code: string) => {
    if (!code) return '';
    const c = code.replace(/[^0-9]/g, '');
    if (c.length === 9) return `${c.slice(0, 3)} ${c.slice(3, 6)} ${c.slice(6, 9)}`;
    return c.match(/.{1,3}/g)?.join(' ') || c;
  };

  const displayAccessKey = hostAccessKey ? formatCode(hostAccessKey) : '';

  const handleCopy = () => {
    if (displayAccessKey) onCopyAccessKey();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHosting = hostStatus === 'status' || hostStatus === 'connecting';

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
        <button className="tv-settings-button"><Settings size={18} /></button>

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
                <button onClick={() => devicePassword && navigator.clipboard.writeText(devicePassword)} className="tv-icon-button">
                  <Copy size={18} />
                </button>
              </div>
            </div>
          </div>

          <div className="tv-or"><span />Or<span /></div>
          <p className="tv-helper-text">Enter the session code provided by the supporter.</p>

          {connectStep === 1 ? (
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
              <div className="tv-connect-row">
                <button onClick={onConnectToHost} disabled={connectStatus === 'connecting' || !accessPassword || lockoutSeconds > 0}>
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
            <label><input type="checkbox" checked readOnly /> Start Remote 365 with Windows <InfoDot /></label>
            <label><input type="checkbox" checked readOnly /> Grant Easy Access to this device <InfoDot /></label>
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
