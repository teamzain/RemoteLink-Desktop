import React, { useState } from 'react';
import { X, MoreHorizontal, ChevronDown, Inbox, Check, BellOff, Settings, Trash2 } from 'lucide-react';

interface SnowNotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const AnimatedTray: React.FC = () => {
  return (
    <div className="relative mb-8 group">
      {/* Ambient Glow */}
      <div className="absolute inset-0 -inset-4 bg-blue-500/10 blur-2xl rounded-full animate-pulse" />
      
      {/* Tray SVG */}
      <div className="relative w-32 h-32 bg-white rounded-[24px] border border-[rgba(0,0,0,0.06)] flex items-center justify-center shadow-xl shadow-black/5 z-10 transition-transform duration-700 group-hover:scale-105 group-hover:-translate-y-2">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <style>
            {`
              @keyframes tray-float {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-4px); }
              }
              @keyframes line-draw {
                0% { stroke-dashoffset: 40; opacity: 0; }
                50% { opacity: 1; }
                100% { stroke-dashoffset: 0; opacity: 0; }
              }
              .tray-base { animation: tray-float 4s ease-in-out infinite; }
              .receiving-line { 
                stroke-dasharray: 40; 
                animation: line-draw 2s linear infinite; 
              }
            `}
          </style>
          
          {/* Tray Structure */}
          <path 
            className="tray-base"
            d="M12 28L20 48H44L52 28" 
            stroke="#1C1C1C" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
          />
          <path 
            className="tray-base"
            d="M12 28H24L28 36H36L40 28H52" 
            stroke="#1C1C1C" 
            strokeWidth="1.5" 
            strokeLinejoin="round" 
          />
          
          {/* Animated "Incoming" particles/lines */}
          <line x1="32" y1="8" x2="32" y2="20" stroke="#0033CC" strokeWidth="1.5" strokeLinecap="round" className="receiving-line" style={{ animationDelay: '0s' }} />
          <line x1="22" y1="12" x2="22" y2="24" stroke="#0033CC" strokeWidth="1.5" strokeLinecap="round" className="receiving-line" style={{ animationDelay: '0.4s', opacity: 0.4 }} />
          <line x1="42" y1="12" x2="42" y2="24" stroke="#0033CC" strokeWidth="1.5" strokeLinecap="round" className="receiving-line" style={{ animationDelay: '0.8s', opacity: 0.4 }} />
        </svg>
      </div>

      {/* Decorative floating elements */}
      <div className="absolute -top-2 -right-2 w-4 h-4 bg-blue-500 rounded-full blur-[2px] opacity-20 animate-bounce" style={{ animationDuration: '3s' }} />
      <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-indigo-500 rounded-full blur-[1px] opacity-10 animate-bounce" style={{ animationDuration: '4s' }} />
    </div>
  );
};

export const SnowNotificationPanel: React.FC<SnowNotificationPanelProps> = ({ isOpen, onClose }) => {
  const [filter, setFilter] = useState<'unread' | 'all'>('unread');
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/10 backdrop-blur-[4px] z-[100] transition-opacity duration-500"
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <aside className={`fixed right-0 top-0 bottom-0 w-[420px] bg-white z-[101] shadow-[0_0_50px_rgba(0,0,0,0.1)] transition-all duration-700 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col font-lato border-l border-[rgba(0,0,0,0.04)] ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        
        {/* Header */}
        <div className="h-16 flex items-center justify-between px-8 border-b border-[rgba(0,0,0,0.05)] flex-shrink-0 bg-white/80 backdrop-blur-md sticky top-0 z-20">
          <div className="relative">
            <button 
              onClick={() => setFilter(filter === 'unread' ? 'all' : 'unread')}
              className="flex items-center gap-2.5 px-3 py-1.5 -ml-3 rounded-xl hover:bg-gray-50 transition-all group active:scale-95"
            >
              <span className="text-[15px] font-bold text-[#1C1C1C] tracking-tight capitalize">{filter}</span>
              <ChevronDown size={16} className={`text-[#A0A0A0] transition-transform duration-300 ${filter === 'all' ? 'rotate-180' : ''}`} />
              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.5)] animate-pulse" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button 
                onClick={() => setShowMenu(!showMenu)}
                className={`p-2.5 rounded-xl transition-all active:scale-90 ${showMenu ? 'bg-gray-100 text-[#1C1C1C]' : 'hover:bg-gray-50 text-[#757575] hover:text-[#1C1C1C]'}`}
              >
                <MoreHorizontal size={18} />
              </button>

              {showMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowMenu(false)} />
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-[rgba(0,0,0,0.06)] p-1.5 z-40 animate-in fade-in zoom-in-95 duration-200">
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-[13px] font-medium text-[#1C1C1C] transition-colors">
                      <Check size={16} className="text-emerald-500" />
                      Mark all as read
                    </button>
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-gray-50 text-[13px] font-medium text-[#1C1C1C] transition-colors">
                      <Settings size={16} className="text-[#757575]" />
                      Notification settings
                    </button>
                    <div className="h-px bg-[rgba(0,0,0,0.04)] my-1 mx-2" />
                    <button className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-red-50 text-[13px] font-medium text-red-600 transition-colors">
                      <Trash2 size={16} />
                      Clear all
                    </button>
                  </div>
                </>
              )}
            </div>
            
            <button 
              onClick={onClose}
              className="p-2.5 hover:bg-gray-50 rounded-xl text-[#757575] hover:text-[#1C1C1C] transition-all active:scale-90"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-[#FBFBFC] flex flex-col items-center justify-center p-12 text-center">
          <div className="max-w-[280px] flex flex-col items-center">
            <AnimatedTray />

            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4 duration-1000 delay-300">
              <h3 className="text-xl font-bold text-[#1C1C1C] tracking-tight">You're all caught up</h3>
              <p className="text-[13px] text-[#8A8A8E] leading-relaxed font-medium">
                When you receive new notifications, they will appear here. Enjoy your productive day!
              </p>
              
              <button className="mt-8 px-6 py-2.5 bg-white border border-[rgba(0,0,0,0.08)] rounded-full text-[12px] font-bold text-[#1C1C1C] shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all active:scale-95">
                Refresh Feed
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-[rgba(0,0,0,0.04)] bg-white">
          <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-[#A0A0A0] uppercase tracking-[0.1em]">
            <BellOff size={12} />
            <span>End of notifications</span>
          </div>
        </div>
      </aside>
    </>
  );
};

