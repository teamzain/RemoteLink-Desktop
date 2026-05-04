import React, { useState, useEffect } from 'react';
import {
  Shield, Server, Building2, Check, Loader2, Settings,
  Globe, Lock, Zap, RefreshCw, Power, ChevronRight, AlertCircle, WifiOff,
  LayoutGrid, Monitor, FileText, Settings2, Smartphone, Key, CreditCard, Receipt,
  Users, CheckCircle2, ArrowRight, DownloadCloud, ArrowLeftRight, Mic
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

const SIDEBAR_SECTIONS = [
  {
    title: 'ORGANIZATION MANAGEMENT',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutGrid },
      { id: 'general', label: 'General', icon: Settings },
      { id: 'ai', label: 'TeamViewer AI', icon: Zap, isNew: true },
      { id: 'security', label: 'Security center', icon: Shield },
    ]
  },
  {
    title: 'DEVICE MANAGEMENT',
    items: [
      { id: 'devices', label: 'Devices', icon: Monitor },
      { id: 'policies', label: 'Policies', icon: FileText },
      { id: 'rollout', label: 'Rollout set-up', icon: Settings2 },
    ]
  },
  {
    title: 'AUTHENTICATION',
    items: [
      { id: 'trusted', label: 'Trusted devices', icon: Smartphone },
      { id: 'apps', label: 'Apps & Tokens', icon: Key },
    ]
  },
  {
    title: 'BILLING',
    items: [
      { id: 'license', label: 'License usage', icon: CreditCard },
      { id: 'subs', label: 'Subscriptions', icon: Receipt },
    ]
  }
];

const SLIDES = [
  {
    tag: 'Available with Business, Commercial',
    title: 'Assign policies',
    description: 'Give other users access to your devices and specify their account privileges.',
    icon: Settings,
    button: 'Learn more'
  },
  {
    tag: 'Available with Commercial',
    title: 'Create user roles',
    description: 'Create and manage roles of your company and give them the required permission.',
    icon: Users,
    button: 'Learn more'
  },
  {
    tag: 'Available with Commercial',
    title: 'Manage access',
    description: 'Set up conditional access for users and devices.',
    icon: Lock,
    button: 'Learn more'
  }
];

const OverviewTab = ({ user }: { user: any }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SLIDES.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  const slide = SLIDES[currentSlide];
  const SlideIcon = slide.icon;

  return (
    <div className="max-w-5xl mx-auto p-10 animate-in fade-in duration-500">
      <h1 className="text-2xl font-semibold text-[#1C1C1C]">Hi {user?.name || 'Zain Ul Abidden'},</h1>
      <p className="text-sm text-[#757575] mt-1 mb-10">Purchase a license or join a company to access the Management Portal.</p>
      
      {/* Banner */}
      <div className="bg-[#2446C4] rounded-2xl p-8 mb-10 flex flex-col justify-center overflow-hidden relative min-h-[240px] shadow-sm">
         <div className="z-10 text-white max-w-[400px] animate-in fade-in slide-in-from-bottom-2 duration-500" key={currentSlide}>
            <span className="text-[12px] font-medium text-white/70 mb-3 block">{slide.tag}</span>
            <h2 className="text-[32px] font-bold mb-3 tracking-tight">{slide.title}</h2>
            <p className="text-[14px] text-white/90 leading-relaxed mb-6 font-medium pr-4">{slide.description}</p>
            <button className="text-[14px] font-bold text-white hover:underline transition-all mb-8">{slide.button}</button>
            
            {/* Dots */}
            <div className="flex items-center gap-2">
               {SLIDES.map((_, idx) => (
                 <button
                   key={idx}
                   onClick={() => setCurrentSlide(idx)}
                   className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === idx ? 'w-5 bg-[#0A1753]' : 'w-1.5 bg-white hover:bg-white/80'}`}
                 />
               ))}
            </div>
         </div>
         
         <div className="absolute right-0 top-0 bottom-0 w-[60%] pointer-events-none flex items-center justify-end overflow-hidden">
            <SlideIcon 
              size={450} 
              className="mr-[-80px] text-[#0A1753] animate-in fade-in zoom-in duration-700" 
              key={`icon-${currentSlide}`} 
              strokeWidth={2} 
            />
         </div>
      </div>
      
      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-8 flex flex-col h-full hover:border-[#2446C4]/30 transition-all cursor-pointer group shadow-sm hover:shadow-md">
           <div className="w-10 h-10 rounded bg-[#2446C4] flex items-center justify-center text-white mb-8 transition-transform group-hover:scale-110 duration-300">
              <CheckCircle2 size={20} className="animate-pulse" />
           </div>
           <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#1C1C1C]">Buy a license</h3>
              <ArrowRight className="text-blue-500 transform group-hover:translate-x-1 transition-transform" size={18} />
           </div>
           <div className="h-px w-full bg-[rgba(0,0,0,0.06)] mb-5" />
           <p className="text-[13px] text-[#757575] leading-relaxed font-medium flex-1">
              Purchase a license to get access to all commercial TeamViewer features, including the Management Portal.
           </p>
        </div>
        
        <div className="bg-white rounded-2xl border border-[rgba(0,0,0,0.06)] p-8 flex flex-col h-full hover:border-[#5D7BDB]/30 transition-all cursor-pointer group shadow-sm hover:shadow-md">
           <div className="w-10 h-10 rounded bg-[#5D7BDB] flex items-center justify-center text-white mb-8 transition-transform group-hover:scale-110 duration-300">
              <DownloadCloud size={20} className="animate-bounce" />
           </div>
           <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-[#1C1C1C]">Start a free trial</h3>
           </div>
           <div className="h-px w-full bg-[rgba(0,0,0,0.06)] mb-5" />
           <p className="text-[13px] text-[#757575] leading-relaxed font-medium flex-1">
              Request a free trial and explore all commercial features free of charge for 14 days.
           </p>
        </div>
      </div>
    </div>
  )
}

const SecurityCenterTab = () => {
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500">

      <div className="max-w-5xl mx-auto p-10 w-full">
        <div className="mb-10">
          <h1 className="text-2xl font-semibold text-[#1C1C1C]">Security center</h1>
          <p className="text-[13px] text-[#757575] mt-1">Manage your security settings and strengthen your protection.</p>
        </div>

        {/* Top 2 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6 mb-6">
          {/* Security level */}
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-8 shadow-sm flex items-center justify-between">
            <div className="flex flex-col gap-4 w-full">
              <div className="flex items-center justify-between">
                 <span className="text-[14px] font-semibold text-[#1C1C1C]">Security level</span>
                 <div className="w-12 h-5 bg-[#F5F5F5] rounded-full animate-pulse" />
              </div>
              <div className="w-40 h-8 bg-[#F5F5F5] rounded-lg animate-pulse mb-4" />
              
              <div className="flex items-center gap-2">
                <span className="text-[12px] text-[#757575]">Current level</span>
                <div className="w-20 h-4 bg-[#F5F5F5] rounded-full animate-pulse" />
                <div className="w-12 h-4 bg-[#F5F5F5] rounded-full animate-pulse" />
              </div>
            </div>
            <div className="ml-12 flex-shrink-0 relative">
               <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center border-[6px] border-[#F5F5F5]">
                  <Shield size={40} className="text-[#E0E0E0]" strokeWidth={1.5} />
               </div>
            </div>
          </div>

          {/* Overall score */}
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-8 shadow-sm flex flex-col justify-between">
            <div>
              <span className="text-[14px] font-semibold text-[#1C1C1C]">Overall score</span>
            </div>
            <div className="mt-8">
              <span className="text-[12px] text-[#757575] mb-3 block">Total progress</span>
              <div className="w-full h-3 bg-[#F5F5F5] rounded-full overflow-hidden" />
            </div>
          </div>
        </div>

        {/* Bottom 3 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Users */}
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-4">
               <div className="w-8 h-8 rounded-md bg-[#EEF2FF] flex items-center justify-center text-blue-600">
                 <Users size={16} />
               </div>
               <h3 className="text-[14px] font-semibold text-[#1C1C1C]">Users</h3>
               <div className="w-20 h-4 bg-[#F5F5F5] rounded-full animate-pulse ml-auto" />
            </div>
            <p className="text-[13px] text-[#757575] leading-relaxed mb-6 flex-1">
              Secure user accounts with SSO or 2FA and limit permissions to reduce risks and strengthen security.
            </p>
            <button className="w-full py-2.5 rounded-lg border border-[rgba(0,0,0,0.1)] text-[13px] font-medium text-[#1C1C1C] hover:bg-gray-50 transition-colors">
              View and manage
            </button>
          </div>

          {/* Devices */}
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-4">
               <div className="w-8 h-8 rounded-md bg-[#EEF2FF] flex items-center justify-center text-blue-600">
                 <Monitor size={16} />
               </div>
               <h3 className="text-[14px] font-semibold text-[#1C1C1C]">Devices</h3>
               <span className="px-2 py-0.5 bg-[#EEF2FF] text-blue-600 text-[10px] font-semibold rounded">Preview</span>
            </div>
            <p className="text-[13px] text-[#757575] leading-relaxed mb-6 flex-1">
              Check your devices' security and reinforce protection to ensure safe access.
            </p>
            <button className="w-full py-2.5 rounded-lg border border-[rgba(0,0,0,0.1)] text-[13px] font-medium text-[#1C1C1C] hover:bg-gray-50 transition-colors">
              View and manage
            </button>
          </div>

          {/* Connections */}
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm flex flex-col">
            <div className="flex items-center gap-3 mb-4">
               <div className="w-8 h-8 rounded-md bg-[#EEF2FF] flex items-center justify-center text-blue-600">
                 <ArrowLeftRight size={16} />
               </div>
               <h3 className="text-[14px] font-semibold text-[#1C1C1C]">Connections</h3>
            </div>
            <p className="text-[13px] text-[#757575] leading-relaxed mb-6 flex-1">
              Manage settings and control sharing to protect sensitive data and enhance privacy.
            </p>
            <button className="w-full py-2.5 rounded-lg border border-[rgba(0,0,0,0.1)] text-[13px] font-medium text-[#1C1C1C] hover:bg-gray-50 transition-colors">
              View and manage
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const SnowAdminSettings: React.FC<{ setCurrentView?: (v: any) => void, user?: any }> = ({ setCurrentView, user }) => {
  const [activeTab, setActiveTab] = useState('overview');
  
  // Legacy Settings State
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
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (updates: any) => {
    const next = { ...settings, ...updates };
    setSettings(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));

    if (!apiOnline) return;

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

  const [companyName, setCompanyName] = useState('Teamzain');
  const [inheritDeviceGroupPerms, setInheritDeviceGroupPerms] = useState(false);

  const renderGeneralTab = () => {
    if (loading) return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[rgba(28,28,28,0.15)]" />
      </div>
    );

    const SettingRow = ({ icon: Icon, title, description, action, locked = false }: { icon: any, title: string | React.ReactNode, description: string | React.ReactNode, action?: React.ReactNode, locked?: boolean }) => (
      <div className="flex items-center justify-between gap-6 px-6 py-5 border-b border-[rgba(0,0,0,0.05)] last:border-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0 text-[#555]">
            <Icon size={18} strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-[14px] font-medium text-[#1C1C1C]">{title}</h3>
              {locked && <span className="px-2.5 py-0.5 bg-orange-400 text-white text-[11px] font-semibold rounded-full">Upgrade</span>}
            </div>
            <p className="text-[13px] text-[#757575] mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        {action && <div className="flex-shrink-0">{action}</div>}
      </div>
    );

    return (
      <div className="max-w-4xl mx-auto animate-in fade-in duration-500 p-10 pb-20">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-[#1C1C1C]">General</h1>
          <p className="text-[13px] text-[#757575] mt-1">Set the preferences for your <span className="text-blue-600">company</span>.</p>
        </div>

        {!apiOnline && (
          <div className="mb-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl">
            <WifiOff size={16} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs font-semibold text-amber-700 leading-relaxed">
              Platform API is unreachable. Settings are being saved locally on this machine only.
            </p>
          </div>
        )}

        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm overflow-hidden divide-y divide-[rgba(0,0,0,0.05)]">
          <SettingRow
            icon={Building2}
            title="Company name"
            description="Choose the name you want to display for this company."
            action={
              <input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                onBlur={() => handleUpdate({ companyName })}
                className="w-36 text-right text-[14px] font-medium text-[#1C1C1C] bg-transparent outline-none border-b border-transparent hover:border-[rgba(0,0,0,0.1)] focus:border-blue-500 transition-colors pb-0.5"
              />
            }
          />
          <SettingRow
            icon={Users}
            title="Company contact list"
            description="Allow users to browse and interact with other users in the company."
            locked
            action={<button className="text-[13px] font-semibold text-blue-600 hover:underline whitespace-nowrap">Upgrade plan</button>}
          />
          <SettingRow
            icon={FileText}
            title="Event logging"
            description="User event data from the company is logged on RemoteLink servers for 1 year."
            locked
            action={<button className="text-[13px] font-semibold text-blue-600 hover:underline whitespace-nowrap">Upgrade plan</button>}
          />
          <SettingRow
            icon={Mic}
            title="In-session voice logs (Assist AR sessions only)"
            description="Log voice transcripts that have been captured during support connections."
            locked
            action={<button className="text-[13px] font-semibold text-blue-600 hover:underline whitespace-nowrap">Upgrade plan</button>}
          />
          <SettingRow
            icon={Monitor}
            title="In-session screenshots (Assist AR sessions only)"
            description="Log screenshots that have been taken during support connections."
            locked
            action={<button className="text-[13px] font-semibold text-blue-600 hover:underline whitespace-nowrap">Upgrade plan</button>}
          />
          <SettingRow
            icon={Server}
            title="Inherit device group permissions to devices"
            description={<>Device managers inherit permissions from the device group level. <a href="#" className="text-blue-600 hover:underline">Learn more</a></>}
            action={<Toggle checked={inheritDeviceGroupPerms} onChange={v => setInheritDeviceGroupPerms(v)} />}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex w-full h-full bg-white font-sans">
      {/* Sidebar */}
      <div className="w-[280px] bg-white border-r border-[rgba(0,0,0,0.06)] flex flex-col overflow-y-auto custom-scrollbar flex-shrink-0 pt-6">
         {SIDEBAR_SECTIONS.map((section, idx) => (
           <div key={idx} className="mb-6">
             <h4 className="px-6 text-[10px] font-bold text-[#757575] uppercase tracking-[0.1em] mb-2">{section.title}</h4>
             <div className="flex flex-col gap-0.5 px-3">
               {section.items.map(item => {
                 const isActive = activeTab === item.id;
                 const Icon = item.icon;
                 return (
                   <button
                     key={item.id}
                     onClick={() => setActiveTab(item.id)}
                     className={`flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-[#EBF0FC] text-[#1C369B]' : 'text-[#4A4A4A] hover:bg-[#F9FAFB]'}`}
                   >
                     <div className="flex items-center gap-3">
                       <Icon size={16} className={isActive ? 'text-[#1C369B]' : 'text-[#757575]'} />
                       <span className={`text-[13px] ${isActive ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                     </div>
                     {item.isNew && (
                       <span className="px-2 py-0.5 bg-[#DCF4DC] text-[#2E7A2E] text-[10px] font-bold uppercase tracking-widest rounded">New</span>
                     )}
                   </button>
                 );
               })}
             </div>
           </div>
         ))}
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-white overflow-y-auto custom-scrollbar relative">
         {activeTab === 'overview' ? <OverviewTab user={user} /> : 
          activeTab === 'general' ? renderGeneralTab() : 
          activeTab === 'security' ? <SecurityCenterTab /> : 
          <div className="flex items-center justify-center h-full text-[#757575] text-sm">
             Content for {SIDEBAR_SECTIONS.flatMap(s => s.items).find(i => i.id === activeTab)?.label} coming soon.
          </div>}
      </div>
    </div>
  );
};
