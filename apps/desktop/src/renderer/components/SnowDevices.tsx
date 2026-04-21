import React, { useState, useMemo, useEffect } from 'react';
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
  Building2
} from 'lucide-react';

interface Device {
  id: string;
  device_name: string;
  device_type: string;
  access_key: string;
  is_online: boolean;
  last_seen?: string;
  local_ip?: string;
  tags?: string[];
  org_name?: string | null;
  org_slug?: string | null;
  org_id?: string | null;
}

interface SnowDevicesProps {
  devices: Device[];
  user: any;
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
  user,
  searchQuery, 
  setSearchQuery, 
  setSelectedDevice, 
  handleDeviceClick,
  setActionModal,
  setShowAddModal,
  handleBulkDelete
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [sortOrder, setSortOrder] = useState<'name' | 'status' | 'last_seen'>('name');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Sync searchQuery ":online" with filterStatus
  useEffect(() => {
    if (searchQuery.toLowerCase() === ':online') {
        setFilterStatus('online');
    }
  }, [searchQuery]);

  const filteredDevices = useMemo(() => {
    let result = devices.filter(d => {
        // Role-based Tag Filtering for OPERATORS
        if (user?.role === 'OPERATOR' && user?.allowedTags?.length > 0) {
            const deviceTags = d.tags || [];
            // If device has no tags but user has restrictions, they can't see it (Secure by default)
            // Or if device tags don't intersect with user's allowed tags
            const hasAccess = user.allowedTags.some((tag: string) => deviceTags.includes(tag));
            if (!hasAccess) return false;
        }

        // Status Filter
        if (filterStatus === 'online' && !d.is_online) return false;
        if (filterStatus === 'offline' && d.is_online) return false;

        // Search Query
        if (!searchQuery || searchQuery.toLowerCase() === ':online') return true;
        return d.device_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
               d.access_key?.toLowerCase().includes(searchQuery.toLowerCase());
    });

    // Apply Sorting
    return [...result].sort((a, b) => {
        if (sortOrder === 'name') {
            return (a.device_name || '').localeCompare(b.device_name || '');
        } else if (sortOrder === 'status') {
            return (b.is_online ? 1 : 0) - (a.is_online ? 1 : 0);
        } else if (sortOrder === 'last_seen') {
            const dateA = new Date(a.last_seen || 0).getTime();
            const dateB = new Date(b.last_seen || 0).getTime();
            return dateB - dateA;
        }
        return 0;
    });
  }, [devices, searchQuery, filterStatus, sortOrder]);

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
        <h2 className="text-sm font-semibold text-[#1C1C1C]">{user?.role === 'SUPER_ADMIN' ? 'All Devices' : 'Host Device List'}</h2>
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
          <div className="relative">
            <button 
                onClick={() => { setShowFilterMenu(!showFilterMenu); setShowSortMenu(false); }}
                className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${filterStatus !== 'all' ? 'bg-blue-50 text-blue-600' : 'hover:bg-[rgba(28,28,28,0.05)] text-[#1C1C1C]'}`}
                title="Filter Status"
            >
                <Filter size={16} />
            </button>
            {showFilterMenu && (
                <div className="absolute top-8 left-0 z-50 w-40 bg-white border border-[rgba(0,0,0,0.08)] rounded-xl shadow-xl p-1 animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => { setFilterStatus('all'); setShowFilterMenu(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold rounded-lg transition-colors ${filterStatus === 'all' ? 'bg-blue-50 text-blue-600' : 'text-[#1C1C1C] hover:bg-[#F9F9FA]'}`}>
                        Show All {filterStatus === 'all' && <Check size={12} />}
                    </button>
                    <button onClick={() => { setFilterStatus('online'); setShowFilterMenu(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold rounded-lg transition-colors ${filterStatus === 'online' ? 'bg-blue-50 text-blue-600' : 'text-[#1C1C1C] hover:bg-[#F9F9FA]'}`}>
                        Online Only {filterStatus === 'online' && <Check size={12} />}
                    </button>
                    <button onClick={() => { setFilterStatus('offline'); setShowFilterMenu(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold rounded-lg transition-colors ${filterStatus === 'offline' ? 'bg-blue-50 text-blue-600' : 'text-[#1C1C1C] hover:bg-[#F9F9FA]'}`}>
                        Offline Only {filterStatus === 'offline' && <Check size={12} />}
                    </button>
                </div>
            )}
          </div>

          <div className="relative">
            <button 
                onClick={() => { setShowSortMenu(!showSortMenu); setShowFilterMenu(false); }}
                className={`w-6 h-6 flex items-center justify-center rounded-full transition-colors ${sortOrder !== 'name' ? 'bg-purple-50 text-purple-600' : 'hover:bg-[rgba(28,28,28,0.05)] text-[#1C1C1C]'}`}
                title="Sort Devices"
            >
                <ArrowUpDown size={16} />
            </button>
            {showSortMenu && (
                <div className="absolute top-8 left-0 z-50 w-44 bg-white border border-[rgba(0,0,0,0.08)] rounded-xl shadow-xl p-1 animate-in fade-in zoom-in-95 duration-200">
                    <button onClick={() => { setSortOrder('name'); setShowSortMenu(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold rounded-lg transition-colors ${sortOrder === 'name' ? 'bg-purple-50 text-purple-600' : 'text-[#1C1C1C] hover:bg-[#F9F9FA]'}`}>
                        Name (A-Z) {sortOrder === 'name' && <Check size={12} />}
                    </button>
                    <button onClick={() => { setSortOrder('status'); setShowSortMenu(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold rounded-lg transition-colors ${sortOrder === 'status' ? 'bg-purple-50 text-purple-600' : 'text-[#1C1C1C] hover:bg-[#F9F9FA]'}`}>
                        Status (Online First) {sortOrder === 'status' && <Check size={12} />}
                    </button>
                    <button onClick={() => { setSortOrder('last_seen'); setShowSortMenu(false); }} className={`w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold rounded-lg transition-colors ${sortOrder === 'last_seen' ? 'bg-purple-50 text-purple-600' : 'text-[#1C1C1C] hover:bg-[#F9F9FA]'}`}>
                        Last Seen {sortOrder === 'last_seen' && <Check size={12} />}
                    </button>
                </div>
            )}
          </div>
        </div>

        <div className="relative mr-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.4)]" />
          <input 
            type="text" 
            placeholder="Search Device..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-40 h-7 bg-white/80 border border-[rgba(0,0,0,0.1)] rounded-xl pl-9 pr-3 text-xs outline-none focus:border-[rgba(0,0,0,0.3)] transition-all font-inter"
          />
        </div>
      </div>

      {/* Device Table */}
      <div className="w-full bg-white rounded-2xl overflow-hidden font-inter">
        <table className="w-full border-collapse">
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
                  Host Name <Filter size={12} className="opacity-40" />
                </div>
              </th>
              {user?.role === 'SUPER_ADMIN' && (
                <th className="px-3 py-3 text-left text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest text-nowrap">Organization</th>
              )}
              <th className="px-3 py-3 text-left text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest text-nowrap">Platform</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest text-nowrap">Last Sync</th>
              <th className="px-3 py-3 text-left text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest text-nowrap">Status</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDevices.map((device) => {
              const isSelected = selectedIds.includes(device.id);
              const canConnect = device.is_online && user?.role !== 'VIEWER';
              return (
                <tr
                  key={device.id}
                  onClick={() => {
                    if (device.is_online) {
                      handleDeviceClick(device);
                    }
                  }}
                  className={`border-b border-[rgba(0,0,0,0.04)] transition-colors group cursor-pointer ${isSelected ? 'bg-blue-50/40' : device.is_online ? 'hover:bg-[rgba(28,28,28,0.02)]' : 'bg-slate-50/50 hover:bg-slate-50'}`}
                >
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
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
                      <span className="text-xs font-medium text-[#1C1C1C] truncate max-w-[120px]">{device.device_name || 'Unnamed Host'}</span>
                    </div>
                  </td>
                  {user?.role === 'SUPER_ADMIN' && (
                    <td className="px-3 py-3">
                      {device.org_name ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-md bg-blue-50 flex items-center justify-center flex-shrink-0">
                            <Building2 size={11} className="text-blue-600" />
                          </div>
                          <span className="text-xs font-semibold text-[#1C1C1C] truncate max-w-[100px]">{device.org_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-[rgba(28,28,28,0.25)]">—</span>
                      )}
                    </td>
                  )}
                  <td className="px-3 py-3 text-xs text-[#1C1C1C] opacity-80">{device.device_type || 'Windows/x64'}</td>
                  <td className="px-3 py-3 text-xs text-[#1C1C1C] opacity-80">{device.last_seen ? new Date(device.last_seen).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}</td>
                  <td className="px-3 py-3">
                    <span className={device.is_online ? 'badge-online' : 'badge-offline'}>
                      {device.is_online ? 'CONNECTABLE' : 'OFFLINE'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-2">
                      {device.is_online ? (
                        <button
                          onClick={() => {
                            if (!canConnect) {
                              alert('Your role is View-Only. You do not have permission to connect to devices.');
                              return;
                            }
                            handleDeviceClick(device);
                          }}
                          disabled={!canConnect}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase tracking-wider transition-all ${
                            canConnect
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600 active:scale-95 shadow-sm shadow-emerald-500/20'
                              : 'bg-[rgba(28,28,28,0.06)] text-[rgba(28,28,28,0.25)] cursor-not-allowed'
                          }`}
                        >
                          Connect
                        </button>
                      ) : (
                        <span className="text-[11px] text-[rgba(28,28,28,0.2)] font-medium px-3">—</span>
                      )}
                      <button
                        onClick={() => setActionModal({ type: 'rename', device })}
                        className="p-1.5 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] hover:bg-[rgba(28,28,28,0.05)] rounded-lg transition-colors"
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
