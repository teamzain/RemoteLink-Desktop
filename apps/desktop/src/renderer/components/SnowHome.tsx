import React, { useState } from 'react';
import {
  Monitor, Copy, CheckCircle2, Lock, Eye, EyeOff, RefreshCw,
  Home, Laptop, MessageSquare, Settings, MoreHorizontal, HelpCircle,
  Search, ChevronRight, ChevronLeft, Plus, Clock, AlertTriangle,
  Wifi, Globe, Bell,
} from 'lucide-react';
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
  onSignUp: () => void;
  onOpenSettings: () => void;
  formatCode: (code: string) => string;
  user?: any;
  isRegistered?: boolean;
}

const NAV = [
  { id: 'home',    icon: Home,           label: 'Home' },
  { id: 'remote',  icon: Monitor,        label: 'Remote Support' },
  { id: 'devices', icon: Laptop,         label: 'Devices',       arrow: true },
  { id: 'chat',    icon: MessageSquare,  label: 'Chat' },
  { id: 'more',    icon: MoreHorizontal, label: 'More solutions', arrow: true },
];

const BOTTOM_NAV = [
  { id: 'admin',    icon: Settings,      label: 'Admin settings' },
  { id: 'feedback', icon: MessageSquare, label: 'Feedback' },
  { id: 'help',     icon: HelpCircle,    label: 'Help' },
];

const ACTIONS = [
  { bg: 'bg-[#2563EB]', icon: Plus,    label: 'Create a session',    sub: 'Share the session link and code with the end user.', key: 'host' },
  { bg: 'bg-[#1C2333]', icon: Wifi,    label: 'Join a session',      sub: 'Enter the session code provided by your supporter.',  key: 'join' },
  { bg: 'bg-[#EA580C]', icon: Monitor, label: 'Set up remote access', sub: 'Enable auto-host so others can reach this device anytime.', key: 'setup' },
  { bg: 'bg-[#16A34A]', icon: Globe,   label: 'Web access',          sub: 'Connect to any device from your browser.', key: 'web' },
];

export const SnowHome: React.FC<SnowHomeProps> = (props) => {
  const [copiedId,   setCopiedId]   = useState(false);
  const [copiedPwd,  setCopiedPwd]  = useState(false);
  const [showPwd,    setShowPwd]    = useState(false);
  const [activeNav,  setActiveNav]  = useState('home');
  const [collapsed,  setCollapsed]  = useState(false);

  const fmt = (code: string) => {
    if (!code) return '--- --- ---';
    const c = code.replace(/\D/g, '');
    return (c.match(/.{1,3}/g) || [c]).join(' ');
  };

  const copyId = () => {
    if (!props.localAuthKey) return;
    navigator.clipboard.writeText(props.localAuthKey);
    setCopiedId(true); setTimeout(() => setCopiedId(false), 2000);
  };
  const copyPwd = () => {
    if (!props.devicePassword) return;
    navigator.clipboard.writeText(props.devicePassword);
    setCopiedPwd(true); setTimeout(() => setCopiedPwd(false), 2000);
  };

  const isOnline = props.hostStatus?.includes('Online') ||
    props.hostStatus?.includes('WebRTC') || props.isRegistered;

  const tasksCompleted = [props.isAuthenticated, props.isRegistered, props.isAutoHostEnabled]
    .filter(Boolean).length;

  const userName     = props.user?.name || props.user?.email || 'Guest';
  const userInitials = userName.slice(0, 2).toUpperCase();
  const firstName    = userName.split(' ')[0].split('@')[0];

  const handleAction = (key: string) => {
    if (key === 'host')  props.onStartHosting?.();
    if (key === 'join')  props.onFindDevice?.();
    if (key === 'setup') props.onToggleAutoHost?.();
  };

  return (
    <div className="flex h-screen w-full overflow-hidden select-none font-sans">

      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className="flex flex-col bg-[#0D1B3D] text-white shrink-0 overflow-hidden transition-all duration-200 ease-in-out"
        style={{ width: collapsed ? 52 : 220 }}
      >
        {/* Logo row + collapse toggle */}
        <div className="flex items-center px-3 py-[17px] shrink-0">
          <img src={logo} className="w-[26px] h-[26px] rounded-lg object-contain shrink-0" alt="" />
          {!collapsed && (
            <span className="ml-2.5 text-[14.5px] font-bold tracking-tight flex-1 truncate">RemoteLink</span>
          )}
          <button
            onClick={() => setCollapsed(v => !v)}
            className={`p-1 rounded text-white/35 hover:text-white hover:bg-white/10 transition-all shrink-0 ${collapsed ? 'mx-auto mt-0' : 'ml-1'}`}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
        </div>

        {/* Main nav */}
        <nav className="flex-1 px-1.5 py-1 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {NAV.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveNav(item.id)}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-lg transition-all ${
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              } text-[13px] font-medium ${
                activeNav === item.id
                  ? 'bg-[#1D6DF5] text-white'
                  : 'text-white/55 hover:bg-white/8 hover:text-white/90'
              }`}
            >
              <item.icon size={16} className="shrink-0" />
              {!collapsed && (
                <>
                  <span className="flex-1 text-left truncate">{item.label}</span>
                  {item.arrow && <ChevronRight size={12} className="opacity-50 shrink-0" />}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* User / auth */}
        {!collapsed && (
          props.isAuthenticated && props.user ? (
            <div className="px-3 py-3 border-t border-white/10 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-[#1D6DF5] flex items-center justify-center text-[11px] font-bold shrink-0">
                  {userInitials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[12px] font-semibold truncate leading-tight">{userName}</div>
                  <div className="text-[10px] text-white/40 truncate uppercase tracking-wide">
                    {props.user?.role || 'User'}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="px-2.5 py-3 border-t border-white/10 space-y-1.5 shrink-0">
              <button onClick={props.onSignIn}
                className="w-full py-2 bg-[#1D6DF5] hover:bg-[#1558d0] text-white text-[12px] font-semibold rounded-lg transition-all">
                Sign In
              </button>
              <button onClick={props.onSignUp}
                className="w-full py-2 text-white/65 hover:bg-white/8 text-[12px] font-semibold rounded-lg transition-all border border-white/15">
                Create Account
              </button>
            </div>
          )
        )}

        {/* Collapsed user avatar */}
        {collapsed && props.isAuthenticated && (
          <div className="flex justify-center py-3 border-t border-white/10 shrink-0">
            <div className="w-7 h-7 rounded-full bg-[#1D6DF5] flex items-center justify-center text-[11px] font-bold">
              {userInitials}
            </div>
          </div>
        )}

        {/* Bottom nav */}
        <div className="px-1.5 py-2 border-t border-white/10 space-y-0.5 shrink-0">
          {BOTTOM_NAV.map(item => (
            <button
              key={item.id}
              onClick={item.id === 'admin' ? props.onOpenSettings : undefined}
              title={collapsed ? item.label : undefined}
              className={`w-full flex items-center rounded-lg text-[12px] text-white/40 hover:bg-white/8 hover:text-white/75 transition-all ${
                collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'
              }`}
            >
              <item.icon size={14} className="shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </button>
          ))}
        </div>

        {/* Status */}
        <div className={`border-t border-white/10 py-3 flex items-center gap-2 shrink-0 ${collapsed ? 'justify-center px-0' : 'px-4'}`}>
          <div className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-gray-500'}`} />
          {!collapsed && (
            <span className="text-[10.5px] text-white/35 font-medium truncate">
              {isOnline ? 'Ready to connect (secure connection)' : 'Not connected'}
            </span>
          )}
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F0F2F5]">

        {/* Top bar */}
        <header className="h-[56px] shrink-0 bg-white border-b border-gray-200 flex items-center px-5 gap-3">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">
              REMOTELINK / OVERVIEW
            </div>
            <div className="text-[16px] font-bold text-gray-800 leading-none">Overview</div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-[200px]">
              <Search size={13} className="text-gray-400 shrink-0" />
              <input
                type="text"
                placeholder="Search devices..."
                className="flex-1 bg-transparent text-[12px] text-gray-600 placeholder:text-gray-400 outline-none min-w-0"
              />
            </div>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              <RefreshCw size={15} />
            </button>
            <button className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              <Bell size={15} />
            </button>
            <button onClick={props.onOpenSettings} className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
              <Settings size={15} />
            </button>
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="w-8 h-8 rounded-full bg-[#1D6DF5] flex items-center justify-center text-white text-[11px] font-bold shrink-0">
                {userInitials}
              </div>
              <div className="hidden lg:block leading-tight">
                <div className="text-[12px] font-semibold text-gray-700 truncate max-w-[90px]">{userName}</div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                  {props.user?.role || (props.isAuthenticated ? 'User' : 'Guest')}
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6 space-y-5">

            {/* Greeting */}
            <div>
              <h1 className="text-[20px] font-bold text-gray-800">
                Hello, {firstName}
              </h1>
              <p className="text-[13px] text-gray-400 mt-0.5">Here's your activity overview.</p>
            </div>

            {/* Row 1: Getting started + Connect with ID */}
            <div className="flex gap-4">

              {/* Getting started — ~58% */}
              <div className="flex-[58] bg-white rounded-xl border border-gray-200 p-7 shadow-sm min-w-0">
                <h3 className="text-[16px] font-bold text-gray-800">Getting started</h3>
                <div className="mt-1 mb-5">
                  <div className="text-[12.5px] text-gray-400 mb-2">{tasksCompleted} of 3 tasks completed</div>
                  <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1D6DF5] rounded-full transition-all duration-500"
                      style={{ width: `${(tasksCompleted / 3) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="space-y-5">
                  {[
                    { label: 'Sign in to RemoteLink',               done: !!props.isAuthenticated,   action: props.onSignIn },
                    { label: 'Register this device',                done: !!props.isRegistered,       action: undefined },
                    { label: 'Set up remote access on this device', done: !!props.isAutoHostEnabled,  action: props.onToggleAutoHost },
                  ].map((t, i) => (
                    <button key={i} onClick={!t.done ? t.action : undefined}
                      className="w-full flex items-center gap-4 text-left group">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        t.done ? 'border-[#1D6DF5] bg-[#1D6DF5]' : 'border-gray-300 group-hover:border-[#1D6DF5]/50'
                      }`}>
                        {t.done && <CheckCircle2 size={13} className="text-white" />}
                      </div>
                      <span className={`text-[13.5px] ${t.done ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                        {t.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Connect with ID — ~42% */}
              <div className="flex-[42] bg-white rounded-xl border border-gray-200 p-7 shadow-sm min-w-0 flex flex-col">
                <h3 className="text-[16px] font-bold text-gray-800">Connect with ID</h3>
                <p className="text-[12.5px] text-gray-400 mt-0.5 mb-5">
                  Your ID and password to share with the supporter.
                </p>

                {/* ID + Password */}
                <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 mb-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Your ID</div>
                      <div className="flex items-center gap-2">
                        <span className="text-[16px] font-bold text-gray-800 tracking-wider">
                          {fmt(props.localAuthKey || '')}
                        </span>
                        <button onClick={copyId} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                          {copiedId ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Password</div>
                      <div className="flex items-center gap-1">
                        <span className="text-[14px] font-bold text-gray-800 tracking-wider">
                          {showPwd ? (props.devicePassword || '--------') : '••••••••'}
                        </span>
                        <button onClick={() => setShowPwd(v => !v)} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                          {showPwd ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        <button onClick={copyPwd} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                          {copiedPwd ? <CheckCircle2 size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        </button>
                        <button onClick={props.onOpenSetPassword} className="text-gray-400 hover:text-gray-600 transition-colors shrink-0">
                          <RefreshCw size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-[12px] text-gray-400 mb-3">
                  Connect via ID to remotely access and control a device.
                </p>

                <div className="flex gap-2 mt-auto">
                  <input
                    type="text"
                    placeholder="Partner ID"
                    value={props.sessionCode || ''}
                    onChange={e => props.onSessionCodeChange?.(props.formatCode(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') props.onFindDevice?.(); }}
                    className="flex-1 min-w-0 border border-gray-200 rounded-lg px-3 py-2.5 text-[13px] text-gray-700 placeholder:text-gray-400 outline-none focus:border-[#1D6DF5] transition-colors"
                  />
                  <button
                    onClick={props.onFindDevice}
                    disabled={!props.sessionCode || props.sessionCode.replace(/\s/g, '').length < 9 || props.connectStatus === 'connecting'}
                    className="px-4 py-2.5 text-[13px] font-medium text-gray-500 hover:text-[#1D6DF5] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {props.connectStatus === 'connecting'
                      ? <Clock size={14} className="animate-spin" />
                      : 'Connect'}
                  </button>
                </div>

                {props.connectError && (
                  <div className="mt-2 flex items-center gap-1.5 text-[11.5px] text-red-500">
                    <AlertTriangle size={11} className="shrink-0" />
                    {props.connectError}
                  </div>
                )}
              </div>
            </div>

            {/* Row 2: Remote actions */}
            <div>
              <h3 className="text-[14px] font-semibold text-gray-600 mb-3">Remote actions</h3>
              <div className="grid grid-cols-4 gap-4">
                {ACTIONS.map(action => (
                  <button
                    key={action.key}
                    onClick={() => handleAction(action.key)}
                    className="bg-white rounded-xl border border-gray-200 p-5 text-left hover:border-[#1D6DF5]/30 hover:shadow-md transition-all shadow-sm"
                  >
                    <div className={`w-11 h-11 ${action.bg} rounded-xl flex items-center justify-center mb-4`}>
                      <action.icon size={20} className="text-white" />
                    </div>
                    <div className="text-[13.5px] font-bold text-gray-800 mb-1">{action.label}</div>
                    <div className="text-[12px] text-gray-400 leading-relaxed">{action.sub}</div>
                  </button>
                ))}
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* ── Password modal ──────────────────────────────────── */}
      {props.connectStep === 2 && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="w-full max-w-sm bg-white rounded-2xl border border-gray-200 shadow-2xl p-8 space-y-5">
            <div>
              <h3 className="text-[17px] font-bold text-gray-800">Enter password</h3>
              <p className="text-[12px] text-gray-400 mt-0.5">
                Required for {props.targetDeviceName || props.sessionCode}
              </p>
            </div>
            <div className="relative">
              <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                autoFocus
                type={showPwd ? 'text' : 'password'}
                placeholder="Device password"
                className="w-full border border-gray-200 rounded-lg pl-10 pr-10 py-3 text-[13px] text-gray-700 focus:border-[#1D6DF5] outline-none transition-colors"
                value={props.accessPassword}
                onChange={e => props.onAccessPasswordChange?.(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') props.onConnectToHost?.(); }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={props.onBackToStep1}
                className="flex-1 py-2.5 border border-gray-200 text-[13px] font-semibold text-gray-600 rounded-lg hover:bg-gray-50 transition-colors">
                Back
              </button>
              <button onClick={props.onConnectToHost}
                disabled={!props.accessPassword || props.lockoutSeconds > 0 || props.connectStatus === 'connecting'}
                className="flex-1 py-2.5 bg-[#1D6DF5] text-white text-[13px] font-semibold rounded-lg hover:bg-[#1558d0] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
                {props.connectStatus === 'connecting'
                  ? <Clock size={14} className="animate-spin" />
                  : 'Connect'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
