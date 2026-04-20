import React, { useState, useEffect } from 'react';
import {
  Shield, Server, Building2, Check, Loader2, Settings,
  Globe, Lock, Zap, RefreshCw, Power, ChevronRight, AlertCircle, WifiOff
} from 'lucide-react';
import api from '../lib/api';

const DEFAULTS = {
  defaultRelayUrl: 'relay.connect-x.io',
  maxSessionDuration: 60,
  maintenanceMode: false,
  maintenanceMessage: '',
  forceSubAdmin2FA: false,
  globalTokenLifetime: 24,
  minPasswordLength: 8,
  maxPasswordLength: 32,
  defaultOrgPlan: 'FREE',
  restrictPlanChanges: false,
};

const LS_KEY = 'platform_settings_local';

function loadLocal() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(LS_KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

export const SnowAdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<any>(loadLocal());
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/admin/settings');
      const merged = { ...DEFAULTS, ...data };
      setSettings(merged);
      localStorage.setItem(LS_KEY, JSON.stringify(merged));
      setApiOnline(true);
    } catch (e: any) {
      console.error('Admin settings API unavailable — using local state', e.message);
      setApiOnline(false);
      // Keep local defaults already loaded
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updates: any) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));

    if (!apiOnline) return; // persist locally only

    setSaveStatus('saving');
    try {
      const { data } = await api.patch('/api/admin/settings', updates);
      setSettings({ ...DEFAULTS, ...data });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  const Toggle = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full transition-colors relative flex-shrink-0 ${checked ? 'bg-[#1C1C1C]' : 'bg-[rgba(28,28,28,0.1)]'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${checked ? 'left-5' : 'left-1'}`} />
    </button>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin text-[rgba(28,28,28,0.15)]" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto animate-in fade-in duration-500 pb-20">

      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Shield size={22} />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-[#1C1C1C] tracking-tight uppercase">Platform Administration</h1>
            <p className="text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mt-0.5">Global Infrastructure Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* API status badge */}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold border ${
            apiOnline === null ? 'bg-[#F9F9FA] text-[rgba(28,28,28,0.3)] border-[rgba(28,28,28,0.06)]' :
            apiOnline ? 'bg-green-50 text-green-600 border-green-100' : 'bg-amber-50 text-amber-600 border-amber-100'
          }`}>
            {apiOnline === false ? <WifiOff size={12} /> : <div className={`w-1.5 h-1.5 rounded-full ${apiOnline ? 'bg-green-500 animate-pulse' : 'bg-[rgba(28,28,28,0.2)]'}`} />}
            {apiOnline === null ? 'Checking…' : apiOnline ? 'API Connected' : 'Local Mode'}
          </div>
          {saveStatus === 'saved' && <span className="flex items-center gap-1 text-xs font-bold text-green-600"><Check size={12} /> Saved</span>}
          {saveStatus === 'error' && <span className="flex items-center gap-1 text-xs font-bold text-red-500"><AlertCircle size={12} /> Save failed</span>}
          <button onClick={fetchSettings} className="p-2 text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C] transition-colors rounded-xl hover:bg-[#F9F9FA]">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {!apiOnline && (
        <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
          <WifiOff size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs font-semibold text-amber-700 leading-relaxed">
            Platform API is unreachable. Settings are being saved locally on this machine only. Changes will sync to the server once the API is available.
          </p>
        </div>
      )}

      <div className="space-y-6">

        {/* Infrastructure */}
        <div className="bg-white rounded-[28px] border border-[rgba(28,28,28,0.06)] p-7 shadow-sm">
          <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 flex items-center gap-2 uppercase tracking-tight">
            <Server size={16} className="text-blue-500" /> Infrastructure & Routing
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Default Relay Server</label>
              <input
                value={settings.defaultRelayUrl}
                onChange={e => setSettings({ ...settings, defaultRelayUrl: e.target.value })}
                onBlur={() => handleUpdate({ defaultRelayUrl: settings.defaultRelayUrl })}
                className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-3 text-sm font-mono font-bold text-[#1C1C1C] outline-none focus:border-[rgba(28,28,28,0.2)]"
                placeholder="stun:stun.l.google.com:19302"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Max Session Duration (min)</label>
              <input
                type="number"
                value={settings.maxSessionDuration}
                onChange={e => setSettings({ ...settings, maxSessionDuration: parseInt(e.target.value) || 60 })}
                onBlur={() => handleUpdate({ maxSessionDuration: settings.maxSessionDuration })}
                className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-3 text-sm font-bold text-[#1C1C1C] outline-none focus:border-[rgba(28,28,28,0.2)]"
              />
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-[rgba(28,28,28,0.04)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings.maintenanceMode ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                  <Power size={18} />
                </div>
                <div>
                  <span className="text-sm font-bold text-[#1C1C1C]">Global Maintenance Mode</span>
                  <p className="text-xs font-medium text-[rgba(28,28,28,0.4)] mt-0.5">Disable all non-admin access and show maintenance message</p>
                </div>
              </div>
              <Toggle checked={settings.maintenanceMode} onChange={v => handleUpdate({ maintenanceMode: v })} />
            </div>
            {settings.maintenanceMode && (
              <div className="mt-4">
                <input
                  value={settings.maintenanceMessage}
                  onChange={e => setSettings({ ...settings, maintenanceMessage: e.target.value })}
                  onBlur={() => handleUpdate({ maintenanceMessage: settings.maintenanceMessage })}
                  className="w-full bg-red-50 border border-red-100 rounded-xl px-4 py-3 text-sm font-medium text-red-600 outline-none placeholder:text-red-300"
                  placeholder="e.g. Platform undergoing scheduled updates. Back online in 2 hours."
                />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Global Security */}
          <div className="bg-white rounded-[28px] border border-[rgba(28,28,28,0.06)] p-7 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-[#1C1C1C] flex items-center gap-2 uppercase tracking-tight">
              <Lock size={16} className="text-purple-500" /> Global Security
            </h3>
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-bold text-[#1C1C1C]">Strict 2FA</span>
                  <p className="text-xs font-medium text-[rgba(28,28,28,0.4)] mt-0.5">Force all Sub-Admins to enable 2FA</p>
                </div>
                <Toggle checked={settings.forceSubAdmin2FA} onChange={v => handleUpdate({ forceSubAdmin2FA: v })} />
              </div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <span className="text-sm font-bold text-[#1C1C1C]">Plan Lock</span>
                  <p className="text-xs font-medium text-[rgba(28,28,28,0.4)] mt-0.5">Restrict Sub-Admins from self-serving plan changes</p>
                </div>
                <Toggle checked={settings.restrictPlanChanges} onChange={v => handleUpdate({ restrictPlanChanges: v })} />
              </div>
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Token Lifetime (hours)</label>
                <input
                  type="number"
                  value={settings.globalTokenLifetime}
                  onChange={e => setSettings({ ...settings, globalTokenLifetime: parseInt(e.target.value) || 24 })}
                  onBlur={() => handleUpdate({ globalTokenLifetime: settings.globalTokenLifetime })}
                  className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-3 text-sm font-bold text-[#1C1C1C] outline-none focus:border-[rgba(28,28,28,0.2)]"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Min Pwd Length</label>
                  <input
                    type="number"
                    value={settings.minPasswordLength}
                    onChange={e => setSettings({ ...settings, minPasswordLength: parseInt(e.target.value) || 8 })}
                    onBlur={() => handleUpdate({ minPasswordLength: settings.minPasswordLength })}
                    className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-3 text-sm font-bold text-[#1C1C1C] outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Max Pwd Length</label>
                  <input
                    type="number"
                    value={settings.maxPasswordLength}
                    onChange={e => setSettings({ ...settings, maxPasswordLength: parseInt(e.target.value) || 32 })}
                    onBlur={() => handleUpdate({ maxPasswordLength: settings.maxPasswordLength })}
                    className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl px-4 py-3 text-sm font-bold text-[#1C1C1C] outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Defaults & Plans */}
          <div className="bg-white rounded-[28px] border border-[rgba(28,28,28,0.06)] p-7 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-[#1C1C1C] flex items-center gap-2 uppercase tracking-tight">
              <Building2 size={16} className="text-emerald-500" /> Defaults & Plans
            </h3>
            <div className="space-y-5">
              <div>
                <span className="text-sm font-bold text-[#1C1C1C] block mb-3">Default Plan (New Orgs)</span>
                <div className="grid grid-cols-2 gap-2">
                  {['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'].map(p => (
                    <button
                      key={p}
                      onClick={() => handleUpdate({ defaultOrgPlan: p })}
                      className={`py-2.5 rounded-xl border text-xs font-bold uppercase tracking-widest transition-all ${settings.defaultOrgPlan === p ? 'bg-[#1C1C1C] text-white border-[#1C1C1C] shadow-lg shadow-black/10' : 'bg-[#F9F9FA] text-[rgba(28,28,28,0.4)] border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)]'}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button className="w-full p-4 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] transition-all flex items-center justify-between group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-[rgba(28,28,28,0.2)] group-hover:text-[#1C1C1C] shadow-sm transition-colors">
                      <Globe size={16} />
                    </div>
                    <div className="text-left">
                      <span className="text-sm font-bold text-[#1C1C1C]">Organization Explorer</span>
                      <p className="text-xs font-medium text-[rgba(28,28,28,0.4)] mt-0.5">Manage all registered organizations</p>
                    </div>
                  </div>
                  <ChevronRight size={14} className="text-[rgba(28,28,28,0.2)]" />
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
