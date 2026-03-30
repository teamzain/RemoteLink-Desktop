import React, { useState } from 'react';
import { 
  Monitor, 
  Smartphone, 
  MoreHorizontal, 
  Plus, 
  Filter, 
  ArrowUpDown, 
  Search, 
  ChevronLeft, 
  ChevronRight,
  Check,
  Smartphone as PhoneIcon,
  Trash2,
  ExternalLink
} from 'lucide-react';

interface Device {
  id: string;
  device_name: string;
  device_type: string;
  access_key: string;
  is_online: boolean;
  last_seen?: string;
  local_ip?: string;
}

interface SnowDevicesProps {
  devices: Device[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setSelectedDevice: (device: Device | null) => void;
  handleDeviceClick: (device: Device) => void;
  setActionModal: (modal: any) => void;
  setShowAddModal: (show: boolean) => void;
  handleBulkDelete: (ids: string[]) => void;
}

export const SnowDevices: React.FC<SnowDevicesProps> = ({ 
  devices, 
  searchQuery, 
  setSearchQuery, 
  setSelectedDevice, 
  handleDeviceClick,
  setActionModal,
  setShowAddModal,
  handleBulkDelete
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filteredDevices = devices.filter(d => 
    !searchQuery || d.device_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    d.access_key?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredDevices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDevices.map(d => d.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const formatID = (code: string) => {
    const clean = code?.replace(/[^0-9]/g, '') || '';
    return clean.length === 9 ? `#${clean}` : `#${clean}`;
  };

  const getOsIcon = (type?: string) => {
    const t = type?.toLowerCase();
    if (t === 'ios' || t === 'android') return <PhoneIcon size={14} className="text-[#1C1C1C]" />;
    return <Monitor size={14} className="text-[#1C1C1C]" />;
  };

  return (
    <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Table Title */}
      <div className="flex items-center justify-between mb-1 px-1">
        <h2 className="text-sm font-semibold text-[#1C1C1C]">My Devices</h2>
        {selectedIds.length > 0 && (
          <button 
            onClick={() => {
              if (window.confirm(`Are you sure you want to remove ${selectedIds.length} devices?`)) {
                handleBulkDelete(selectedIds);
                setSelectedIds([]);
              }
            }}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-bold hover:bg-red-100 transition-colors border border-red-100"
          >
            <Trash2 size={12} />
            Remove Selected ({selectedIds.length})
          </button>
        )}
      </div>

      {/* Utility Bar */}
      <div className="flex items-center justify-between p-2 h-11 bg-[#F9F9FA] rounded-2xl border border-[rgba(28,28,28,0.04)]">
        <div className="flex items-center gap-4 ml-1">
          <button onClick={() => setShowAddModal(true)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[rgba(28,28,28,0.05)] transition-colors">
            <Plus size={16} className="text-[#1C1C1C]" />
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[rgba(28,28,28,0.05)] transition-colors">
            <Filter size={16} className="text-[#1C1C1C]" />
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[rgba(28,28,28,0.05)] transition-colors">
            <ArrowUpDown size={16} className="text-[#1C1C1C]" />
          </button>
        </div>

        <div className="relative mr-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.4)]" />
          <input 
            type="text" 
            placeholder="Search..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-28 sm:w-40 h-7 bg-white/80 border border-[rgba(0,0,0,0.1)] rounded-xl pl-8 sm:pl-9 pr-2 sm:pr-3 text-xs outline-none focus:border-[rgba(0,0,0,0.3)] transition-all font-inter"
          />
        </div>
      </div>

      {/* Device Table */}
      <div className="w-full bg-white rounded-2xl overflow-hidden font-inter border border-[rgba(28,28,28,0.04)] shadow-sm">
        <div className="overflow-x-auto w-full custom-scrollbar">
          <table className="w-full border-collapse lg:whitespace-normal whitespace-nowrap">
            <thead>
              <tr className="border-b border-[rgba(0,0,0,0.1)]">
              <th className="w-10 h-10 px-4 py-2 text-left">
                <div 
                  onClick={toggleSelectAll}
                  className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${selectedIds.length === filteredDevices.length && filteredDevices.length > 0 ? 'bg-[#1C1C1C] border-[#1C1C1C]' : 'bg-white border-[rgba(0,0,0,0.2)]'}`}
                >
                  {selectedIds.length === filteredDevices.length && filteredDevices.length > 0 && <Check size={10} className="text-white" />}
                </div>
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  Device ID <ArrowUpDown size={12} className="opacity-40" />
                </div>
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">
                <div className="flex items-center gap-2">
                  Device Name <Filter size={12} className="opacity-40" />
                </div>
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Platform</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Address</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Last Sync</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Status</th>
              <th className="w-10 px-3 py-3 text-center"></th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => {
              const isSelected = selectedIds.includes(device.id);
              return (
                <tr 
                  key={device.id} 
                  className={`border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(28,28,28,0.02)] transition-colors group ${!device.is_online ? 'bg-slate-50/50' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div 
                      onClick={() => toggleSelect(device.id)}
                      className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-[#1C1C1C] border-[#1C1C1C]' : 'bg-white border-[rgba(0,0,0,0.2)]'}`}
                    >
                      {isSelected && <Check size={10} className="text-white" />}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs font-mono text-[#1C1C1C]">{formatID(device.access_key)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                       <div className="w-6 h-6 rounded-full bg-[rgba(28,28,28,0.04)] flex items-center justify-center p-1">
                          {getOsIcon(device.device_type)}
                       </div>
                       <span className="text-xs font-medium text-[#1C1C1C] truncate max-w-[120px]">{device.device_name || 'Unnamed Device'}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-xs text-[#1C1C1C] opacity-80">{device.device_type || 'Windows/x64'}</td>
                  <td className="px-3 py-3 text-xs text-[#1C1C1C] opacity-80">{device.local_ip || '127.0.0.1'}</td>
                  <td className="px-3 py-3 text-xs text-[#1C1C1C] opacity-80">{device.last_seen ? new Date(device.last_seen).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Just now'}</td>
                  <td className="px-3 py-3">
                    <span className={device.is_online ? "badge-online" : "badge-offline"}>
                      {device.is_online ? 'CONNECTABLE' : 'OFFLINE'}
                    </span>
                  </td>
                  <td className="px-3 py-3 relative">
                    <div className="flex items-center justify-center gap-1">
                      {device.is_online && (
                        <button 
                          onClick={() => handleDeviceClick(device)}
                          className="p-1 text-[rgba(28,28,28,0.2)] hover:text-blue-500 transition-colors"
                          title="Connect"
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                      <button 
                         onClick={() => setActionModal({ type: 'rename', device })}
                         className="p-1 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors"
                      >
                         <MoreHorizontal size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          </table>
        </div>

        {filteredDevices.length === 0 && (
          <div className="py-20 flex flex-col items-center justify-center text-[rgba(28,28,28,0.4)] gap-2">
            <Monitor size={48} strokeWidth={1} />
            <span className="text-xs">No devices found matching your criteria.</span>
          </div>
        )}
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-center gap-2 mt-2">
         <button className="h-6 px-3 border border-[rgba(0,0,0,0.1)] rounded-xl flex items-center justify-center hover:bg-[rgba(28,28,28,0.02)] transition-colors">
            <ChevronLeft size={14} className="text-[#1C1C1C]" />
         </button>
         {[1, 2, 3].map(i => (
           <button 
             key={i} 
             className={`w-6 h-6 text-xs font-medium rounded-xl flex items-center justify-center transition-colors ${i === 1 ? 'bg-[rgba(28,28,28,0.04)] border border-[rgba(0,0,0,0.1)] text-[#1C1C1C]' : 'text-[rgba(28,28,28,0.4)] hover:text-[#1C1C1C]'}`}
           >
             {i}
           </button>
         ))}
         <button className="h-6 px-3 border border-[rgba(0,0,0,0.1)] rounded-xl flex items-center justify-center hover:bg-[rgba(28,28,28,0.02)] transition-colors">
            <ChevronRight size={14} className="text-[#1C1C1C]" />
         </button>
      </div>

    </div>
  );
};
