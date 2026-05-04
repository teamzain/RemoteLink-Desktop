import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  Info,
  Lock,
  LogIn,
  Monitor,
  RefreshCw,
  Settings
} from 'lucide-react';
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

const InfoDot = () => (
  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gray-400 text-[9px] font-bold text-white">
    i
  </span>
);

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

  const handleCopy = () => {
    onCopyAccessKey();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isHosting = hostStatus === 'status' || hostStatus === 'connecting';

  return (
    <div className="flex h-full w-full overflow-hidden bg-white font-inter select-none">
      <div className="relative min-w-0 flex-[1.18] overflow-hidden bg-[#071067] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_45%,rgba(69,151,213,0.75),transparent_34%),linear-gradient(140deg,#07094d_0%,#071067_48%,#1239d6_100%)]" />

        <div className="relative z-10 flex h-full flex-col">
          <div className="flex items-center gap-3 px-7 pt-6">
            <img src={logo} alt="Remote 365" className="h-8 w-8 object-contain" />
            <span className="text-[28px] font-black leading-none tracking-tight">Remote 365</span>
          </div>

          <div className="flex flex-1 items-center justify-center px-10">
            <div className="-mt-8 text-center">
              <h1 className="text-[38px] font-bold leading-tight tracking-tight">
                Access and support
                <br />
                from anywhere
              </h1>
              <button
                onClick={onSignIn}
                className="mt-8 rounded-md border border-white/70 px-7 py-3 text-[13px] font-bold text-white transition-colors hover:bg-white hover:text-[#071067]"
              >
                Sign in to Remote 365
              </button>
              <p className="mt-5 text-[12px] font-semibold text-white/80">
                Don't have an account?{' '}
                <button onClick={onSignUp} className="font-bold text-white hover:underline">
                  Create one here
                </button>
              </p>
            </div>
          </div>

          <div className="flex h-9 items-center gap-2 bg-white/14 px-7 text-[11px] font-semibold text-white/85">
            <div className={`h-2 w-2 rounded-full ${isHosting ? 'bg-green-400' : 'bg-amber-300'}`} />
            {isHosting ? 'Ready to connect (secure connection)' : 'Preparing secure connection'}
          </div>
        </div>
      </div>

      <div className="relative -ml-4 min-w-[520px] flex-1 rounded-l-[18px] bg-white shadow-[-18px_0_40px_rgba(0,0,0,0.12)]">
        <button className="absolute right-7 top-6 flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-700">
          <Settings size={18} />
        </button>

        <div className="flex h-full items-center justify-center px-12">
          <div className="w-full max-w-[360px]">
            <p className="mb-4 text-center text-[13px] font-medium text-gray-700">
              Share your ID and password with the supporter.
            </p>

            <div className="overflow-hidden rounded-[14px] border border-gray-200 bg-[#F5F6F8]">
              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-gray-500">Your ID</p>
                  <p className="font-mono text-[27px] font-semibold leading-none tracking-[0.04em] text-gray-800">
                    {hostAccessKey ? formatCode(hostAccessKey) : '--- --- ---'}
                  </p>
                </div>
                <button
                  onClick={handleCopy}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white hover:text-gray-800"
                >
                  {copied ? <CheckCircle2 size={18} className="text-green-600" /> : <Copy size={18} />}
                </button>
              </div>

              <div className="mx-4 h-px bg-gray-200" />

              <div className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="mb-1.5 text-[12px] font-medium text-gray-500">Password</p>
                  <p className="font-mono text-[22px] font-semibold leading-none tracking-[0.03em] text-gray-800">
                    {devicePassword || 'Not set'}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={onOpenSetPassword}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white hover:text-gray-800"
                  >
                    <RefreshCw size={17} />
                  </button>
                  <button
                    onClick={() => devicePassword && navigator.clipboard.writeText(devicePassword)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white hover:text-gray-800"
                  >
                    <Copy size={18} />
                  </button>
                </div>
              </div>
            </div>

            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-gray-200" />
              <span className="text-[12px] text-gray-500">Or</span>
              <div className="h-px flex-1 bg-gray-200" />
            </div>

            <p className="mb-4 text-center text-[13px] text-gray-600">
              Enter the session code provided by the supporter.
            </p>

            {connectStep === 1 ? (
              <div className="flex items-end gap-2">
                <label className="flex-1">
                  <span className="relative left-2 top-2 bg-white px-1 text-[12px] text-gray-500">
                    Session Code
                  </span>
                  <input
                    autoFocus
                    type="text"
                    placeholder="e.g. 123 456 789"
                    maxLength={11}
                    className="h-11 w-full rounded-[4px] border border-gray-400 px-3 font-mono text-[13px] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                    value={sessionCode}
                    onChange={e => onSessionCodeChange(formatCode(e.target.value))}
                    onKeyDown={e => { if (e.key === 'Enter') onFindDevice(); }}
                  />
                </label>
                <button
                  onClick={onFindDevice}
                  disabled={connectStatus === 'connecting' || !sessionCode}
                  className="h-11 rounded-md bg-[#EEF1F6] px-5 text-[13px] font-semibold text-gray-700 transition-colors hover:bg-[#E4E8F0] disabled:text-gray-400 disabled:opacity-70"
                >
                  {connectStatus === 'connecting' ? 'Checking...' : 'Join session'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                  <div>
                    <p className="text-[11px] text-gray-500">Target device</p>
                    <p className="font-mono text-[13px] font-semibold text-gray-800">{formatCode(sessionCode)}</p>
                    {targetDeviceName && <p className="text-[11px] text-gray-500">{targetDeviceName}</p>}
                  </div>
                  <div className="h-2 w-2 rounded-full bg-green-500" />
                </div>

                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    autoFocus
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Enter password"
                    className="h-11 w-full rounded-md border border-gray-300 pl-9 pr-10 text-[13px] outline-none focus:border-[#1D4ED8] focus:ring-1 focus:ring-[#1D4ED8]"
                    value={accessPassword}
                    onChange={e => onAccessPasswordChange(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') onConnectToHost(); }}
                  />
                  <button
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={onConnectToHost}
                    disabled={connectStatus === 'connecting' || !accessPassword || lockoutSeconds > 0}
                    className="h-11 flex-1 rounded-md bg-[#071067] text-[13px] font-semibold text-white transition-colors hover:bg-[#101a80] disabled:opacity-50"
                  >
                    {connectStatus === 'connecting' ? 'Connecting...' : 'Connect'}
                  </button>
                  <button
                    onClick={onBackToStep1}
                    className="h-11 rounded-md border border-gray-200 px-4 text-[13px] text-gray-600 hover:bg-gray-50"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {(connectError || lockoutSeconds > 0) && (
              <div className="mt-3 flex items-start gap-2 rounded-md border border-red-100 bg-red-50 px-3 py-2">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-[12px] font-medium text-red-700">
                  {lockoutSeconds > 0 ? `Too many attempts. Try again in ${lockoutSeconds}s.` : connectError}
                </p>
              </div>
            )}

            <div className="mt-6 space-y-2 border-t border-gray-200 pt-4">
              <label className="flex items-center gap-2 text-[13px] text-gray-700">
                <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-gray-300" />
                Start Remote 365 with Windows
                <InfoDot />
              </label>
              <label className="flex items-center gap-2 text-[13px] text-gray-700">
                <input type="checkbox" checked readOnly className="h-4 w-4 rounded border-gray-300" />
                Grant Easy Access to this device
                <InfoDot />
              </label>
            </div>

            {!isAuthenticated && (
              <button
                onClick={onSignIn}
                className="mt-5 flex w-full items-center justify-center gap-1.5 text-center text-[12px] font-semibold text-gray-500 transition-colors hover:text-gray-800"
              >
                <LogIn size={13} /> Have an account? Sign in to see your saved devices.
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
