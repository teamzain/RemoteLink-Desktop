import React from 'react';
import { Home, Headphones, Monitor, MessageSquare, Settings, HelpCircle, MessageCircle, MoreHorizontal, ChevronRight, Eye, EyeOff, RefreshCw, Plus, Radio, Globe, Copy, Zap, ArrowRight, ShieldCheck, User } from 'lucide-react';
import { t } from '../lib/translations';

interface SnowPremiumDashboardProps {
  user: any;
  localAuthKey: string | null;
  devicePassword: string;
  onNavigate: (view: any) => void;
  onConnect: (partnerId?: string) => void;
  onOpenSetPassword: () => void;
  formatCode: (code: string) => string;
  onCopyAccessKey?: () => void;
  onCreateSession?: () => void;
  onJoinSession?: () => void;
  onEnableRemoteAccess?: () => void;
  hasContacts?: boolean;
  hasRemoteAccess?: boolean;
}

export const SnowPremiumDashboard: React.FC<SnowPremiumDashboardProps> = ({
  user,
  localAuthKey,
  devicePassword,
  onNavigate,
  onConnect,
  onOpenSetPassword,
  formatCode,
  onCopyAccessKey,
  onCreateSession,
  onJoinSession,
  onEnableRemoteAccess,
  hasContacts = false,
  hasRemoteAccess = false,
}) => {
  const [showPwd, setShowPwd] = React.useState(false);
  const [partnerId, setPartnerId] = React.useState('');

  const userName = user?.name?.split(' ')[0] || 'User';
  const lang = user?.language;
  const cleanPartnerId = partnerId.replace(/\D/g, '');
  const formattedPartnerId = formatCode(partnerId);
  const onboardingTasks = [
    {
      id: 'photo',
      label: t('upload_photo', lang),
      completed: Boolean(user?.avatar),
      action: () => onNavigate('profile'),
    },
    {
      id: 'contact',
      label: t('add_contact', lang),
      completed: hasContacts,
      action: () => onNavigate('chat'),
    },
    {
      id: 'remote',
      label: t('setup_remote_access', lang),
      completed: hasRemoteAccess,
      action: () => {
        onEnableRemoteAccess?.();
      },
    },
  ];
  const incompleteOnboardingTasks = onboardingTasks.filter((task) => !task.completed);
  const completedTaskCount = onboardingTasks.length - incompleteOnboardingTasks.length;
  const showGettingStarted = incompleteOnboardingTasks.length > 0;
  const dashboardStats = [
    { label: 'Remote ID', value: formatCode(localAuthKey || '') || 'Preparing', icon: ShieldCheck },
    { label: 'Easy Access', value: hasRemoteAccess ? 'Ready' : 'Setup needed', icon: Monitor },
    { label: 'Contacts', value: hasContacts ? 'Available' : 'Add first', icon: MessageCircle },
    { label: 'Plan', value: user?.plan || 'TRIAL', icon: Zap },
  ];

  const handlePartnerIdChange = (value: string) => {
    setPartnerId(value.replace(/\D/g, '').slice(0, 9));
  };

  const handleConnect = () => {
    if (cleanPartnerId.length < 6) return;
    onConnect(cleanPartnerId);
  };

  return (
    <div className="h-full w-full flex flex-col p-8 bg-[#F4F7F9] font-lato overflow-hidden rounded-bl-[24px]">
      {/* Top Title Row */}
      <div className="flex items-center gap-2 mb-6 flex-shrink-0">
        <h1 className="text-[28px] font-normal text-[#1C1C1C]">{t('hi', lang)} {userName}</h1>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 flex-shrink-0">
        {dashboardStats.map((item) => (
          <div key={item.label} className="bg-white rounded-lg border border-[rgba(0,0,0,0.06)] px-4 py-3 shadow-sm flex items-center gap-3 min-h-[72px]">
            <div className="w-9 h-9 rounded-lg bg-[#F4F7F9] flex items-center justify-center text-[#1D6DF5] shrink-0">
              <item.icon size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase text-[#757575]">{item.label}</p>
              <p className="text-sm font-semibold text-[#1C1C1C] truncate">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Top Cards Row - Takes up remaining flexible space */}
      <div className={`grid grid-cols-1 ${showGettingStarted ? 'lg:grid-cols-2' : 'lg:grid-cols-1'} gap-6 mb-8 flex-1 min-h-0`}>
        {/* Getting Started Card */}
        {showGettingStarted && (
          <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm flex flex-col h-full overflow-y-auto custom-scrollbar">
            <h2 className="text-xl font-medium text-[#1C1C1C] mb-1">{t('getting_started', lang)}</h2>
            <p className="text-sm text-[#757575] mb-6">{completedTaskCount} of {onboardingTasks.length} {t('tasks_completed', lang)}</p>

            <div className="space-y-5">
              {incompleteOnboardingTasks.map((task) => (
                <button key={task.id} type="button" onClick={task.action} className="w-full flex items-center gap-5 group text-left">
                  <div className="w-8 h-8 rounded-full border-2 border-[#D1D1D1] flex items-center justify-center group-hover:border-blue-500 transition-colors shrink-0" />
                  <span className="text-base text-[#1C1C1C] font-normal group-hover:text-blue-600">{task.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Connect with ID Card */}
        <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm flex flex-col h-full overflow-y-auto custom-scrollbar">
          <h2 className="text-xl font-medium text-[#1C1C1C] mb-2">{t('connect_with_id', lang)}</h2>
          <p className="text-sm text-[#757575] mb-6">{t('id_desc', lang)}</p>

          <div className="bg-[#F8F9FA] rounded-lg border border-[rgba(0,0,0,0.06)] flex items-stretch mb-6 h-16 shrink-0">
            <div className="flex-1 px-5 flex flex-col justify-center border-r border-[rgba(0,0,0,0.06)]">
              <label className="text-[10px] font-bold text-[#757575] uppercase mb-1">{t('your_id', lang)}</label>
              <div className="flex items-center justify-between">
                <span className="text-lg font-normal text-[#1C1C1C] tracking-tight">{formatCode(localAuthKey || '')}</span>
                <button type="button" onClick={onCopyAccessKey} className="text-[#757575] hover:text-[#1C1C1C]"><Copy size={16} /></button>
              </div>
            </div>
            <div className="flex-1 px-5 flex flex-col justify-center relative">
              <label className="text-[10px] font-bold text-[#757575] uppercase mb-1">{t('password', lang)}</label>
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
            <p className="text-sm text-[#757575] mb-4">{t('connect_desc', lang)}</p>
            <div className="flex gap-2">
              <div className="flex-1">
                <input 
                  type="text" 
                  placeholder={t('partner_id', lang)}
                  value={formattedPartnerId}
                  onChange={(e) => handlePartnerIdChange(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleConnect();
                    }
                  }}
                  className="w-full h-11 px-4 bg-white border border-[#D1D1D1] rounded-lg text-sm focus:border-blue-500 outline-none transition-all"
                />
              </div>
              <button 
                onClick={handleConnect}
                disabled={cleanPartnerId.length < 6}
                className="h-11 px-6 bg-white border border-[#D1D1D1] text-[#1C1C1C] rounded-lg text-sm font-medium hover:bg-[#F8F9FA] active:bg-[#EAECEF] disabled:opacity-50 transition-all shrink-0"
              >
                {t('connect', lang)}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Remote actions row - Fixed Height */}
      <div className="flex-shrink-0">
        <h3 className="text-base font-medium text-[#1C1C1C] mb-4">{t('remote_actions', lang)}</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <button type="button" onClick={onCreateSession} className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm group cursor-pointer hover:border-blue-300 transition-all h-48 flex flex-col text-left">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center text-white mb-4 shrink-0">
              <Plus size={20} />
            </div>
            <h3 className="text-base font-medium text-[#1C1C1C] mb-2">{t('create_session', lang)}</h3>
            <p className="text-xs text-[#757575] leading-relaxed line-clamp-2">{t('create_session_desc', lang)}</p>
          </button>

          <button type="button" onClick={onJoinSession} className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm group cursor-pointer hover:border-blue-300 transition-all h-48 flex flex-col text-left">
            <div className="w-10 h-10 bg-[#001F3F] rounded-lg flex items-center justify-center text-white mb-4 shrink-0">
              <Radio size={20} />
            </div>
            <h3 className="text-base font-medium text-[#1C1C1C] mb-2">{t('join_session', lang)}</h3>
            <p className="text-xs text-[#757575] leading-relaxed line-clamp-2">{t('join_session_desc', lang)}</p>
          </button>

          <button type="button" onClick={onEnableRemoteAccess} className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm group cursor-pointer hover:border-blue-300 transition-all h-48 flex flex-col text-left">
            <div className="w-10 h-10 bg-orange-600 rounded-lg flex items-center justify-center text-white mb-4 shrink-0">
              <Monitor size={20} />
            </div>
            <h3 className="text-base font-medium text-[#1C1C1C] mb-2">{t('setup_remote_access', lang)}</h3>
            <p className="text-xs text-[#757575] leading-relaxed line-clamp-2">{t('setup_remote_access_anytime', lang)}</p>
          </button>

          <button type="button" onClick={() => window.open('https://remote365.ai', '_blank', 'noopener,noreferrer')} className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] p-6 shadow-sm group cursor-pointer hover:border-blue-300 transition-all h-48 flex flex-col text-left">
            <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white mb-4 shrink-0">
              <Globe size={20} />
            </div>
            <h3 className="text-base font-medium text-[#1C1C1C] mb-2">{t('web_access', lang)}</h3>
            <p className="text-xs text-[#757575] leading-relaxed line-clamp-2">{t('web_access_desc', lang)}</p>
          </button>
        </div>
      </div>
    </div>
  );
};
