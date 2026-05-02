import React from 'react';
import { Home, Headphones, Monitor, MessageSquare, Settings, HelpCircle, MessageCircle, MoreHorizontal, ChevronRight, Eye, EyeOff, RefreshCw, Plus, Radio, Globe, Copy, Zap, ArrowRight, ShieldCheck, User } from 'lucide-react';

interface SnowPremiumDashboardProps {
  user: any;
  localAuthKey: string | null;
  devicePassword: string;
  onNavigate: (view: any) => void;
  onConnect: () => void;
  onOpenSetPassword: () => void;
  formatCode: (code: string) => string;
}

export const SnowPremiumDashboard: React.FC<SnowPremiumDashboardProps> = ({ user, localAuthKey, devicePassword, onNavigate, onConnect, onOpenSetPassword, formatCode }) => {
  const [showPwd, setShowPwd] = React.useState(false);
  const [partnerId, setPartnerId] = React.useState('');

  const userName = user?.name?.split(' ')[0] || 'User';

  return (
    <div className="h-full w-full flex flex-col p-8 bg-[#F4F7F9] font-sans overflow-hidden rounded-bl-[24px]">
      {/* Top Title Row */}
      <div className="flex items-center gap-2 mb-6 flex-shrink-0">
        <h1 className="text-[28px] font-normal text-[#1C1C1C]">Hi {userName}</h1>
      </div>

      {/* Top Cards Row - Takes up remaining flexible space */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 flex-1 min-h-0">
        {/* Getting Started Card */}
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm flex flex-col h-full overflow-y-auto custom-scrollbar">
          <h2 className="text-xl font-medium text-[#1C1C1C] mb-1">Getting started</h2>
          <p className="text-sm text-[#757575] mb-6">0 of 3 tasks completed</p>

          <div className="space-y-5">
            <div className="flex items-center gap-5 group cursor-pointer">
              <div className="w-8 h-8 rounded-full border-2 border-[#D1D1D1] flex items-center justify-center group-hover:border-blue-500 transition-colors shrink-0" />
              <span className="text-base text-[#1C1C1C] font-normal group-hover:text-blue-600">Upload your photo</span>
            </div>
            <div className="flex items-center gap-5 group cursor-pointer">
              <div className="w-8 h-8 rounded-full border-2 border-[#D1D1D1] flex items-center justify-center group-hover:border-blue-500 transition-colors shrink-0" />
              <span className="text-base text-[#1C1C1C] font-normal group-hover:text-blue-600">Add your first contact</span>
            </div>
            <div className="flex items-center gap-5 group cursor-pointer">
              <div className="w-8 h-8 rounded-full border-2 border-[#D1D1D1] flex items-center justify-center group-hover:border-blue-500 transition-colors shrink-0" />
              <span className="text-base text-[#1C1C1C] font-normal group-hover:text-blue-600">Set up remote access on this device</span>
            </div>
          </div>
        </div>

        {/* Connect with ID Card */}
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm flex flex-col h-full overflow-y-auto custom-scrollbar">
          <h2 className="text-xl font-medium text-[#1C1C1C] mb-2">Connect with ID</h2>
          <p className="text-sm text-[#757575] mb-6">Your ID and password to share with the supporter.</p>

          <div className="bg-[#F8F9FA] rounded-lg border border-[rgba(0,0,0,0.06)] flex items-stretch mb-6 h-16 shrink-0">
            <div className="flex-1 px-5 flex flex-col justify-center border-r border-[rgba(0,0,0,0.06)]">
              <label className="text-[10px] font-bold text-[#757575] uppercase mb-1">Your ID</label>
              <div className="flex items-center justify-between">
                <span className="text-lg font-normal text-[#1C1C1C] tracking-tight">{formatCode(localAuthKey || '')}</span>
                <button className="text-[#757575] hover:text-[#1C1C1C]"><Copy size={16} /></button>
              </div>
            </div>
            <div className="flex-1 px-5 flex flex-col justify-center relative">
              <label className="text-[10px] font-bold text-[#757575] uppercase mb-1">Password</label>
              <div className="flex items-center justify-between">
                <span className="text-lg font-normal text-[#1C1C1C]">{showPwd ? (devicePassword || '---') : '••••••••'}</span>
                <div className="flex items-center gap-2 text-[#757575]">
                  <button onClick={() => setShowPwd(!showPwd)} className="hover:text-blue-600"><Eye size={16} /></button>
                  <button onClick={onOpenSetPassword} className="hover:text-blue-600"><RefreshCw size={16} /></button>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-auto shrink-0">
            <p className="text-sm text-[#757575] mb-4">Connect via ID to remotely access and control a device.</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder="Partner ID"
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  className="w-full h-11 px-4 bg-white border border-[#D1D1D1] rounded-lg text-sm focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <button 
                onClick={onConnect}
                disabled={!partnerId}
                className="h-11 px-6 bg-white border border-[#D1D1D1] text-[#1C1C1C] rounded-lg text-sm font-medium hover:bg-[#F8F9FA] active:bg-[#EAECEF] disabled:opacity-50 transition-all shrink-0"
              >
                Connect
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Remote actions row - Fixed Height */}
      <div className="flex-shrink-0">
        <h3 className="text-base font-medium text-[#1C1C1C] mb-4">Remote actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm group cursor-pointer hover:border-blue-300 transition-all h-48 flex flex-col">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white mb-4 shrink-0">
              <Plus size={20} />
            </div>
            <h3 className="text-base font-medium text-[#1C1C1C] mb-2">Create a session</h3>
            <p className="text-xs text-[#757575] leading-relaxed line-clamp-2">Share the session link and code with the end user.</p>
          </div>

          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm group cursor-pointer hover:border-blue-300 transition-all h-48 flex flex-col">
            <div className="w-10 h-10 bg-[#001F3F] rounded-lg flex items-center justify-center text-white mb-4 shrink-0">
              <Radio size={20} />
            </div>
            <h3 className="text-base font-medium text-[#1C1C1C] mb-2">Join a session</h3>
            <p className="text-xs text-[#757575] leading-relaxed line-clamp-2">Enter the session code provided by your supporter.</p>
          </div>

          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm group cursor-pointer hover:border-blue-300 transition-all h-48 flex flex-col">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white mb-4 shrink-0">
              <Monitor size={20} />
            </div>
            <h3 className="text-base font-medium text-[#1C1C1C] mb-2">Set up remote access</h3>
            <p className="text-xs text-[#757575] leading-relaxed line-clamp-2">Install Remote 365 on another machine to access it anytime.</p>
          </div>

          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm group cursor-pointer hover:border-blue-300 transition-all h-48 flex flex-col">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white mb-4 shrink-0">
              <Globe size={20} />
            </div>
            <h3 className="text-base font-medium text-[#1C1C1C] mb-2">Web access</h3>
            <p className="text-xs text-[#757575] leading-relaxed line-clamp-2">Connect to any device from your browser.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
