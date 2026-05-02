import React, { useState, useRef, useEffect } from 'react';
import { User, Shield, Wifi, Monitor, Video, Bell, Package, CheckCircle2, ChevronRight, Settings as SettingsIcon, LogOut, Edit3, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { t } from '../lib/translations';

interface SnowPremiumSettingsProps {
  user: any;
  logout?: () => void;
}

export const SnowPremiumSettings: React.FC<SnowPremiumSettingsProps> = ({ user: initialUser, logout }) => {
  const { user, updateProfile, isLoading } = useAuthStore();
  const lang = user?.language;
  const [activeTab, setActiveTab] = useState('Account');
  const [displayName, setDisplayName] = useState(user?.name || 'User');
  const [language, setLanguage] = useState(user?.language || 'en');
  const [isRestricted, setIsRestricted] = useState(user?.notify_session_alert ?? true);
  const [isEditingName, setIsEditingName] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  
  // Customization state
  const [darkMode, setDarkMode] = useState(false);
  const [searchBehavior, setSearchBehavior] = useState('Search for result');
  const [useNewInterface, setUseNewInterface] = useState(true);
  const [marketingMessages, setMarketingMessages] = useState(false);
  const [fontSize, setFontSize] = useState(16);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state if user object in store changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.name || '');
      setLanguage(user.language || 'en');
      setIsRestricted(user.notify_session_alert ?? true);
      setDarkMode(user.darkMode ?? false);
      setSearchBehavior(user.searchBehavior || 'Search for result');
      setUseNewInterface(user.useNewInterface ?? true);
      setMarketingMessages(user.marketingMessages ?? false);
      setFontSize(user.fontSize || 16);
    }
  }, [user]);

  const triggerSave = async (data: any) => {
    try {
      await updateProfile(data);
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (e.g., 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('File too large. Max 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      await triggerSave({ avatar: base64String });
    };
    reader.readAsDataURL(file);
  };

  const profileItems = [
    { id: 'Account', label: t('account', lang), icon: User },
    { id: 'Licenses', label: t('licenses', lang), icon: CheckCircle2 },
    { id: 'Active sign-ins', label: t('active_sign_ins', lang), icon: Monitor },
    { id: 'Connection reports', label: t('connection_reports', lang), icon: Shield },
    { id: 'Apps & Tokens', label: t('apps_tokens', lang), icon: Package },
    { id: 'Customization', label: t('customization', lang), icon: SettingsIcon },
  ];

  const deviceItems = [
    { id: 'General', label: t('general', lang), icon: SettingsIcon },
    { id: 'Security', label: t('security_label', lang), icon: Shield },
    { id: 'Network', label: t('network_label', lang), icon: Wifi },
    { id: 'Remote control', label: t('remote_control', lang), icon: Monitor },
    { id: 'Audio and video', label: t('audio_video', lang), icon: Video },
    { id: 'Device management', label: t('device_management_label', lang), icon: Package },
    { id: 'Advanced settings', label: t('advanced_settings', lang), icon: SettingsIcon },
    { id: 'Notifications', label: t('notifications_label', lang), icon: Bell },
  ];

  return (
    <div className="h-full w-full flex bg-[#F4F7F9] dark:bg-[#0A0A0A] rounded-bl-[24px] overflow-hidden font-lato transition-colors duration-300">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleAvatarUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Inner Sidebar */}
      <div className="w-64 bg-white dark:bg-[#0F0F0F] border-r border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] flex flex-col overflow-y-auto transition-colors duration-300">
        <div className="py-4">
          <div className="px-6 mb-2">
            <span className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">{t('profile', lang)}</span>
          </div>
          {profileItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-blue-50/50 text-blue-600 font-medium' : 'text-[#1C1C1C] hover:bg-gray-50'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-blue-600' : 'text-[#757575]'} />
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="py-2">
          <div className="px-6 mb-2">
            <span className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">{t('device', lang)}</span>
          </div>
          {deviceItems.map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                  isActive ? 'bg-blue-50/50 text-blue-600 font-medium' : 'text-[#1C1C1C] hover:bg-gray-50'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-blue-600' : 'text-[#757575]'} />
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-[#141414] p-10 custom-scrollbar relative transition-colors duration-300">
        <div className="max-w-4xl mx-auto">
          {activeTab === 'Account' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white relative overflow-hidden">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User size={20} />
                  )}
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-[28px] font-normal text-[#1C1C1C] dark:text-[#F5F5F5] leading-none mb-1">{t('account', lang)}</h1>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[#757575]">{t('account_desc', lang)}</p>
                    {(showSaved || isLoading) && (
                      <span className="text-xs text-emerald-500 font-medium animate-in fade-in slide-in-from-left-2 duration-300 flex items-center gap-1">
                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : '•'} {isLoading ? t('saving', lang) : t('save_changes', lang)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] shadow-sm">
                {/* Profile Picture */}
                <div className="p-6 border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#F4F7F9] dark:bg-white/5 flex items-center justify-center mt-1 overflow-hidden border border-[rgba(0,0,0,0.05)]">
                      {user?.avatar ? (
                        <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} className="text-[#757575]" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5]">{t('profile_picture', lang)}</h3>
                      <p className="text-sm text-[#757575] dark:text-[#A0A0A0]">{t('profile_picture_desc', lang)}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isLoading}
                    className="w-10 h-10 bg-[#001F3F] hover:bg-[#003366] text-white rounded-full flex items-center justify-center transition-colors shrink-0 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 size={16} className="animate-spin" /> : <Edit3 size={16} />}
                  </button>
                </div>

                {/* Name */}
                <div className="p-6 border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between group transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center mt-1">
                      <User size={20} className="text-[#757575] dark:text-[#A0A0A0]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5]">{t('name_label', lang)}</h3>
                      <p className="text-sm text-[#757575] dark:text-[#A0A0A0]">{t('name_desc', lang)}</p>
                    </div>
                  </div>
                  {isEditingName ? (
                    <div className="flex items-center gap-2">
                      <input 
                        type="text" 
                        value={displayName} 
                        onChange={(e) => setDisplayName(e.target.value)}
                        onBlur={() => { 
                          setIsEditingName(false); 
                          if (displayName !== user?.name) triggerSave({ name: displayName }); 
                        }}
                        onKeyDown={(e) => { 
                          if (e.key === 'Enter') { 
                            setIsEditingName(false); 
                            if (displayName !== user?.name) triggerSave({ name: displayName }); 
                          } 
                        }}
                        autoFocus
                        className="bg-white dark:bg-[#141414] border border-blue-500 text-[#1C1C1C] dark:text-white text-sm rounded-lg block p-2 outline-none w-48 shadow-[0_0_8px_rgba(59,130,246,0.1)]"
                      />
                    </div>
                  ) : (
                    <span 
                      onClick={() => setIsEditingName(true)}
                      className="text-sm text-[#1C1C1C] dark:text-[#F5F5F5] cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 px-2 py-1 rounded transition-colors border border-transparent hover:border-[rgba(0,0,0,0.05)]"
                    >
                      {displayName || t('set_name_placeholder', lang)}
                    </span>
                  )}
                </div>

                {/* Email */}
                <div className="p-6 border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between group cursor-default hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center mt-1">
                      <Package size={20} className="text-[#757575] dark:text-[#A0A0A0]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5]">{t('email_label', lang)}</h3>
                      <p className="text-sm text-[#757575] dark:text-[#A0A0A0]">{t('email_desc', lang)}</p>
                    </div>
                  </div>
                  <span className="text-sm text-[#757575] font-mono">{user?.email || t('no_email_assigned', lang)}</span>
                </div>

                {/* Display Language */}
                <div className="p-6 border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between group cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center mt-1">
                      <SettingsIcon size={20} className="text-[#757575] dark:text-[#A0A0A0]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5]">{t('language', lang)}</h3>
                      <p className="text-sm text-[#757575] dark:text-[#A0A0A0]">{t('language_desc', lang)}</p>
                    </div>
                  </div>
                  <select 
                    value={language}
                    onChange={(e) => { 
                      const val = e.target.value;
                      setLanguage(val); 
                      triggerSave({ language: val }); 
                    }}
                    disabled={isLoading}
                    className="bg-white dark:bg-[#141414] border border-[#D1D1D1] dark:border-white/10 text-[#1C1C1C] dark:text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none cursor-pointer hover:border-gray-400 dark:hover:border-white/20 transition-colors disabled:opacity-50"
                  >
                    <option value="en">English</option>
                    <option value="de">German</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                  </select>
                </div>

                {/* Status restrictions */}
                <div className="p-6 border-b border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] flex items-center justify-between group cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center mt-1">
                      <Shield size={20} className="text-[#757575] dark:text-[#A0A0A0]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5]">{t('status_restrictions', lang)}</h3>
                      <p className="text-sm text-[#757575] dark:text-[#A0A0A0]">{t('status_restrictions_desc', lang)}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer" 
                      checked={isRestricted}
                      onChange={() => { 
                        const nextVal = !isRestricted;
                        setIsRestricted(nextVal); 
                        triggerSave({ notify_session_alert: nextVal }); 
                      }}
                      disabled={isLoading}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Delete Account */}
                <div className="p-6 flex items-center justify-between group cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center mt-1">
                      <User size={20} className="text-[#757575] dark:text-[#A0A0A0]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5]">{t('delete_account', lang)}</h3>
                      <p className="text-sm text-[#757575] dark:text-[#A0A0A0]">{t('delete_account_desc', lang)}</p>
                    </div>
                  </div>
                  <button className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors">
                    {t('delete_btn', lang)}
                  </button>
                </div>
              </div>
            </div>
          ) : activeTab === 'Licenses' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shadow-sm border border-blue-100">
                  <CheckCircle2 size={24} />
                </div>
                <div>
                  <h1 className="text-[28px] font-normal text-[#1C1C1C] dark:text-[#F5F5F5] leading-none mb-1">{t('licenses', lang)}</h1>
                  <p className="text-sm text-[#757575]">{t('upgrade_license_desc', lang)}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-[#1A1A1A] rounded-xl border border-[rgba(0,0,0,0.06)] dark:border-[rgba(255,255,255,0.06)] shadow-sm overflow-hidden">
                {/* Free */}
                <div className="p-8 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between hover:bg-gray-50/30 transition-colors">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1C1C1C] dark:text-[#F5F5F5] mb-1">{t('free_label', lang)}</h3>
                    <p className="text-xs text-[#757575]">0 {t('channels_label', lang)}</p>
                  </div>
                  <button className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">{t('upgrade_license_btn', lang)}</button>
                </div>

                {/* IoT Free */}
                <div className="p-8 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between hover:bg-gray-50/30 transition-colors">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1C1C1C] dark:text-[#F5F5F5] mb-1">IoT {t('free_label', lang)}</h3>
                    <p className="text-xs text-[#757575]">0 / 0 {t('endpoints_label', lang)}</p>
                  </div>
                </div>

                {/* Monitoring */}
                <div className="p-8 flex items-center justify-between hover:bg-gray-50/30 transition-colors">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1C1C1C] dark:text-[#F5F5F5] mb-1">Monitoring</h3>
                    <p className="text-xs text-[#757575]">{t('trial_days_left', lang).replace('{days}', '14')}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'Customization' ? (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex items-center gap-4 mb-10">
                <div className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center shadow-md">
                  <Monitor size={24} />
                </div>
                <div>
                  <h1 className="text-[28px] font-normal text-[#1C1C1C] dark:text-[#F5F5F5] leading-none mb-1">{t('customization', lang)}</h1>
                  <p className="text-sm text-[#757575]">{t('customization_desc', lang)}</p>
                </div>
              </div>

              <div className="space-y-6">
                {/* Dark Mode */}
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                      <SettingsIcon size={20} className="text-[#757575]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5]">{t('dark_mode', lang)}</h3>
                        <span className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase rounded-md border border-blue-100 dark:border-blue-900/40">Beta</span>
                      </div>
                      <p className="text-sm text-[#757575]">{t('dark_mode_desc', lang)}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={darkMode} onChange={() => {
                      const next = !darkMode;
                      setDarkMode(next);
                      triggerSave({ darkMode: next });
                    }} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Search action behavior */}
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                      <SettingsIcon size={20} className="text-[#757575]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5] mb-1">{t('search_behavior', lang)}</h3>
                      <p className="text-sm text-[#757575] dark:text-[#A0A0A0] max-w-lg">{t('search_behavior_desc', lang)}</p>
                    </div>
                  </div>
                  <select 
                    value={searchBehavior}
                    onChange={(e) => {
                      const val = e.target.value;
                      setSearchBehavior(val);
                      triggerSave({ searchBehavior: val });
                    }}
                    className="bg-white dark:bg-[#141414] border border-[#D1D1D1] dark:border-white/10 text-[#1C1C1C] dark:text-white text-sm rounded-lg block p-2 outline-none cursor-pointer w-48"
                  >
                    <option value="Search for result">{t('search_for_result', lang)}</option>
                    <option value="Direct connect">{t('direct_connect', lang)}</option>
                  </select>
                </div>

                {/* Use new interface */}
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                      <SettingsIcon size={20} className="text-[#757575]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5] mb-1">{t('use_new_interface', lang)}</h3>
                      <p className="text-sm text-[#757575] dark:text-[#A0A0A0] max-w-lg">{t('use_new_interface_desc', lang)}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={useNewInterface} onChange={() => {
                      const next = !useNewInterface;
                      setUseNewInterface(next);
                      triggerSave({ useNewInterface: next });
                    }} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Marketing messages */}
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                      <SettingsIcon size={20} className="text-[#757575]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5] mb-1">{t('marketing_messages', lang)}</h3>
                      <p className="text-sm text-[#757575] dark:text-[#A0A0A0]">{t('marketing_messages_desc', lang)}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={marketingMessages} onChange={() => {
                      const next = !marketingMessages;
                      setMarketingMessages(next);
                      triggerSave({ marketingMessages: next });
                    }} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {/* Font Size */}
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                      <SettingsIcon size={20} className="text-[#757575]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5] mb-1">{t('font_size', lang)}</h3>
                      <p className="text-sm text-[#757575] dark:text-[#A0A0A0]">{t('font_size_desc', lang)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 w-48">
                    <input 
                      type="range" 
                      min="12" 
                      max="24" 
                      step="1"
                      value={fontSize}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setFontSize(val);
                      }}
                      onMouseUp={() => triggerSave({ fontSize })}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                    <span className="text-sm font-medium text-[#1C1C1C] dark:text-[#F5F5F5] w-8">{fontSize}px</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-[#757575] animate-in fade-in duration-300">
              <SettingsIcon size={48} className="mb-4 opacity-20" />
              <p className="text-base font-medium">{t('settings_soon', lang).replace('{tab}', activeTab)}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
