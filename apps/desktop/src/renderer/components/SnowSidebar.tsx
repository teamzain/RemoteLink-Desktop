import React from 'react';
import logo from '../assets/logo.png';
import {
  Link,
  LayoutGrid,
  Monitor,
  Settings,
  CreditCard,
  User,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Users,
  MessageSquare,
  ShoppingBag,
  PieChart,
  Radio,
  BookOpen,
  LifeBuoy,
  LogOut,
  Building2,
  TrendingUp,
  Zap
} from 'lucide-react';

interface SnowSidebarProps {
  currentView: 'dashboard' | 'devices' | 'settings' | 'host' | 'billing' | 'documentation' | 'profile' | 'support' | 'members' | 'organizations' | 'analytics' | 'connect' | 'org-detail';
  selectedDevice: any;
  setCurrentView: (view: 'dashboard' | 'devices' | 'settings' | 'host' | 'billing' | 'documentation' | 'profile' | 'support' | 'members' | 'organizations' | 'analytics' | 'connect') => void;
  setSelectedDevice: (device: any) => void;
  handleLogout: () => void;
  user: any;
  isOpen?: boolean;
  onClose?: () => void;
}

export const SnowSidebar: React.FC<SnowSidebarProps> = ({
  currentView,
  selectedDevice,
  setCurrentView,
  setSelectedDevice,
  handleLogout,
  user,
  isOpen,
  onClose
}) => {
  const isDashboard = currentView === 'dashboard' && !selectedDevice;
  const isDevices = currentView === 'devices' && !selectedDevice;
  const isSettings = currentView === 'settings' && !selectedDevice;
  const isHost = currentView === 'host' && !selectedDevice;
  const isBilling = currentView === 'billing' && !selectedDevice;
  const isDocs = currentView === 'documentation' && !selectedDevice;
  const isProfile = currentView === 'profile' && !selectedDevice;
  const isSupport = currentView === 'support' && !selectedDevice;
  const isMembers = currentView === 'members' && !selectedDevice;
  const isOrgs = currentView === 'organizations' && !selectedDevice;
  const isAnalytics = currentView === 'analytics' && !selectedDevice;

  const userRole = user?.role || 'USER';
  const userPlan = user?.plan || 'FREE';
  const isRestricted = userPlan === 'FREE' || userPlan === 'PRO';
  const canManageTeam = (userRole === 'SUB_ADMIN' || userRole === 'SUPER_ADMIN') && !isRestricted;
  const canManageOrgs = userRole === 'SUPER_ADMIN';

  const navItemClass = (isActive: boolean) => `
    relative flex items-center w-full h-8 px-3 rounded-lg transition-all duration-200 group
    ${isActive ? 'bg-[rgba(28,28,28,0.05)]' : 'hover:bg-[rgba(28,28,28,0.02)]'}
  `;

  const textClass = (isActive: boolean) => `
    text-sm font-normal leading-5 transition-colors
    ${isActive ? 'text-[#1C1C1C]' : 'text-[#1C1C1C] opacity-80 group-hover:opacity-100'}
  `;

  const indicatorClass = (isActive: boolean) => `
    absolute left-0 top-2 w-1.5 h-4 bg-[#1C1C1C] rounded-r-lg transition-opacity
    ${isActive ? 'opacity-100' : 'opacity-0'}
  `;

  return (
    <aside className={`fixed left-0 top-0 bottom-0 w-[212px] bg-white border-r border-[rgba(28,28,28,0.08)] flex flex-col font-inter z-30 shadow-sm overflow-hidden transition-transform duration-300 md:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>

      {/* Brand Logo Section */}
      <div className="flex items-center gap-3 px-5 pt-8 mb-10 group cursor-pointer" onClick={() => setCurrentView('dashboard')}>
        <div className="w-10 h-10 rounded-xl bg-[#1C1C1C] flex items-center justify-center shadow-lg shadow-black/10 overflow-hidden border border-white/5">
          <img src={logo} alt="Sync" className="w-8 h-8 object-contain" />
        </div>
        <div className="flex flex-col">
          <span className="text-lg font-bold text-[#1C1C1C] leading-none tracking-tighter">Connect-X</span>
        </div>
      </div>

      {/* Main Navigation Scroll Area */}
      <div className="flex-1 overflow-y-auto px-4 custom-scrollbar pb-10 space-y-9">


        {/* Dashboards Section */}
        <div className="flex flex-col gap-2">
          <span className="px-3 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-[0.1em]">Dashboards</span>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { setCurrentView('dashboard'); setSelectedDevice(null); }}
              className={navItemClass(isDashboard)}
            >
              <div className={indicatorClass(isDashboard)} />
              <div className="flex items-center gap-2.5">
                <PieChart size={16} className={isDashboard ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isDashboard)}>Overview</span>
              </div>
            </button>

            <button
              onClick={() => { setCurrentView('host'); setSelectedDevice(null); }}
              className={navItemClass(isHost)}
            >
              <div className={indicatorClass(isHost)} />
              <div className="flex items-center gap-2.5">
                <Radio size={16} className={isHost ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isHost)}>Host Device</span>
              </div>
            </button>

            <button
              onClick={() => { setCurrentView('connect'); setSelectedDevice(null); }}
              className={navItemClass(currentView === 'connect')}
            >
              <div className={indicatorClass(currentView === 'connect')} />
              <div className="flex items-center gap-2.5">
                <Zap size={16} className={currentView === 'connect' ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(currentView === 'connect')}>Quick Connect</span>
              </div>
            </button>

            <button
              onClick={() => { setCurrentView('devices'); setSelectedDevice(null); }}
              className={navItemClass(isDevices)}
            >
              <div className={indicatorClass(isDevices)} />
              <div className="flex items-center gap-2.5">
                <Monitor size={16} className={isDevices ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isDevices)}>All Devices</span>
              </div>
            </button>
          </div>
        </div>

        {/* System & Pages Section */}
        <div className="flex flex-col gap-2">
          <span className="px-3 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-[0.1em]">System</span>
          <div className="flex flex-col gap-1">
            <button
              onClick={() => { setCurrentView('settings'); setSelectedDevice(null); }}
              className={navItemClass(isSettings || isProfile)}
            >
              <div className={indicatorClass(isSettings || isProfile)} />
              <div className="flex items-center gap-2.5">
                <Settings size={16} className={isSettings || isProfile ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isSettings || isProfile)}>Settings</span>
              </div>
            </button>

            {canManageTeam && (
              <button
                onClick={() => { setCurrentView('members'); setSelectedDevice(null); }}
                className={navItemClass(isMembers)}
              >
                <div className={indicatorClass(isMembers)} />
                <div className="flex items-center gap-2.5">
                  <Users size={16} className={isMembers ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                  <span className={textClass(isMembers)}>Members</span>
                </div>
              </button>
            )}

            {canManageOrgs && (
              <>
                <button
                  onClick={() => { setCurrentView('organizations'); setSelectedDevice(null); }}
                  className={navItemClass(isOrgs)}
                >
                  <div className={indicatorClass(isOrgs)} />
                  <div className="flex items-center gap-2.5">
                    <Building2 size={16} className={isOrgs ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                    <span className={textClass(isOrgs)}>Organizations</span>
                  </div>
                </button>

                <button
                  onClick={() => { setCurrentView('analytics'); setSelectedDevice(null); }}
                  className={navItemClass(isAnalytics)}
                >
                  <div className={indicatorClass(isAnalytics)} />
                  <div className="flex items-center gap-2.5">
                    <TrendingUp size={16} className={isAnalytics ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                    <span className={textClass(isAnalytics)}>Platform Analytics</span>
                  </div>
                </button>
              </>
            )}

            <button
              onClick={() => { setCurrentView('documentation'); setSelectedDevice(null); }}
              className={navItemClass(isDocs)}
            >
              <div className={indicatorClass(isDocs)} />
              <div className="flex items-center gap-2.5">
                <BookOpen size={16} className={isDocs ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isDocs)}>Documentation</span>
              </div>
            </button>
          </div>
        </div>

        {/* Account Section */}
        <div className="flex flex-col gap-2">
          <span className="px-3 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-[0.1em]">Account</span>
          <div className="flex flex-col gap-1">
            {userRole !== 'SUPER_ADMIN' && (
              <button
                onClick={() => { setCurrentView('billing'); setSelectedDevice(null); }}
                className={navItemClass(isBilling)}
              >
                <div className={indicatorClass(isBilling)} />
                <div className="flex items-center gap-2.5">
                  <CreditCard size={16} className={isBilling ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                  <span className={textClass(isBilling)}>Subscriptions</span>
                </div>
              </button>
            )}

            <button
              onClick={() => { setCurrentView('support'); setSelectedDevice(null); }}
              className={navItemClass(isSupport)}
            >
              <div className={indicatorClass(isSupport)} />
              <div className="flex items-center gap-2.5">
                <LifeBuoy size={16} className={isSupport ? 'text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)]'} />
                <span className={textClass(isSupport)}>Support Hub</span>
              </div>
            </button>
          </div>
        </div>

      </div>

      {/* Footer Branding & Logout */}
      <div className="mt-auto p-4 border-t border-[rgba(28,28,28,0.04)] bg-[#F8F9FA]/30">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-xl border border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] text-[11px] font-bold text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C] transition-all bg-white shadow-sm"
        >
          <LogOut size={14} /> Logout Session
        </button>
      </div>

    </aside>
  );
};
