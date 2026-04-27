import React, { useState } from 'react';
import { Monitor, Copy, CheckCircle2, Lock, Eye, EyeOff, ArrowRight, Zap, Globe, AlertTriangle, Clock, ShieldCheck } from 'lucide-react';

interface SnowHomeProps {
  localAuthKey: string | null;
  hostStatus: string;
  devicePassword: string;
  isAutoHostEnabled: boolean;
  onCopyAccessKey: () => void;
  onToggleAutoHost: () => void;
  onOpenSetPassword: () => void;
  onStartHosting: () => void;
  onStopHosting: () => void;
  isElectron: boolean;
  isAuthenticated: boolean;
  connectStep: 1 | 2;
  sessionCode: string;
  accessPassword: string;
  connectError: string | null;
  connectStatus: string;
  targetDeviceName: string | null;
  lockoutSeconds: number;
  onSessionCodeChange: (code: string) => void;
  onAccessPasswordChange: (pwd: string) => void;
  onFindDevice: () => void;
  onConnectToHost: () => void;
  onBackToStep1: () => void;
  onSignIn: () => void;
  formatCode: (code: string) => string;
  user?: any;
  isRegistered?: boolean;
}

export const SnowHome: React.FC<SnowHomeProps> = (props) => {
  const [copied, setCopied] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const formatAccessKey = (code: string) => {
    if (!code) return '';
    const c = code.replace(/[^0-9]/g, '');
    const grouped = c.match(/.{1,3}/g)?.join('-') || c;
    return grouped ? `RML-${grouped}` : '';
  };

  const handleCopy = () => {
    if (props.localAuthKey) {
      navigator.clipboard.writeText(props.localAuthKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-3xl overflow-hidden relative font-inter transition-all duration-500">
      <div className="flex-1 flex flex-col p-8 pt-4 overflow-y-auto custom-scrollbar bg-[#F8F9FA]/50">

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start max-w-6xl mx-auto w-full pt-4">

          {/* LEFT PANEL — "Your Machine" */}
          <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-10 flex flex-col shadow-sm h-full relative overflow-hidden group hover:border-[rgba(28,28,28,0.12)] transition-all duration-500">
            {/* Background Accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full -mr-16 -mt-16 group-hover:bg-blue-500/10 transition-colors" />

            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-center mb-10">
                <div className="flex flex-col gap-1">
                  <h2 className="text-[13px] font-black text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em]">Your Machine</h2>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${props.isRegistered || props.hostStatus === 'ready' || props.hostStatus === 'status' ? 'bg-[#71DD8C] shadow-[0_0_12px_rgba(113,221,140,0.6)]' : 'bg-red-400'} animate-pulse`} />
                    <span className="text-[11px] font-bold text-[#1C1C1C] uppercase tracking-wider">{props.isRegistered || props.hostStatus === 'ready' || props.hostStatus === 'status' ? 'Registered & Online' : 'Offline / Unregistered'}</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-[#1C1C1C] rounded-2xl flex items-center justify-center shadow-xl shadow-black/10">
                  <Monitor className="text-white w-6 h-6" />
                </div>
              </div>

              <div className="flex-grow flex flex-col justify-center py-4">
                <label className="text-[10px] font-black text-[rgba(28,28,28,0.2)] uppercase tracking-[0.3em] mb-4 text-center">Permanent Access Key</label>
                <div className="flex flex-col items-center gap-6">
                  <div className="text-4xl md:text-5xl font-mono font-black text-[#1C1C1C] tracking-tighter flex items-center gap-4 bg-[#F8F9FA] px-8 py-6 rounded-[28px] border border-[rgba(28,28,28,0.04)] shadow-inner">
                    {props.localAuthKey ? formatAccessKey(props.localAuthKey) : 'RML---- --- ---'}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#1C1C1C] text-white text-[11px] font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-black/10"
                  >
                    {copied ? <CheckCircle2 size={14} className="text-[#71DD8C]" /> : <Copy size={14} />}
                    {copied ? 'Copied!' : 'Copy Access Key'}
                  </button>
                </div>
              </div>

              <div className="mt-12 space-y-6 pt-8 border-t border-[rgba(28,28,28,0.04)]">
                {/* Password Setting */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-[rgba(28,28,28,0.3)] uppercase tracking-[0.2em] ml-1">Connection Password</label>
                  <div className="flex gap-2">
                    <div className="relative flex-grow group/input">
                      <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(28,28,28,0.2)] group-focus-within/input:text-[#1C1C1C] transition-colors">
                        <Lock size={16} />
                      </div>
                      <input
                        type={showPwd ? "text" : "password"}
                        placeholder="••••••••"
                        readOnly
                        value={props.devicePassword || ''}
                        className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-2xl pl-12 pr-12 py-4 text-sm font-medium focus:bg-white focus:border-[rgba(28,28,28,0.2)] outline-none transition-all shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPwd(!showPwd)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C]"
                      >
                        {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <button
                      onClick={() => props.onOpenSetPassword?.()}
                      className="px-6 py-4 bg-white border border-[rgba(28,28,28,0.06)] text-[#1C1C1C] rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:bg-[rgba(28,28,28,0.04)] active:scale-95 transition-all shadow-sm"
                    >
                      {props.devicePassword ? 'Set / Change' : 'Set / Change'}
                    </button>
                  </div>
                </div>

                {/* Unattended Access Toggle */}
                <div className="flex items-center justify-between p-5 rounded-2xl bg-[#F8F9FA] border border-[rgba(28,28,28,0.04)]">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-bold text-[#1C1C1C] uppercase tracking-wider">Unattended Mode</span>
                    <span className="text-[10px] font-medium text-[rgba(28,28,28,0.4)]">Allow connections without approval</span>
                  </div>
                  <button
                    onClick={() => props.onToggleAutoHost?.()}
                    className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ${props.isAutoHostEnabled ? 'bg-[#71DD8C]' : 'bg-[rgba(28,28,28,0.1)]'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${props.isAutoHostEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT PANEL — "Connect to Remote" */}
          <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-10 flex flex-col shadow-sm h-full relative overflow-hidden group hover:border-[rgba(28,28,28,0.12)] transition-all duration-500 min-h-[520px]">
            {/* Background Accent */}
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 blur-[60px] rounded-full -ml-16 -mb-16 group-hover:bg-blue-500/10 transition-colors" />

            <div className="relative z-10 flex flex-col h-full">
              <div className="flex justify-between items-center mb-10">
                <div className="flex flex-col gap-1">
                  <h2 className="text-[13px] font-black text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em]">Connect to Remote</h2>
                  <span className="text-[11px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Universal Link Node</span>
                </div>
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-600/20">
                  <Zap className="text-white w-6 h-6" />
                </div>
              </div>

              <div className="flex-grow flex flex-col items-center justify-center text-center gap-8 py-6">
                <div className="max-w-[280px]">
                  <h3 className="text-2xl font-black text-[#1C1C1C] tracking-tight mb-2">Establish Remote Link</h3>
                  <p className="text-sm font-medium text-[rgba(28,28,28,0.4)] leading-relaxed">Enter the machine access key provided by the host to establish a secure link.</p>
                </div>

                {props.connectStep === 1 ? (
                  <div className="w-full space-y-4 animate-in fade-in duration-300">
                    <div className="relative group/input">
                      <div className="absolute inset-y-0 left-6 flex items-center text-[rgba(28,28,28,0.2)] group-focus-within/input:text-blue-600 transition-colors">
                        <Globe size={20} />
                      </div>
                      <input
                        type="text"
                        placeholder="RML-482-910-374"
                        value={props.sessionCode || ''}
                        onChange={(e) => props.onSessionCodeChange?.(props.formatCode(e.target.value))}
                        onKeyDown={(e) => { if (e.key === 'Enter') props.onFindDevice?.(); }}
                        className="w-full bg-[#F8F9FA] border-2 border-[rgba(28,28,28,0.04)] text-[#1C1C1C] rounded-[24px] pl-16 pr-6 py-6 text-xl font-mono font-black tracking-widest focus:bg-white focus:border-blue-600/40 outline-none transition-all shadow-sm placeholder:text-[rgba(28,28,28,0.1)] placeholder:text-lg uppercase"
                        maxLength={20}
                      />
                    </div>

                    {props.connectError && (
                      <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in duration-200">
                        <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                        <p className="text-[11px] font-semibold text-red-600 leading-relaxed text-left">{props.connectError}</p>
                      </div>
                    )}

                    <button
                      onClick={() => props.onFindDevice?.()}
                      disabled={!props.sessionCode || props.sessionCode.replace(/\s/g, '').length < 9 || props.connectStatus === 'connecting'}
                      className="w-full py-6 bg-[#1C1C1C] text-white rounded-[24px] text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-black/20 hover:opacity-95 hover:scale-[1.01] active:scale-[0.98] disabled:opacity-30 disabled:scale-100 disabled:shadow-none transition-all flex items-center justify-center gap-4 group"
                    >
                      {props.connectStatus === 'connecting' ? <Clock className="animate-spin" size={20} /> : 'Connect'}
                      <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-[11px] font-bold text-[rgba(28,28,28,0.35)] uppercase tracking-widest">Machine found. Enter password to continue.</div>
                  </div>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-[rgba(28,28,28,0.04)] flex flex-col items-center">
                {!props.isAuthenticated ? (
                  <div className="flex flex-col items-center gap-4 w-full">
                    <p className="text-xs font-semibold text-[rgba(28,28,28,0.4)]">Have an account? Sign in to see your saved devices.</p>
                    <button
                      onClick={() => props.onSignIn?.()}
                      className="text-[11px] font-black text-blue-600 uppercase tracking-[0.2em] hover:opacity-80 transition-opacity flex items-center gap-2 group"
                    >
                      Sign in
                      <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-6 py-4 rounded-2xl bg-blue-50/50 border border-blue-100/50">
                    <ShieldCheck className="text-blue-500 w-5 h-5" />
                    <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Authenticated Secure Link</span>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {props.connectStep === 2 && (
          <div className="fixed inset-0 z-[80] bg-black/20 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="w-full max-w-md bg-white rounded-[28px] border border-[rgba(28,28,28,0.08)] shadow-2xl p-6 space-y-4">
              <div className="space-y-1">
                <h3 className="text-xl font-black text-[#1C1C1C] tracking-tight">
                  Enter password for {formatAccessKey(props.sessionCode)}
                </h3>
                <p className="text-xs font-medium text-[rgba(28,28,28,0.45)]">
                  {props.targetDeviceName || 'Remote machine'}
                </p>
              </div>

              <div className="relative">
                <input
                  autoFocus
                  type={showPwd ? "text" : "password"}
                  placeholder="Enter password"
                  className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.08)] text-[#1C1C1C] rounded-2xl pl-4 pr-12 py-3.5 text-sm font-medium focus:bg-white focus:border-blue-600/40 outline-none transition-all"
                  value={props.accessPassword}
                  onChange={(e) => props.onAccessPasswordChange?.(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') props.onConnectToHost?.(); }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C]"
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {props.lockoutSeconds > 0 ? (
                <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
                  <Clock size={16} className="text-red-500" />
                  <p className="text-[11px] font-semibold text-red-600">Locked for {props.lockoutSeconds}s after multiple failed attempts.</p>
                </div>
              ) : props.connectError ? (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] font-semibold text-red-600 leading-relaxed">{props.connectError}</p>
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  onClick={() => props.onBackToStep1?.()}
                  className="flex-1 py-3.5 rounded-2xl border border-[rgba(28,28,28,0.08)] text-[11px] font-bold uppercase tracking-widest hover:bg-[rgba(28,28,28,0.04)] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={() => props.onConnectToHost?.()}
                  disabled={!props.accessPassword || props.lockoutSeconds > 0 || props.connectStatus === 'connecting'}
                  className="flex-1 py-3.5 bg-[#1C1C1C] text-white rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] disabled:opacity-30 transition-all flex items-center justify-center gap-2"
                >
                  {props.connectStatus === 'connecting' ? <Clock className="animate-spin" size={16} /> : <Zap size={14} />}
                  Connect
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
