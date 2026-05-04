import React, { useState } from 'react';
import { Monitor, KeyRound, ArrowRight, Shield, RefreshCw, Zap, Settings, Globe, Plus, LogIn, UserPlus, Eye, EyeOff, Radio, Lock, CheckCircle2, AlertTriangle, Clock, Copy } from 'lucide-react';
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
  lockoutSeconds,
  onCopyAccessKey,
  onToggleAutoHost,
  onOpenSetPassword,
  onStartHosting,
  onStopHosting,
  onSignIn,
  onSignUp,
  onSessionCodeChange,
  onAccessPasswordChange,
  onFindDevice,
  onConnectToHost,
  onBackToStep1,
  isElectron,
}) => {
  const [copied, setCopied] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const formatCode = (code: string) => {
    if (!code) return '';
    const c = code.replace(/[^0-9]/g, '');
    if (c.length === 9) return `${c.slice(0,3)} ${c.slice(3,6)} ${c.slice(6,9)}`;
    return c.match(/.{1,3}/g)?.join(' ') || c;
  };

  const handleCopy = () => {
    onCopyAccessKey();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHosting = hostStatus === 'status' || hostStatus === 'connecting';
  const canHost = isElectron && isAuthenticated;

  return (
    <div className="h-full w-full flex overflow-hidden bg-[#F8F9FA] font-inter select-none">
      {/* LEFT PANEL — Your Machine */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 lg:px-16 py-10 overflow-y-auto">
        <div className="w-full max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-[#1C1C1C] flex items-center justify-center shadow-lg shadow-black/10">
              <Monitor size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-[#1C1C1C] tracking-tight">Your Machine</h1>
              <p className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-[0.2em]">Share these credentials to allow remote access</p>
            </div>
          </div>

          {/* Access Key Card */}
          <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 mb-4 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-[rgba(28,28,28,0.4)]" />
                <span className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-wider">Access Key</span>
              </div>
              {isHosting ? (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-green-50 rounded-lg border border-green-100">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  <span className="text-[10px] font-bold text-green-600">Online</span>
                </div>
              ) : hostAccessKey ? (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
                  <span className="text-[10px] font-bold text-gray-500">Offline</span>
                </div>
              ) : null}
            </div>

            {hostAccessKey ? (
              <div className="flex items-center gap-3 mb-4">
                <p className="text-3xl font-mono font-black text-[#1C1C1C] tracking-[0.15em] flex-1">
                  {formatCode(hostAccessKey)}
                </p>
                <button onClick={handleCopy} className="p-2.5 rounded-xl bg-[#F8F9FA] hover:bg-[#1C1C1C] hover:text-white transition-all border border-[rgba(28,28,28,0.06)]">
                  {copied ? <CheckCircle2 size={16} className="text-green-500" /> : <Copy size={16} />}
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium text-[rgba(28,28,28,0.3)] italic mb-4">Not registered yet</p>
            )}

            <div className="flex items-center justify-between py-3 border-t border-[rgba(28,28,28,0.04)]">
              <div className="flex items-center gap-2">
                <Lock size={13} className="text-[rgba(28,28,28,0.4)]" />
                <span className="text-xs font-semibold text-[rgba(28,28,28,0.6)]">Connection Password</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-[rgba(28,28,28,0.5)]">{devicePassword ? `${devicePassword.length} chars set` : 'Not set'}</span>
                <button onClick={onOpenSetPassword} className="text-[11px] font-bold text-blue-600 hover:opacity-80 transition-opacity">
                  {devicePassword ? 'Change' : 'Set'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between py-3 border-t border-[rgba(28,28,28,0.04)]">
              <div className="flex items-center gap-2">
                <Radio size={13} className="text-[rgba(28,28,28,0.4)]" />
                <span className="text-xs font-semibold text-[rgba(28,28,28,0.6)]">Allow unattended access</span>
              </div>
              <button onClick={onToggleAutoHost} className={`relative w-9 h-5 rounded-full transition-colors ${isAutoHostEnabled ? 'bg-[#1C1C1C]' : 'bg-gray-200'}`}>
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isAutoHostEnabled ? 'translate-x-4' : ''}`} />
              </button>
            </div>
          </div>

          {isElectron && (
            <button
              onClick={isHosting ? onStopHosting : onStartHosting}
              disabled={!canHost && !isHosting}
              className={`w-full py-3 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${isHosting ? 'bg-red-50 text-red-600 border border-red-100 hover:bg-red-100' : 'bg-[#1C1C1C] text-white hover:opacity-95'} disabled:opacity-40`}
            >
              {isHosting ? <><Radio size={14} /> Stop Broadcasting</> : <><Zap size={14} /> Start Broadcasting</>}
            </button>
          )}
          {!isAuthenticated && (
            <p className="text-[10px] text-center text-[rgba(28,28,28,0.3)] mt-2 font-medium">Sign in to enable full hosting and device management</p>
          )}
        </div>
      </div>

      {/* RIGHT PANEL — Connect to Remote */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 lg:px-16 py-8 bg-[#1C1C1C] relative overflow-y-auto">
        <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-blue-600/10 blur-[100px] rounded-full -mr-20 -mt-20 pointer-events-none" />
        <div className="w-full max-w-md relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center">
              <Globe size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-white tracking-tight">Connect to Remote</h1>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-wider">Enter a host access key to join</p>
            </div>
          </div>

          {connectStep === 1 ? (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1.5 ml-1">Device Access Key</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center text-white/20">
                    <Monitor size={15} />
                  </div>
                  <input
                    autoFocus
                    type="text"
                    placeholder="000 000 000"
                    maxLength={11}
                    className="w-full bg-white/5 border border-white/10 text-white rounded-[16px] pl-11 pr-4 py-3.5 text-sm font-mono font-bold tracking-[0.15em] text-center focus:bg-white/10 focus:border-white/20 focus:ring-4 focus:ring-white/5 outline-none transition-all placeholder:text-white/20"
                    value={sessionCode}
                    onChange={e => onSessionCodeChange(formatCode(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') onFindDevice(); }}
                  />
                </div>
              </div>
              {connectError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-semibold text-red-300 leading-relaxed">{connectError}</p>
                </div>
              )}
              <button
                onClick={onFindDevice}
                disabled={connectStatus === 'connecting' || !sessionCode}
                className="w-full py-3.5 bg-white text-[#1C1C1C] rounded-2xl font-bold text-xs hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {connectStatus === 'connecting' ? <Clock size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                Connect
              </button>
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 mb-2">
                <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Monitor size={14} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold text-white/40 uppercase tracking-wider">Target Device</p>
                  <p className="text-sm font-bold text-white font-mono">{formatCode(sessionCode)}</p>
                  {targetDeviceName && <p className="text-[10px] text-white/50 font-medium">{targetDeviceName}</p>}
                </div>
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-white/40 uppercase tracking-wider block mb-1.5 ml-1">Device Password</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center text-white/20">
                    <Lock size={15} />
                  </div>
                  <input
                    autoFocus
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Enter password"
                    className="w-full bg-white/5 border border-white/10 text-white rounded-[16px] pl-11 pr-11 py-3.5 text-sm font-medium focus:bg-white/10 focus:border-white/20 focus:ring-4 focus:ring-white/5 outline-none transition-all placeholder:text-white/20"
                    value={accessPassword}
                    onChange={e => onAccessPasswordChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onConnectToHost(); }}
                  />
                  <button onClick={() => setShowPwd(!showPwd)} className="absolute inset-y-0 right-4 flex items-center text-white/30 hover:text-white transition-colors">
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {lockoutSeconds > 0 && (
                <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <Clock size={13} className="text-red-400 shrink-0" />
                  <p className="text-[11px] font-semibold text-red-300">Too many attempts. Try again in {lockoutSeconds}s.</p>
                </div>
              )}
              {connectError && !lockoutSeconds && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertTriangle size={13} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] font-semibold text-red-300 leading-relaxed">{connectError}</p>
                </div>
              )}

              <button
                onClick={onConnectToHost}
                disabled={connectStatus === 'connecting' || !accessPassword || lockoutSeconds > 0}
                className="w-full py-3.5 bg-white text-[#1C1C1C] rounded-2xl font-bold text-xs hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {connectStatus === 'connecting' ? <Clock size={15} className="animate-spin" /> : <Zap size={15} />}
                Establish Link
              </button>
              <button onClick={onBackToStep1} className="w-full text-center text-[11px] font-bold text-white/30 hover:text-white transition-colors py-2">
                Change Device
              </button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-white/10 text-center">
            <button onClick={onSignIn} className="text-[11px] font-bold text-white/40 hover:text-white transition-colors flex items-center justify-center gap-1.5 mx-auto">
              <LogIn size={13} /> Have an account? Sign in to see your saved devices.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
