import React, { useState } from 'react';
import { Monitor, Copy, CheckCircle2, Lock, Eye, EyeOff, ArrowRight, Zap, Globe, AlertTriangle, Clock, ShieldCheck, Settings, User, RefreshCw } from 'lucide-react';
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
  onOpenSettings: () => void;
  formatCode: (code: string) => string;
  user?: any;
  isRegistered?: boolean;
}

export const SnowHome: React.FC<SnowHomeProps> = (props) => {
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPwd, setCopiedPwd] = useState(false);
  const [showPwd, setShowPwd] = useState(false);

  const formatAccessKey = (code: string) => {
    if (!code) return '--- --- ---';
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
    <div className="flex h-screen w-full bg-white overflow-hidden font-['Lato'] select-none">
      
      {/* LEFT PANEL — Branding & Info */}
      <div className="hidden lg:flex w-[45%] bg-gradient-to-br from-[#06113C] via-[#0A1A5E] to-[#1236A3] relative flex-col p-12 text-white overflow-hidden">
        {/* Glow blobs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-400/10 blur-[120px] rounded-full -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/10 blur-[100px] rounded-full -ml-32 -mb-32 pointer-events-none" />
        
        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <img src={logo} className="w-8 h-8 object-contain" alt="Remote 365" />
          <span className="text-2xl font-bold tracking-tight">Remote 365</span>
        </div>

        {/* Center Content */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center max-w-sm mx-auto">
          <h1 className="text-4xl font-bold mb-10 leading-tight">
            Access and support from anywhere
          </h1>
          
          <button 
            onClick={props.onSignIn}
            className="px-8 py-3 bg-transparent border border-white rounded-md font-bold text-sm hover:bg-white/10 transition-all mb-4"
          >
            Sign in to Remote 365
          </button>
          
          <p className="text-xs font-medium text-white/80">
            Don't have an account? <span className="text-white font-bold cursor-pointer hover:underline" onClick={props.onSignIn}>Create one here</span>
          </p>
        </div>
      </div>

      {/* RIGHT PANEL — Interaction */}
      <div className="flex-1 bg-white relative flex flex-col overflow-hidden">
        
        {/* Top Right Gear */}
        <div className="absolute top-8 right-8 flex items-center gap-4 text-[rgba(28,28,28,0.6)]">
          <button onClick={props.onOpenSettings} className="hover:text-[#1C1C1C] transition-colors"><Settings size={20} /></button>
        </div>

        <div className="max-w-md w-full mx-auto my-auto space-y-8 px-8">
          
          {/* Share ID Section */}
          <div className="space-y-6">
            <p className="text-xs font-bold text-[rgba(28,28,28,0.6)] text-center">Share your ID and password with the supporter.</p>
            
            <div className="bg-[#F8F9FA] rounded-2xl border border-[rgba(28,28,28,0.06)] p-6 space-y-6 shadow-sm">
              <div className="space-y-1 relative">
                <label className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Your ID</label>
                <div className="flex items-center justify-between">
                  <div className="text-2xl font-bold text-[#1C1C1C] tracking-widest">
                    {formatAccessKey(props.localAuthKey || '')}
                  </div>
                  <button 
                    onClick={handleCopyId}
                    className="p-1.5 text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-all border border-[rgba(28,28,28,0.1)] rounded-md"
                  >
                    {copiedId ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1 relative pt-4 border-t border-[rgba(28,28,28,0.06)]">
                <label className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Password</label>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-[#1C1C1C] tracking-widest">
                    {showPwd ? (props.devicePassword || '--- --- ---') : '••••••••'}
                  </div>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => setShowPwd(!showPwd)}
                      className="p-1.5 text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-all"
                      title={showPwd ? "Hide Password" : "Show Password"}
                    >
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button 
                      onClick={() => props.onOpenSetPassword()}
                      className="p-1.5 text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-all"
                      title="Generate New Password"
                    >
                      <RefreshCw size={16} />
                    </button>
                    <button 
                      onClick={handleCopyPwd}
                      className="p-1.5 text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-all border border-[rgba(28,28,28,0.1)] rounded-md ml-1"
                      title="Copy Password"
                    >
                      {copiedPwd ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute w-full h-px bg-[rgba(28,28,28,0.06)]" />
            <span className="relative px-4 bg-white text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Or</span>
          </div>

          {/* Connect Section */}
          <div className="space-y-6">
            <p className="text-xs font-bold text-[rgba(28,28,28,0.6)] text-center">Enter the session code provided by the supporter.</p>
            
            <div className="flex flex-col gap-4">
              <div className="relative group/input">
                <div className="absolute top-0 left-4 -translate-y-1/2 px-2 bg-white text-[9px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest group-focus-within/input:text-blue-600 transition-colors">Session Code</div>
                <div className="flex gap-2">
                  <input 
                    type="text"
                    placeholder="(e.g. 123 456 789)"
                    value={props.sessionCode || ''}
                    onChange={(e) => props.onSessionCodeChange?.(props.formatCode(e.target.value))}
                    onKeyDown={(e) => { if (e.key === 'Enter') props.onFindDevice?.(); }}
                    className="flex-1 bg-white border border-[rgba(28,28,28,0.2)] text-[#1C1C1C] rounded-md px-4 py-3 text-sm font-bold focus:border-blue-600 outline-none transition-all placeholder:text-[rgba(28,28,28,0.3)]"
                  />
                  <button 
                    onClick={props.onFindDevice}
                    disabled={!props.sessionCode || props.sessionCode.replace(/\s/g, '').length < 9 || props.connectStatus === 'connecting'}
                    className="px-6 py-3 bg-[rgba(28,28,28,0.04)] text-[rgba(28,28,28,0.4)] rounded-md text-xs font-bold hover:bg-[rgba(28,28,28,0.08)] disabled:opacity-50 transition-all border border-[rgba(28,28,28,0.08)]"
                  >
                    {props.connectStatus === 'connecting' ? <Clock className="animate-spin" size={14} /> : 'Join session'}
                  </button>
                </div>
              </div>

              {props.connectError && (
                <div className="flex items-start gap-2 px-4 py-2 bg-red-50 border border-red-100 rounded-md">
                  <AlertTriangle size={12} className="text-red-500 mt-0.5" />
                  <p className="text-[10px] font-bold text-red-600 leading-tight">{props.connectError}</p>
                </div>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-2 pt-4">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0 cursor-pointer"
                checked={props.isAutoHostEnabled} 
                onChange={() => props.onToggleAutoHost()} 
              />
              <span className="text-[11px] font-medium text-[#1C1C1C] transition-colors">Start Remote 365 with Windows</span>
              <div className="w-3.5 h-3.5 rounded-full border border-[rgba(28,28,28,0.2)] flex items-center justify-center text-[8px] font-bold text-[rgba(28,28,28,0.4)]">?</div>
            </label>
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <input 
                type="checkbox" 
                className="w-4 h-4 rounded border-[rgba(28,28,28,0.2)] text-blue-600 focus:ring-0 cursor-pointer"
              />
              <span className="text-[11px] font-medium text-[#1C1C1C] transition-colors">Grant Easy Access to this device</span>
              <div className="w-3.5 h-3.5 rounded-full border border-[rgba(28,28,28,0.2)] flex items-center justify-center text-[8px] font-bold text-[rgba(28,28,28,0.4)]">?</div>
            </label>
          </div>
        </div>

        {/* Footer Status Bar */}
        <div className="mt-auto border-t border-[rgba(28,28,28,0.06)] px-8 py-3 bg-[#F8F9FA]/50 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[10px] font-bold text-[rgba(28,28,28,0.6)]">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" />
            Ready to connect (secure connection)
          </div>
          <div className="text-[10px] font-bold text-[rgba(28,28,28,0.3)]">v1.0.4</div>
        </div>
      </div>

      {/* Password Modal Step 2 */}
      {props.connectStep === 2 && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-[rgba(28,28,28,0.1)] shadow-2xl p-8 space-y-6 animate-in zoom-in-95 duration-300">
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-[#1C1C1C] tracking-tight">
                Enter password
              </h3>
              <p className="text-[11px] font-bold text-[rgba(28,28,28,0.4)]">
                Required for {props.targetDeviceName || props.sessionCode}
              </p>
            </div>

            <div className="relative group/input">
              <div className="absolute inset-y-0 left-4 flex items-center text-[rgba(28,28,28,0.4)] group-focus-within/input:text-blue-600 transition-all">
                <Lock size={18} />
              </div>
              <input
                autoFocus
                type={showPwd ? "text" : "password"}
                placeholder="Device password"
                className="w-full bg-[#F8F9FA] border border-[rgba(28,28,28,0.15)] text-[#1C1C1C] rounded-lg pl-12 pr-10 py-3.5 text-sm font-bold focus:bg-white focus:border-blue-600 outline-none transition-all placeholder:text-[rgba(28,28,28,0.3)]"
                value={props.accessPassword}
                onChange={(e) => props.onAccessPasswordChange?.(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') props.onConnectToHost?.(); }}
              />
              <button
                type="button"
                onClick={() => setShowPwd(!showPwd)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C]"
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => props.onBackToStep1?.()}
                className="flex-1 py-3 rounded-lg border border-[rgba(28,28,28,0.15)] text-[10px] font-bold uppercase tracking-widest hover:bg-[rgba(28,28,28,0.04)] transition-colors text-[#1C1C1C]"
              >
                Back
              </button>
              <button
                onClick={() => props.onConnectToHost?.()}
                disabled={!props.accessPassword || props.lockoutSeconds > 0 || props.connectStatus === 'connecting'}
                className="flex-1 py-3 bg-[#1C1C1C] text-white rounded-lg text-[10px] font-bold uppercase tracking-widest disabled:opacity-90 transition-all flex items-center justify-center gap-2"
              >
                {props.connectStatus === 'connecting' ? <Clock className="animate-spin" size={14} /> : <Zap size={14} />}
                Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
