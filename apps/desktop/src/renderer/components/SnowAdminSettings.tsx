import React, { useState, useEffect } from 'react';
import {
  Shield,
  Server,
  Building2,
  Check,
  AlertCircle,
  Loader2,
  Settings,
  Globe,
  Lock,
  Zap,
  RefreshCw,
  Power,
  ChevronRight
} from 'lucide-react';
import api from '../lib/api';

export const SnowAdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/api/admin/settings');
      setSettings(data);
    } catch (e) {
      console.error('Failed to fetch platform settings');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updates: any) => {
    setSaveStatus('saving');
    try {
      const { data } = await api.patch('/api/admin/settings', updates);
      setSettings(data);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      setSaveStatus('error');
    }
  };

  const Toggle = ({ checked, onChange }: { checked: boolean, onChange: (v: boolean) => void }) => (
    <button 
      onClick={() => onChange(!checked)}
      className={`w-10 h-6 rounded-full transition-colors relative ${checked ? 'bg-[#1C1C1C]' : 'bg-[rgba(28,28,28,0.1)]'}`}
    >
      <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${checked ? 'left-5' : 'left-1'}`} />
    </button>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={32} className="animate-spin text-[rgba(28,28,28,0.1)]" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto font-inter animate-in fade-in duration-500 pb-20">
      
      {/* Platform Header */}
      <div className="flex items-center justify-between mb-10">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-500 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
               <Shield size={24} />
            </div>
            <div>
               <h1 className="text-2xl font-extrabold text-[#1C1C1C] tracking-tight uppercase">Platform Administration</h1>
               <p className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mt-0.5">Global Infrastructure Control Panel</p>
            </div>
         </div>
         <button onClick={fetchSettings} className="p-2 text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C] transition-colors"><RefreshCw size={16} /></button>
      </div>

      <div className="space-y-8">
         
         {/* Infrastructure Section */}
         <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
            <h3 className="text-sm font-bold text-[#1C1C1C] mb-8 flex items-center gap-2 uppercase tracking-tight">
               <Server size={16} className="text-blue-500" /> Infrastructure & Routing
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Default Relay Server</label>
                  <input 
                    value={settings?.defaultRelayUrl || ''} 
                    onChange={e => setSettings({...settings, defaultRelayUrl: e.target.value})}
                    onBlur={() => handleUpdate({ defaultRelayUrl: settings.defaultRelayUrl })}
                    className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)] rounded-xl px-4 py-3 text-sm font-mono font-bold text-[#1C1C1C] outline-none"
                    placeholder="stun:stun.l.google.com:19302"
                  />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Max Session Duration (Min)</label>
                  <input 
                    type="number"
                    value={settings?.maxSessionDuration || 0} 
                    onChange={e => setSettings({...settings, maxSessionDuration: parseInt(e.target.value)})}
                    onBlur={() => handleUpdate({ maxSessionDuration: settings.maxSessionDuration })}
                    className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)] rounded-xl px-4 py-3 text-sm font-bold text-[#1C1C1C] outline-none"
                  />
               </div>
            </div>
            
            <div className="mt-8 pt-8 border-t border-[rgba(28,28,28,0.04)]">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${settings?.maintenanceMode ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
                        <Power size={18} />
                     </div>
                     <div>
                        <span className="text-sm font-bold text-[#1C1C1C]">Global Maintenance Mode</span>
                        <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] mt-0.5">Disable all non-admin access and show maintenance message</p>
                     </div>
                  </div>
                  <Toggle checked={settings?.maintenanceMode || false} onChange={v => handleUpdate({ maintenanceMode: v })} />
               </div>
               {settings?.maintenanceMode && (
                  <div className="mt-4 animate-in slide-in-from-top-2">
                     <input 
                        value={settings?.maintenanceMessage || ''} 
                        onChange={e => setSettings({...settings, maintenanceMessage: e.target.value})}
                        onBlur={() => handleUpdate({ maintenanceMessage: settings.maintenanceMessage })}
                        className="w-full bg-red-50/50 border border-red-100/50 rounded-xl px-4 py-3 text-sm font-medium text-red-600 outline-none placeholder:text-red-300"
                        placeholder="e.g. Platform undergoing scheduled updates. Back online in 2 hours."
                     />
                  </div>
               )}
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* Global Security Section */}
            <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm space-y-8">
               <h3 className="text-sm font-bold text-[#1C1C1C] flex items-center gap-2 uppercase tracking-tight">
                  <Lock size={16} className="text-purple-500" /> Global Security
               </h3>
               <div className="space-y-6">
                  <div className="flex items-center justify-between">
                     <div>
                        <span className="font-bold text-sm text-[#1C1C1C]">Strict 2FA</span>
                        <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Force all SUB_ADMIN users to enable 2FA</p>
                     </div>
                     <Toggle checked={settings?.forceSubAdmin2FA || false} onChange={v => handleUpdate({ forceSubAdmin2FA: v })} />
                  </div>
                  <div className="flex items-center justify-between">
                     <div>
                        <span className="font-bold text-sm text-[#1C1C1C]">Plan Lock</span>
                        <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Restrict SUB_ADMINs from self-serving plan changes</p>
                     </div>
                     <Toggle checked={settings?.restrictPlanChanges || false} onChange={v => handleUpdate({ restrictPlanChanges: v })} />
                  </div>
                  <div className="space-y-2 pt-2">
                     <label className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest ml-1">Token Lifetime (Hours)</label>
                     <input 
                        type="number"
                        value={settings?.globalTokenLifetime || 0} 
                        onChange={e => setSettings({...settings, globalTokenLifetime: parseInt(e.target.value)})}
                        onBlur={() => handleUpdate({ globalTokenLifetime: settings.globalTokenLifetime })}
                        className="w-full bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)] rounded-xl px-4 py-3 text-sm font-bold text-[#1C1C1C] outline-none"
                     />
                  </div>
               </div>
            </div>

            {/* Organizations & Plans Section */}
            <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm space-y-8">
               <h3 className="text-sm font-bold text-[#1C1C1C] flex items-center gap-2 uppercase tracking-tight">
                  <Building2 size={16} className="text-emerald-500" /> Defaults & Billing
               </h3>
               <div className="space-y-6">
                  <div className="space-y-3">
                     <span className="font-bold text-sm text-[#1C1C1C]">Default Plan (New Orgs)</span>
                     <div className="grid grid-cols-2 gap-2">
                        {['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'].map(p => (
                           <button 
                              key={p}
                              onClick={() => handleUpdate({ defaultOrgPlan: p })}
                              className={`py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-widest transition-all ${settings?.defaultOrgPlan === p ? 'bg-[#1C1C1C] text-white border-[#1C1C1C]' : 'bg-[#F9F9FA] text-[rgba(28,28,28,0.4)] border-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.2)]'}`}
                           >
                              {p}
                           </button>
                        ))}
                     </div>
                  </div>
                  
                  <div className="pt-4">
                     <button className="w-full p-4 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.2)] transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[rgba(28,28,28,0.2)] group-hover:text-[#1C1C1C] shadow-sm transition-colors">
                              <Globe size={18} />
                           </div>
                           <div className="text-left">
                              <span className="text-xs font-bold text-[#1C1C1C]">Organization Explorer</span>
                              <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] mt-0.5">Manage all registered organizations</p>
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
