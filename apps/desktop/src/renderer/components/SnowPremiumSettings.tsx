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

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync local state if user object in store changes
  useEffect(() => {
    if (user) {
      setDisplayName(user.name || '');
      setLanguage(user.language || 'en');
      setIsRestricted(user.notify_session_alert ?? true);
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
    { id: 'Account', label: t('account', user?.language), icon: User },
    { id: 'Licenses', label: 'Licenses', icon: CheckCircle2 },
    { id: 'Active sign-ins', label: 'Active sign-ins', icon: Monitor },
    { id: 'Connection reports', label: 'Connection reports', icon: Shield },
    { id: 'Apps & Tokens', label: 'Apps & Tokens', icon: Package },
    { id: 'Customization', label: 'Customization', icon: SettingsIcon },
  ];

  const deviceItems = [
    { id: 'General', label: 'General', icon: SettingsIcon },
    { id: 'Security', label: 'Security', icon: Shield },
    { id: 'Network', label: 'Network', icon: Wifi },
    { id: 'Remote control', label: 'Remote control', icon: Monitor },
    { id: 'Audio and video', label: 'Audio and video', icon: Video },
    { id: 'Device management', label: 'Device management', icon: Package },
    { id: 'Advanced settings', label: 'Advanced settings', icon: SettingsIcon },
    { id: 'Notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="h-full w-full flex bg-[#F4F7F9] rounded-bl-[24px] overflow-hidden font-lato">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleAvatarUpload} 
        accept="image/*" 
        className="hidden" 
      />

      {/* Inner Sidebar */}
      <div className="w-64 bg-white border-r border-[rgba(0,0,0,0.06)] flex flex-col overflow-y-auto">
        <div className="py-4">
          <div className="px-6 mb-2">
            <span className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">Profile</span>
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
            <span className="text-[10px] font-bold text-[#757575] uppercase tracking-wider">Device</span>
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
      <div className="flex-1 overflow-y-auto bg-white p-10 custom-scrollbar relative">
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
                  <h1 className="text-[28px] font-normal text-[#1C1C1C] leading-none mb-1">{t('account', user?.language)}</h1>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-[#757575]">Set your basic settings for your Remote 365 account.</p>
                    {(showSaved || isLoading) && (
                      <span className="text-xs text-emerald-500 font-medium animate-in fade-in slide-in-from-left-2 duration-300 flex items-center gap-1">
                        {isLoading ? <Loader2 size={12} className="animate-spin" /> : '•'} {isLoading ? 'Saving...' : t('save_changes', user?.language)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm">
                {/* Profile Picture */}
                <div className="p-6 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#F4F7F9] flex items-center justify-center mt-1 overflow-hidden border border-[rgba(0,0,0,0.05)]">
                      {user?.avatar ? (
                        <img src={user.avatar} alt="Profile" className="w-full h-full object-cover" />
                      ) : (
                        <User size={24} className="text-[#757575]" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C]">Profile picture</h3>
                      <p className="text-sm text-[#757575]">The profile picture helps your Remote 365 contacts recognize you.</p>
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
                <div className="p-6 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between group transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center mt-1">
                      <User size={20} className="text-[#757575]" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-[#1C1C1C]">Name</h3>
                      <p className="text-sm text-[#757575]">Choose the name you want to display - it can be your first name, full name, or a nickname.</p>
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
                        className="bg-white border border-blue-500 text-[#1C1C1C] text-sm rounded-lg block p-2 outline-none w-48 shadow-[0_0_8px_rgba(59,130,246,0.1)]"
                      />
                    </div>
                  ) : (
                    <span 
                      onClick={() => setIsEditingName(true)}
                      className="text-sm text-[#1C1C1C] cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors border border-transparent hover:border-[rgba(0,0,0,0.05)]"
                    >
                      {displayName || 'Set your name'}
                    </span>
                  )}
                </div>

                {/* Email */}
                <div className="p-6 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between group cursor-default hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center mt-1">
                      <Package size={20} className="text-[#757575]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C]">Email</h3>
                      <p className="text-sm text-[#757575]">See the email address assigned to your Remote 365 account.</p>
                    </div>
                  </div>
                  <span className="text-sm text-[#757575] font-mono">{user?.email || 'No email assigned'}</span>
                </div>

                {/* Display Language */}
                <div className="p-6 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between group cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center mt-1">
                      <SettingsIcon size={20} className="text-[#757575]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C]">{t('language', user?.language)}</h3>
                      <p className="text-sm text-[#757575]">Remote 365 speaks many languages—choose your preferred one.</p>
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
                    className="bg-white border border-[#D1D1D1] text-[#1C1C1C] text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2 outline-none cursor-pointer hover:border-gray-400 transition-colors disabled:opacity-50"
                  >
                    <option value="en">English</option>
                    <option value="de">German</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                  </select>
                </div>

                {/* Status restrictions */}
                <div className="p-6 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between group cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center mt-1">
                      <Shield size={20} className="text-[#757575]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C]">Status and messaging restrictions</h3>
                      <p className="text-sm text-[#757575]">Only users in your contact list can see your status and send you messages.</p>
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
                <div className="p-6 flex items-center justify-between group cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-transparent flex items-center justify-center mt-1">
                      <User size={20} className="text-[#757575]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C]">Delete account</h3>
                      <p className="text-sm text-[#757575]">All the data related to your account will be deleted. After deleting it, you cannot go back.</p>
                    </div>
                  </div>
                  <button className="text-sm font-medium text-red-600 hover:text-red-700 transition-colors">
                    Delete
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
                  <h1 className="text-[28px] font-normal text-[#1C1C1C] leading-none mb-1">Licenses</h1>
                  <p className="text-sm text-[#757575]">Upgrade to a license that best fits your needs.</p>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-[rgba(0,0,0,0.06)] shadow-sm overflow-hidden">
                {/* Free */}
                <div className="p-8 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between hover:bg-gray-50/30 transition-colors">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1C1C1C] mb-1">Free</h3>
                    <p className="text-xs text-[#757575]">0 channels</p>
                  </div>
                  <button className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">Upgrade license</button>
                </div>

                {/* IoT Free */}
                <div className="p-8 border-b border-[rgba(0,0,0,0.06)] flex items-center justify-between hover:bg-gray-50/30 transition-colors">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1C1C1C] mb-1">IoT Free</h3>
                    <p className="text-xs text-[#757575]">0 / 0 endpoints</p>
                  </div>
                </div>

                {/* Monitoring */}
                <div className="p-8 flex items-center justify-between hover:bg-gray-50/30 transition-colors">
                  <div>
                    <h3 className="text-sm font-semibold text-[#1C1C1C] mb-1">Monitoring</h3>
                    <p className="text-xs text-[#757575]">Trial - 14 days left</p>
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
                  <h1 className="text-[28px] font-normal text-[#1C1C1C] leading-none mb-1">Customization</h1>
                  <p className="text-sm text-[#757575]">Adjust your preferences and decide RemoteLink's look and feel.</p>
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
                        <h3 className="text-sm font-medium text-[#1C1C1C]">Dark Mode</h3>
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold uppercase rounded-md border border-blue-100">Beta</span>
                      </div>
                      <p className="text-sm text-[#757575]">Switch to dark mode for eye-friendly app usage at night.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={darkMode} onChange={() => setDarkMode(!darkMode)} />
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
                      <h3 className="text-sm font-medium text-[#1C1C1C] mb-1">Search action behavior</h3>
                      <p className="text-sm text-[#757575] max-w-lg">Choose what happens when you press Enter or click. The opposite action will automatically trigger when you use Alt+Enter.</p>
                    </div>
                  </div>
                  <select 
                    value={searchBehavior}
                    onChange={(e) => setSearchBehavior(e.target.value)}
                    className="bg-white border border-[#D1D1D1] text-[#1C1C1C] text-sm rounded-lg block p-2 outline-none cursor-pointer w-48"
                  >
                    <option>Search for result</option>
                    <option>Direct connect</option>
                  </select>
                </div>

                {/* Use new interface */}
                <div className="flex items-center justify-between p-2">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 flex items-center justify-center shrink-0 mt-0.5">
                      <SettingsIcon size={20} className="text-[#757575]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-[#1C1C1C] mb-1">Use new RemoteLink interface</h3>
                      <p className="text-sm text-[#757575] max-w-lg">Choose which RemoteLink interface you want to use – either the new and improved experience or the classic interface.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={useNewInterface} onChange={() => setUseNewInterface(!useNewInterface)} />
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
                      <h3 className="text-sm font-medium text-[#1C1C1C] mb-1">In-product marketing messages</h3>
                      <p className="text-sm text-[#757575]">Receive updates about new products and features through in-app messages.</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={marketingMessages} onChange={() => setMarketingMessages(!marketingMessages)} />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-[#757575] animate-in fade-in duration-300">
              <SettingsIcon size={48} className="mb-4 opacity-20" />
              <p className="text-base font-medium">Settings for {activeTab} will be available soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
