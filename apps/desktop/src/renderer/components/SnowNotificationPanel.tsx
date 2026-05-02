import React from 'react';
import { X, MoreHorizontal, ChevronDown, Inbox } from 'lucide-react';

interface SnowNotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SnowNotificationPanel: React.FC<SnowNotificationPanelProps> = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/5 backdrop-blur-[2px] z-[100] transition-opacity duration-300"
          onClick={onClose}
        />
      )}

      {/* Side Panel */}
      <aside className={`fixed right-0 top-0 bottom-0 w-[400px] bg-white z-[101] shadow-2xl transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col font-sans ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
            100% { transform: translateY(0px); }
          }
          .animate-float {
            animation: float 3s ease-in-out infinite;
          }
        `}} />
        {/* Header */}
        <div className="h-14 flex items-center justify-between px-6 border-b border-[rgba(0,0,0,0.06)] flex-shrink-0">
          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 -ml-2 rounded-md transition-colors group">
            <span className="text-lg font-normal text-[#1C1C1C]">Unread</span>
            <ChevronDown size={18} className="text-[#757575] group-hover:text-[#1C1C1C] transition-colors" />
          </div>
          <div className="flex items-center gap-3">
            <button className="p-2 hover:bg-gray-50 rounded-full text-[#757575] hover:text-[#1C1C1C] transition-colors">
              <MoreHorizontal size={20} />
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-50 rounded-full text-[#757575] hover:text-[#1C1C1C] transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 bg-[#F8F9FA] p-6">
          <div className="w-full h-full rounded-2xl bg-[#F4F7F9]/50 flex flex-col items-center justify-center p-12 text-center">
            {/* Illustration Placeholder */}
            <div className="relative mb-8 animate-float">
               <div className="w-24 h-24 bg-white rounded-xl border border-[rgba(0,0,0,0.06)] flex items-center justify-center shadow-sm relative z-10">
                  <Inbox size={48} strokeWidth={1} className="text-[#A0A0A0]" />
               </div>
               {/* Decorative lines */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-px bg-gradient-to-r from-transparent via-[rgba(0,0,0,0.05)] to-transparent" />
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-48 w-px bg-gradient-to-b from-transparent via-[rgba(0,0,0,0.05)] to-transparent" />
            </div>

            <h3 className="text-lg font-bold text-[#1C1C1C] mb-2 tracking-tight">Great!</h3>
            <p className="text-sm text-[#757575] leading-relaxed">
              You have no unread notifications.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
};
