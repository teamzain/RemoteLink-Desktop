import React from 'react';
import logo from '../assets/logo.png';
import { Home, Headphones, Monitor, MessageSquare, Settings, HelpCircle, MessageCircle, MoreHorizontal, ChevronRight, Menu, ChevronLeft, Bell } from 'lucide-react';
import { t } from '../lib/translations';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: any) => void;
  handleLogout: () => void;
  user: any;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  showNotifications?: boolean;
  setShowNotifications?: (show: boolean) => void;
}

export const SnowPremiumSidebar: React.FC<SidebarProps> = ({ 
  currentView, 
  setCurrentView, 
  handleLogout, 
  user, 
  isCollapsed, 
  onToggleCollapse,
  showNotifications,
  setShowNotifications
}) => {
  const navItems = [
    { id: 'dashboard', label: t('home', user?.language), icon: Home },
    { id: 'connect', label: t('remote_support', user?.language), icon: Headphones },
    { id: 'devices', label: t('devices', user?.language), icon: Monitor },
    { id: 'chat', label: t('chat', user?.language), icon: MessageSquare },
  ];

  const bottomItems = [
    { id: 'notifications', label: t('notifications', user?.language), icon: Bell },
    { id: 'settings', label: t('admin_settings', user?.language), icon: Settings },
    { id: 'feedback', label: t('feedback', user?.language), icon: MessageCircle },
    { id: 'help', label: t('help', user?.language), icon: HelpCircle },
  ];

  return (
    <aside className={`fixed left-0 top-0 bottom-0 z-30 bg-[#00193F] text-white flex flex-col font-lato border-r border-[rgba(255,255,255,0.05)] transition-all duration-300 ${isCollapsed ? 'w-[80px]' : 'w-64'}`}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ring {
          0% { transform: rotate(0); }
          10% { transform: rotate(15deg); }
          20% { transform: rotate(-15deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-10deg); }
          50% { transform: rotate(0); }
          100% { transform: rotate(0); }
        }
        .animate-ring {
          animation: ring 2s ease-in-out infinite;
          transform-origin: top center;
        }
      `}} />
      {/* Brand Header */}
      <div className={`p-4 mb-2 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 px-6 py-6'}`}>
        <div className={`rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-md border border-white/5 overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-10 h-10' : 'w-8 h-8'}`}>
          <img src={logo} alt="Remote 365" className="w-full h-full object-contain" />
        </div>
        {!isCollapsed && <span className="text-xl font-bold tracking-tight whitespace-nowrap">Remote 365</span>}
      </div>

      {/* Collapse Toggle */}
      <button 
        onClick={onToggleCollapse}
        className="absolute -right-3 top-20 w-6 h-6 bg-[#0033CC] rounded-full border border-[rgba(255,255,255,0.1)] flex items-center justify-center text-white hover:bg-[#0044EE] transition-colors z-40"
      >
        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Main Nav */}
      <nav className="flex-1 px-3 space-y-1 mt-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setCurrentView(item.id)}
            className={`w-full flex items-center rounded-md transition-all group ${isCollapsed ? 'justify-center py-3' : 'gap-4 px-4 py-2.5'} ${
              currentView === item.id 
                ? 'bg-[#0033CC] text-white' 
                : 'text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white'
            }`}
            title={isCollapsed ? item.label : ''}
          >
            <item.icon size={18} className={`${currentView === item.id ? 'text-white' : 'text-[rgba(255,255,255,0.6)]'}`} />
            {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">{item.label}</span>}
            {!isCollapsed && item.id === 'devices' && (
              <ChevronRight size={14} className="ml-auto opacity-40" />
            )}
          </button>
        ))}
        
        {!isCollapsed && (
          <button className="w-full flex items-center gap-4 px-4 py-2.5 rounded-md text-[rgba(255,255,255,0.7)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white transition-all group">
            <MoreHorizontal size={18} className="text-[rgba(255,255,255,0.6)]" />
            <span className="text-sm font-medium">More solutions</span>
            <ChevronRight size={14} className="ml-auto opacity-40" />
          </button>
        )}
      </nav>

      {/* Bottom Nav */}
      <div className="px-3 pb-6 space-y-1">
        {bottomItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === 'notifications') {
                setShowNotifications?.(true);
              } else {
                setCurrentView(item.id);
              }
            }}
            className={`w-full relative flex items-center rounded-md transition-all ${isCollapsed ? 'justify-center py-3' : 'gap-4 px-4 py-2'} ${
              (currentView === item.id || (item.id === 'notifications' && showNotifications))
                ? 'bg-[rgba(255,255,255,0.1)] text-white' 
                : 'text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white'
            }`}
            title={isCollapsed ? item.label : ''}
          >
            <item.icon size={16} className={item.id === 'notifications' ? 'animate-ring' : ''} />
            {!isCollapsed && <span className="text-[13px] font-medium whitespace-nowrap">{item.label}</span>}
            {item.id === 'notifications' && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
            )}
          </button>
        ))}
        
        {!isCollapsed && (
          <div className="mt-4 pt-4 border-t border-[rgba(255,255,255,0.05)] flex items-center gap-3 px-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
              <span className="text-[10px] font-medium text-[rgba(255,255,255,0.5)]">Ready to connect</span>
          </div>
        )}
        {isCollapsed && (
          <div className="mt-4 flex justify-center">
            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          </div>
        )}
      </div>
    </aside>
  );
};
