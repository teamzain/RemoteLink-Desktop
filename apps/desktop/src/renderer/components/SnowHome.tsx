import React, { useState } from 'react';
import { Monitor, Copy, CheckCircle2, Lock, Eye, EyeOff, ArrowRight, Zap, Globe, AlertTriangle, Clock, ShieldCheck, Settings, User } from 'lucide-react';
import logo from '../assets/logo.png';

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
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const formatAccessKey = (code: string) => {
    if (!code) return '';
    const c = code.replace(/[^0-9]/g, '');
    const grouped = c.match(/.{1,3}/g)?.join(' ') || c;
    return grouped;
  };

  const handleCopyId = () => {
    if (props.localAuthKey) {
      navigator.clipboard.writeText(props.localAuthKey);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleCopyPwd = () => {
    if (props.devicePassword) {
      navigator.clipboard.writeText(props.devicePassword);
      setCopiedPwd(true);
      setTimeout(() => setCopiedPwd(false), 2000);
    }
  };

  return (
    <div className="flex h-screen w-full bg-white overflow-hidden font-inter select-none">
      
      {/* LEFT PANEL — Branding & Info */}
      <div className="hidden lg:flex w-[45%] bg-gradient-to-br from-[#06113C] via-[#0A1A5E] to-[#1236A3] relative flex-col p-12 text-white overflow-hidden">
        {/* Glow blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/10 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full -ml-32 -mb-32 pointer-events-none" />
        
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3 mb-auto">
          <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10">
            <img src={logo} className="w-7 h-7 object-contain" alt="RemoteLink" />
          </div>
          <span className="text-xl font-black tracking-tighter">RemoteLink</span>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-sm mx-auto mb-auto">
          <h1 className="text-5xl font-black tracking-tight mb-8 leading-[1.1]">
            Access and support from anywhere
          </h1>
          
          <button 
            onClick={props.onSignIn}
            className="px-10 py-4 bg-white text-[#0A1A5E] rounded-xl font-bold text-sm shadow-2xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all mb-4"
          >
            Sign in to RemoteLink
          </button>
          
          <p className="text-xs font-medium text-white">
            Don't have an account? <span className="text-white font-bold cursor-pointer hover:underline" onClick={props.onSignIn}>Create one here</span>
          </p>
        </div>

        {/* Footer Status */}
        <div className="relative z-10 flex items-center gap-2 text-[10px] font-black text-white uppercase tracking-widest mt-auto">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse" />
          Ready to connect (secure connection)
        </div>
      </div>

      {/* RIGHT PANEL — Interaction */}
      <div className="flex-1 bg-white relative flex flex-col p-12 overflow-y-auto custom-scrollbar">
        
        {/* Top Right Actions */}
        <div className="absolute top-8 right-8 flex items-center gap-4 text-[#1C1C1C]">
          <button className="hover:opacity-100 transition-opacity"><Settings size={20} /></button>
        </div>

        <div className="max-w-md w-full mx-auto my-auto space-y-12">
          
          {/* Share ID Section */}
          <div className="space-y-6">
            <p className="text-xs font-bold text-[#1C1C1C] text-center">Share your ID and password with the supporter.</p>
            
            <div className="bg-[#F8F9FA] rounded-3xl border border-[rgba(28,28,28,0.12)] p-8 space-y-8 shadow-sm">
              <div className="space-y-2 relative">
                <label className="text-[10px] font-black text-[#1C1C1C] opacity-100 uppercase tracking-widest">Your ID</label>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-mono font-black text-[#1C1C1C] tracking-widest">
                    {props.localAuthKey ? formatAccessKey(props.localAuthKey) : '--- --- ---'}
                  </div>
                  <button 
                    onClick={handleCopyId}
                    className="p-2 text-[#1C1C1C] hover:opacity-100 transition-all"
                  >
                    {copiedId ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Monitor size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 relative pt-8 border-t border-[rgba(28,28,28,0.08)]">
                <label className="text-[10px] font-black text-[#1C1C1C] opacity-100 uppercase tracking-widest">Password</label>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-mono font-bold text-[#1C1C1C] tracking-widest">
                    {props.devicePassword || '••••••••'}
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => props.onOpenSetPassword()}
                      className="p-2 text-[#1C1C1C] hover:opacity-100 transition-all"
                    >
                      <Settings size={18} />
                    </button>
                    <button 
                      onClick={handleCopyPwd}
                      className="p-2 text-[#1C1C1C] hover:opacity-100 transition-all"
                    >
                      {copiedPwd ? <CheckCircle2 size={18} className="text-emerald-500" /> : <Monitor size={18} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute w-full h-px bg-[rgba(28,28,28,0.1)]" />
            <span className="relative px-4 bg-white text-[10px] font-black text-[#1C1C1C] uppercase tracking-[0.3em]">Or</span>
          </div>

          {/* Connect Section */}
          <div className="space-y-8">
            <p className="text-xs font-bold text-[#1C1C1C] text-center">Enter the session code provided by the supporter.</p>
            
            <div className="space-y-4">
              <div className="relative group/input">
                <div className="absolute top-0 left-4 -translate-y-1/2 px-2 bg-white text-[9px] font-black text-[#1C1C1C] uppercase tracking-widest group-focus-within/input:text-blue-600 transition-colors">Session Code</div>
                <input 
                  type="text"
                  placeholder="(e.g. 123 456 789)"
                  value={props.sessionCode || ''}
                  onChange={(e) => props.onSessionCodeChange?.(props.formatCode(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter') props.onFindDevice?.(); }}
                  className="w-full bg-white border border-[rgba(28,28,28,0.2)] text-[#1C1C1C] rounded-2xl px-6 py-5 text-xl font-mono font-black tracking-widest focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all placeholder:text-[rgba(28,28,28,0.3)] placeholder:text-lg"
                />
              </div>

              {props.connectError && (
                <div className="flex items-start gap-2.5 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in duration-200">
                  <AlertTriangle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] font-bold text-red-600 leading-relaxed text-left">{props.connectError}</p>
                </div>
              )}

              <button 
                onClick={props.onFindDevice}
                disabled={!props.sessionCode || props.sessionCode.replace(/\s/g, '').length < 9 || props.connectStatus === 'connecting'}
                className="w-full py-5 bg-[#1C1C1C] text-white rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-black disabled:opacity-90 disabled:scale-100 transition-all flex items-center justify-center gap-3 shadow-xl shadow-black/10"
              >
                {props.connectStatus === 'connecting' ? <Clock className="animate-spin" size={18} /> : 'Join session'}
              </button>
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3 pt-4">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${props.isAutoHostEnabled ? 'bg-[#1C1C1C] border-[#1C1C1C]' : 'border-[rgba(28,28,28,0.2)] group-hover:border-[#1C1C1C]'}`}>
                {props.isAutoHostEnabled && <CheckCircle2 size={12} className="text-white" />}
              </div>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={props.isAutoHostEnabled} 
                onChange={() => props.onToggleAutoHost()} 
              />
              <span className="text-xs font-black text-[#1C1C1C] transition-colors">Start RemoteLink with Windows</span>
              <div className="w-3.5 h-3.5 rounded-full border border-[#1C1C1C] flex items-center justify-center text-[8px] font-black text-[#1C1C1C]">?</div>
            </label>
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="w-5 h-5 rounded-md border-2 border-[rgba(28,28,28,0.2)] group-hover:border-[#1C1C1C] flex items-center justify-center transition-all">
              </div>
              <span className="text-xs font-black text-[#1C1C1C] transition-colors">Grant Easy Access to this device</span>
              <div className="w-3.5 h-3.5 rounded-full border border-[#1C1C1C] flex items-center justify-center text-[8px] font-black text-[#1C1C1C]">?</div>
            </label>
          </div>
        </div>
      </div>

      {/* Password Modal Step 2 */}
      {props.connectStep === 2 && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-white rounded-[32px] border border-[rgba(28,28,28,0.1)] shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="space-y-1">
              <h3 className="text-2xl font-black text-[#1C1C1C] tracking-tight">
                Enter password
              </h3>
              <p className="text-xs font-bold text-[#1C1C1C] opacity-100">
                Required for {props.targetDeviceName || props.sessionCode}
              </p>
            </div>

            <div className="relative group/input">
              <div className="absolute inset-y-0 left-5 flex items-center text-[#1C1C1C] opacity-100 group-focus-within/input:text-blue-600 group-focus-within/input:opacity-100 transition-all">
                <Lock size={20} />
              </div>
              <input
                autoFocus
                type={showPwd ? "text" : "password"}
                placeholder="Device password"
                className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.15)] text-[#1C1C1C] rounded-2xl pl-14 pr-12 py-5 text-lg font-bold focus:bg-white focus:border-blue-600 outline-none transition-all placeholder:text-[rgba(28,28,28,0.3)]"
                value={props.accessPassword}
                onChange={(e) => props.onAccessPasswordChange?.(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') props.onConnectToHost?.(); }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-5 top-1/2 -translate-y-1/2 text-[#1C1C1C] opacity-100 hover:opacity-100"
              >
                {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {props.lockoutSeconds > 0 && (
              <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-2xl">
                <Clock size={16} className="text-red-500" />
                <p className="text-[11px] font-bold text-red-600">Locked for {props.lockoutSeconds}s after multiple failed attempts.</p>
              </div>
            )}

            <div className="flex gap-4">
              <button
                onClick={() => props.onBackToStep1?.()}
                className="flex-1 py-4 rounded-2xl border border-[rgba(28,28,28,0.15)] text-[11px] font-black uppercase tracking-widest hover:bg-[rgba(28,28,28,0.04)] transition-colors text-[#1C1C1C]"
              >
                Back
              </button>
              <button
                onClick={() => props.onConnectToHost?.()}
                disabled={!props.accessPassword || props.lockoutSeconds > 0 || props.connectStatus === 'connecting'}
                className="flex-1 py-4 bg-[#1C1C1C] text-white rounded-2xl text-[11px] font-black uppercase tracking-widest disabled:opacity-90 transition-all flex items-center justify-center gap-3"
              >
                {props.connectStatus === 'connecting' ? <Clock className="animate-spin" size={18} /> : <Zap size={16} />}
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
