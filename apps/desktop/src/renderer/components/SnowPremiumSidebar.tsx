import React, { useEffect, useMemo, useRef, useState } from 'react';
import logo from '../assets/logo.png';
import {
  Home,
  Network,
  Monitor,
  MessageSquare,
  Settings,
  HelpCircle,
  MessageCircle,
  ChevronRight,
  ChevronLeft,
  Bell,
  Video,
  MoreHorizontal,
  Sliders,
} from 'lucide-react';
import { t } from '../lib/translations';
import {
  SidebarPreferences,
  applySidebarPreferences,
  getSidebarPreferences,
} from '../lib/sidebarPreferences';
import { SidebarCustomizationModal, CustomizableItem } from './SidebarCustomizationModal';

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
  const allNavItems = useMemo(
    () => [
      { id: 'dashboard', label: t('home', user?.language), icon: Home, group: 'main' as const },
      { id: 'connect', label: t('remote_support', user?.language), icon: Network, group: 'main' as const },
      { id: 'devices', label: t('devices', user?.language), icon: Monitor, group: 'main' as const },
      { id: 'chat', label: t('chat', user?.language), icon: MessageSquare, group: 'main' as const },
      { id: 'meetings', label: t('meetings', user?.language) || 'Meetings', icon: Video, group: 'main' as const },
    ],
    [user?.language]
  );

  const allBottomItems = useMemo(
    () => [
      { id: 'notifications', label: t('notifications', user?.language), icon: Bell, group: 'utility' as const },
      { id: 'admin_settings', label: t('admin_settings', user?.language), icon: Settings, group: 'utility' as const },
      { id: 'feedback', label: t('feedback', user?.language), icon: MessageCircle, group: 'utility' as const },
      { id: 'help', label: t('help', user?.language), icon: HelpCircle, group: 'utility' as const },
    ],
    [user?.language]
  );

  const [prefs, setPrefs] = useState<SidebarPreferences>(() => getSidebarPreferences());
  const [showMorePopover, setShowMorePopover] = useState(false);
  const [showCustomizeModal, setShowCustomizeModal] = useState(false);
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const morePopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMorePopover) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moreButtonRef.current?.contains(target)) return;
      if (morePopoverRef.current?.contains(target)) return;
      setShowMorePopover(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMorePopover]);

  // Items the modal lets the user toggle. `dashboard` is protected (always present).
  const customizationItems: CustomizableItem[] = useMemo(
    () => [
      ...allNavItems.map((item) => ({
        id: item.id,
        label: item.label,
        group: 'main' as const,
        protected: item.id === 'dashboard',
      })),
      ...allBottomItems.map((item) => ({
        id: item.id,
        label: item.label,
        group: 'utility' as const,
      })),
    ],
    [allNavItems, allBottomItems]
  );

  const navItems = applySidebarPreferences(allNavItems, prefs, ['dashboard']);
  const bottomItems = applySidebarPreferences(allBottomItems, prefs, []);

  const handleApplyPreferences = (next: SidebarPreferences) => {
    setPrefs(next);
  };

  return (
    <aside className={`fixed left-0 top-0 bottom-0 z-30 bg-[#00193F] dark:bg-[#080808] text-white flex flex-col font-lato border-r border-[rgba(255,255,255,0.05)] transition-all duration-300 ${isCollapsed ? 'w-[80px]' : 'w-64'}`}>
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
      <nav className="flex-1 px-3 space-y-1 mt-4 overflow-y-auto">
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
          </button>
        ))}
      </nav>

      {/* Bottom Nav */}
      <div className="px-3 pb-6 space-y-1 relative">
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

        {/* More */}
        <button
          ref={moreButtonRef}
          type="button"
          onClick={() => setShowMorePopover((value) => !value)}
          className={`w-full relative flex items-center rounded-md transition-all ${isCollapsed ? 'justify-center py-3' : 'gap-4 px-4 py-2'} ${
            showMorePopover
              ? 'bg-[rgba(255,255,255,0.1)] text-white'
              : 'text-[rgba(255,255,255,0.6)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white'
          }`}
          title={isCollapsed ? 'More' : ''}
        >
          <MoreHorizontal size={16} />
          {!isCollapsed && (
            <>
              <span className="text-[13px] font-medium whitespace-nowrap flex-1 text-left">More</span>
              <ChevronRight
                size={14}
                className={`text-[rgba(255,255,255,0.4)] transition-transform ${showMorePopover ? 'rotate-90' : ''}`}
              />
            </>
          )}
        </button>

        {showMorePopover && (
          <div
            ref={morePopoverRef}
            className={`absolute z-50 ${isCollapsed ? 'left-[80px] bottom-2' : 'left-[calc(100%-12px)] bottom-2'} ml-2 w-[220px] rounded-2xl bg-[#0F1A2D] dark:bg-[#1A1A1A] border border-white/10 shadow-2xl p-1.5 animate-in slide-in-from-left-1 fade-in duration-150`}
          >
            <button
              type="button"
              onClick={() => {
                setShowCustomizeModal(true);
                setShowMorePopover(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-[13px] font-medium text-white hover:bg-white/10 transition-colors"
            >
              <Sliders size={14} className="text-white/70" />
              Customize sidebar
            </button>
          </div>
        )}
      </div>

      <SidebarCustomizationModal
        open={showCustomizeModal}
        onClose={() => setShowCustomizeModal(false)}
        items={customizationItems}
        onApply={handleApplyPreferences}
      />
    </aside>
  );
};
