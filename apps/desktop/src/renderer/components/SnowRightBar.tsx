import React from 'react';
import { 
  User, 
  Bug, 
  Radio, 
  ShieldCheck, 
  Monitor, 
  Smartphone,
  ExternalLink 
} from 'lucide-react';

interface SnowRightBarProps {
  devices: any[];
  notifications: any[];
  onDeviceClick: (device: any) => void;
  isOpen?: boolean;
  onClose?: () => void;
}

export const SnowRightBar: React.FC<SnowRightBarProps> = ({ devices, notifications, onDeviceClick, isOpen, onClose }) => {
  return (
    <>
      <aside className={`fixed xl:static right-0 top-0 bottom-0 w-[280px] min-w-[280px] h-full border-l border-[rgba(28,28,28,0.1)] p-6 flex flex-col bg-white overflow-y-auto custom-scrollbar font-inter z-30 shadow-2xl xl:shadow-none transition-transform duration-300 xl:translate-x-0 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      
      {/* Top Section - Alerts */}
      <div className="mb-10">
        <h3 className="text-sm font-semibold text-[#1C1C1C] mb-6 tracking-tight">System Notifications</h3>
        <div className="flex flex-col gap-6">
          {notifications.map((act, i) => (
             <div key={i} className="flex gap-3 animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${i * 50}ms` }}>
               <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${act.color} text-[#1C1C1C] shrink-0 shadow-sm/50 transition-all`}>
                  <act.icon size={14} strokeWidth={2.5} />
               </div>
               <div className="flex flex-col">
                  <span className="text-sm text-[#1C1C1C] font-medium leading-tight">{act.action}</span>
                  <span className="text-[11px] text-[rgba(28,28,28,0.4)] mt-1 font-medium">{act.time}</span>
               </div>
             </div>
          ))}
          {notifications.length === 0 && (
            <div className="py-4 text-center">
               <span className="text-xs text-[rgba(28,28,28,0.3)] font-medium italic">All systems reporting nominal</span>
            </div>
          )}
        </div>
      </div>

      {/* middle Section - Quick Access Devices */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-[#1C1C1C] tracking-tight">Active Nodes</h3>
          <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest">{devices.length} Total</span>
        </div>
        <div className="flex flex-col gap-3">
          {devices.slice(0, 6).map((device, i) => (
             <div 
               key={device.id} 
               onClick={() => onDeviceClick(device)}
               className="flex items-center gap-3 cursor-pointer group hover:bg-[rgba(28,28,28,0.02)] p-2 -ml-2 rounded-xl transition-all duration-200 border border-transparent hover:border-[rgba(28,28,28,0.05)]"
             >
               <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors ${device.is_online ? 'bg-[rgba(113,221,140,0.1)] text-[#71DD8C]' : 'bg-[rgba(28,28,28,0.05)] text-[rgba(28,28,28,0.2)]'}`}>
                  {device.device_type?.toLowerCase() === 'ios' || device.device_type?.toLowerCase() === 'android' ? <Smartphone size={14} /> : <Monitor size={14} />}
               </div>
               <div className="flex flex-col min-w-0 flex-1">
                 <span className="text-sm text-[#1C1C1C] group-hover:text-blue-600 transition-colors font-medium truncate tracking-tight">{device.device_name || 'Unnamed'}</span>
                 <span className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium truncate">{device.access_key}</span>
               </div>
               <ExternalLink size={12} className="text-[rgba(28,28,28,0.1)] group-hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-all transform translate-x-1 group-hover:translate-x-0" />
             </div>
          ))}
          {devices.length === 0 && (
            <div className="py-4 text-center">
               <span className="text-xs text-[rgba(28,28,28,0.3)] font-medium italic">No active nodes found</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Visual Branding */}
      <div className="mt-auto pt-6 border-t border-[rgba(28,28,28,0.05)]">
         <div className="p-4 bg-[rgba(28,28,28,0.02)] rounded-2xl border border-[rgba(28,28,28,0.04)]">
            <p className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] leading-relaxed">
              Connect-X utilizes E2E encryption for all remote streams. Your machine is currently secure.
            </p>
         </div>
      </div>

    </aside>
    {isOpen && (
      <div 
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-20 xl:hidden"
        onClick={onClose}
      />
    )}
  </>
  );
};
