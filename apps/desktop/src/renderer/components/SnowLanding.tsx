import React, { useState } from 'react';
import { Monitor, KeyRound, ArrowRight, Shield, RefreshCw, Zap, Settings, Globe, Plus, LogIn, UserPlus } from 'lucide-react';
import logo from '../assets/logo.png';

interface SnowLandingProps {
  localAuthKey: string | null;
  devicePassword: string;
  onSignIn: () => void;
  onSignUp: () => void;
  onFindDevice: () => void;
  sessionCode: string;
  onSessionCodeChange: (code: string) => void;
  formatCode: (code: string) => string;
  connectStatus: string;
  connectError: string | null;
}

export const SnowLanding: React.FC<SnowLandingProps> = ({
  localAuthKey,
  devicePassword,
  onSignIn,
  onSignUp,
  onFindDevice,
  sessionCode,
  onSessionCodeChange,
  formatCode,
  connectStatus,
  connectError
}) => {
  const [showPwd, setShowPwd] = useState(false);

  const fmt = (code: string) => {
    if (!code) return '--- --- ---';
    const c = code.replace(/\D/g, '');
    return (c.match(/.{1,3}/g) || [c]).join(' ');
  };

  return (
    <div className="flex h-full w-full overflow-hidden font-inter select-none">
      {/* Left side: Hero/Blue Section */}
      <div className="w-1/2 bg-gradient-to-br from-[#00193F] via-[#0033CC] to-[#00193F] flex flex-col items-center justify-center p-12 text-white relative">
        <div className="absolute top-8 left-8 flex items-center gap-3">
          <img src={logo} className="w-8 h-8 object-contain" alt="" />
          <span className="text-xl font-bold tracking-tight">Remote 365</span>
        </div>

        <div className="max-w-md text-center space-y-8 animate-in fade-in slide-in-from-left-8 duration-700">
          <h1 className="text-5xl font-extrabold tracking-tight leading-tight">
            Access and support from anywhere
          </h1>
          
          <div className="space-y-4">
            <button 
              onClick={onSignIn}
              className="px-8 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full font-bold text-sm transition-all backdrop-blur-sm"
            >
              Sign in to Remote 365
            </button>
            <p className="text-sm text-white/60">
              Don't have an account? <button onClick={onSignUp} className="text-white hover:underline font-semibold">Create one here</button>
            </p>
          </div>
        </div>

        {/* Subtle decorative elements */}
        <div className="absolute bottom-12 left-12 flex gap-4 opacity-30">
          <Shield size={20} />
          <Globe size={20} />
          <Zap size={20} />
        </div>
      </div>

      {/* Right side: Connection Section */}
      <div className="w-1/2 bg-white flex flex-col items-center justify-center p-12 relative">
        <button className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition-colors">
          <Settings size={20} />
        </button>

        <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-right-8 duration-700">
          <div className="text-center space-y-1">
            <p className="text-[13px] text-gray-500 font-medium">Share your ID and password with the supporter.</p>
          </div>

          {/* ID & Password Card */}
          <div className="bg-[#F8F9FA] rounded-2xl border border-gray-100 p-6 space-y-6 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Your ID</p>
                <p className="text-2xl font-bold text-gray-800 tracking-wider">
                  {fmt(localAuthKey || '')}
                </p>
              </div>
              <Monitor className="text-gray-300 mt-1" size={24} />
            </div>

            <div className="flex justify-between items-start">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-1">Password</p>
                <p className="text-lg font-bold text-gray-800 tracking-widest">
                  {showPwd ? (devicePassword || '--------') : '••••••••'}
                </p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setShowPwd(!showPwd)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <RefreshCw size={16} />
                </button>
                <KeyRound className="text-gray-300 mt-2" size={20} />
              </div>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-100"></div></div>
            <span className="relative z-10 bg-white px-3 text-[11px] text-gray-400 uppercase tracking-widest font-bold">Or</span>
          </div>

          {/* Remote Control Input */}
          <div className="space-y-4">
            <p className="text-[13px] text-center text-gray-500 font-medium">Enter the session code provided by the supporter.</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <p className="absolute -top-2.5 left-3 px-1 bg-white text-[10px] font-bold text-gray-400 uppercase tracking-tighter z-10">Session Code</p>
                <input 
                  type="text"
                  placeholder="(e.g. 123 456 789)"
                  value={sessionCode}
                  onChange={(e) => onSessionCodeChange(formatCode(e.target.value))}
                  onKeyDown={(e) => { if (e.key === 'Enter') onFindDevice(); }}
                  className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:border-blue-600 outline-none transition-all placeholder:text-gray-300"
                />
              </div>
              <button 
                onClick={onFindDevice}
                disabled={!sessionCode || sessionCode.replace(/\s/g, '').length < 9 || connectStatus === 'connecting'}
                className="px-6 bg-[#F8F9FA] hover:bg-[#F0F2F5] text-[#A0A0A0] hover:text-[#1D6DF5] disabled:opacity-50 disabled:cursor-not-allowed border border-gray-100 rounded-lg text-sm font-bold transition-all flex items-center justify-center"
              >
                {connectStatus === 'connecting' ? <RefreshCw size={16} className="animate-spin" /> : 'Join session'}
              </button>
            </div>
            
            {connectError && (
              <p className="text-center text-[12px] text-red-500 font-medium">{connectError}</p>
            )}

            <div className="pt-4 space-y-3">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-[12px] text-gray-500 group-hover:text-gray-700 transition-colors">Start RemoteLink with Windows</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-[12px] text-gray-500 group-hover:text-gray-700 transition-colors">Grant Easy Access to this device</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
