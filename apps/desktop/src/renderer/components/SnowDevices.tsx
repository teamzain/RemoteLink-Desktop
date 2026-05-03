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
  Building2,
  Folder,
  History,
  LayoutGrid,
  ChevronDown,
  Columns,
  ListFilter,
  MonitorOff,
  User,
  Settings,
  Shield,
  Zap,
  MoreVertical,
  Circle,
  X,
  Info,
  FolderClosed,
  Link2
} from 'lucide-react';
import { t } from '../lib/translations';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

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

export interface SnowDevicesProps {
  devices: Device[];
  user: any;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device | null) => void;
  handleDeviceClick: (device: Device) => void;
  setActionModal: (modal: any) => void;
  actionModal: any;
  setShowAddModal: (show: boolean) => void;
  handleBulkDelete: (ids: string[]) => void;
  onRefresh: () => void;
}

export const SnowDevices: React.FC<SnowDevicesProps> = ({
  devices,
  user,
  searchQuery,
  setSearchQuery,
  selectedDevice,
  setSelectedDevice,
  handleDeviceClick,
  setActionModal,
  actionModal,
  setShowAddModal,
  handleBulkDelete,
  onRefresh
}) => {
  const { user: authUser } = useAuthStore();
  const lang = authUser?.language;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<'all' | 'online' | 'offline'>('all');
  const [sortOrder, setSortOrder] = useState<'name' | 'status' | 'last_seen'>('name');
  const [showAddGroupModal, setShowAddGroupModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [isUpdatingTags, setIsUpdatingTags] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string>('all');
  const [groupSearch, setGroupSearch] = useState('');
  const [createdGroups, setCreatedGroups] = useState<string[]>(() => {
    const saved = localStorage.getItem('custom_device_groups');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('custom_device_groups', JSON.stringify(createdGroups));
  }, [createdGroups]);

  const dynamicGroups = useMemo(() => {
    const allTags = new Set<string>();
    devices.forEach(d => {
      (d.tags || []).forEach(tag => allTags.add(tag));
    });

    const result = [
      { id: 'all', name: 'All managed devices', icon: LayoutGrid },
      { id: 'my-devices', name: 'My devices', icon: Monitor },
    ];

    Array.from(allTags).sort().forEach(tag => {
      result.push({ id: `tag-${tag}`, name: tag, icon: Folder });
    });

    // Add empty created groups that don't have tags yet
    createdGroups.forEach(groupName => {
      if (!allTags.has(groupName)) {
        result.push({ id: `tag-${groupName}`, name: groupName, icon: Folder });
      }
    });

    return result;
  }, [devices, createdGroups]);

  const handleUpdateTags = async (deviceId: string, tags: string[]) => {
    setIsUpdatingTags(true);
    try {
      await api.patch(`/api/devices/${deviceId}/tags`, { tags });
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to update tags:', err);
    } finally {
      setIsUpdatingTags(false);
    }
  };

  const filteredDevices = useMemo(() => {
    let result = devices.filter(d => {
      // Group filtering
      if (activeGroup === 'my-devices') {
        if (d.tags && d.tags.length > 0) return false;
      } else if (activeGroup.startsWith('tag-')) {
        const tagName = activeGroup.replace('tag-', '');
        if (!d.tags || !d.tags.includes(tagName)) return false;
      }
      if (user?.role === 'OPERATOR' && user?.allowedTags?.length > 0) {
        const deviceTags = d.tags || [];
        const hasAccess = user.allowedTags.some((tag: string) => deviceTags.includes(tag));
        if (!hasAccess) return false;
      }

      if (filterStatus === 'online' && !d.is_online) return false;
      if (filterStatus === 'offline' && d.is_online) return false;

      if (!searchQuery || searchQuery.toLowerCase() === ':online') return true;
      return d.device_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.access_key?.toLowerCase().includes(searchQuery.toLowerCase());
    });

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
    if (selectedIds.length === filteredDevices.length && filteredDevices.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDevices.map(d => d.id));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const formatID = (code: string) => {
    const clean = code?.replace(/[^0-9]/g, '') || '';
    return clean.replace(/(.{3})/g, '$1 ').trim();
  };

  return (
    <div className="flex h-full w-full bg-white rounded-[32px] overflow-hidden border border-[rgba(28,28,28,0.06)] shadow-[0_8px_30px_rgb(0,0,0,0.04)] animate-in fade-in zoom-in-95 duration-500 font-lato">

      {/* Left Groups Sidebar */}
      <div className="w-72 border-r border-[rgba(0,0,0,0.06)] bg-[#FDFDFD] flex flex-col font-lato text-black">
        {/* Group Search */}
        <div className="p-4 border-b border-[rgba(0,0,0,0.04)]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black" />
            <input
              type="text"
              placeholder="Search groups"
              value={groupSearch}
              onChange={(e) => setGroupSearch(e.target.value)}
              className="w-full h-9 bg-slate-50 border-none rounded-xl pl-9 pr-3 text-[13px] font-medium outline-none focus:ring-1 focus:ring-blue-600/20 transition-all text-black font-lato placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-6">
          {/* Recent Section */}
          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 text-[13px] font-semibold text-black hover:bg-[rgba(0,0,0,0.03)] rounded-xl transition-colors font-lato">
              <History size={16} />
              Recent connections
            </button>
          </div>

          {/* Content List */}
          <div className="space-y-1">
            <p className="px-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] mb-2 font-lato">
              Content list
            </p>
            {dynamicGroups.slice(0, 2).map(group => (
              <button
                key={group.id}
                onClick={() => setActiveGroup(group.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-[13px] font-semibold rounded-xl transition-all font-lato ${activeGroup === group.id ? 'bg-blue-50 text-blue-600' : 'text-black hover:bg-[rgba(0,0,0,0.03)]'}`}
              >
                <group.icon size={18} />
                {group.name}
              </button>
            ))}
          </div>

          {/* All Groups */}
          <div className="space-y-1">
            <div className="px-3 flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.15em] font-lato">
                All Groups
              </p>
              <button
                onClick={() => setShowAddGroupModal(true)}
                className="text-black hover:opacity-100 transition-opacity"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="space-y-1 font-lato">
              {dynamicGroups.slice(2).map(group => (
                <button
                  key={group.id}
                  onClick={() => setActiveGroup(group.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-[13px] font-semibold rounded-xl transition-all ${activeGroup === group.id ? 'bg-blue-50 text-blue-600' : 'text-black hover:bg-[rgba(0,0,0,0.03)]'}`}
                >
                  <group.icon size={16} className={activeGroup === group.id ? 'text-blue-600' : 'text-black'} />
                  <span className="truncate">{group.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden font-lato text-black">

        {/* Header */}
        <div className="px-8 pt-8 pb-6 border-b border-[rgba(0,0,0,0.04)]">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-2xl font-semibold text-black tracking-tight flex items-center gap-3 font-lato">
                All managed devices
              </h1>
              <p className="text-[13px] text-black mt-1 font-lato font-medium">
                Overview of the devices you are assigned as manager or are part of groups you manage.
              </p>
            </div>
            <div className="flex items-center gap-3 font-lato">
              <button
                onClick={() => setShowAddModal(true)}
                className="flex items-center gap-2 px-6 py-2.5 bg-[#00193F] text-white rounded-xl text-[13px] font-semibold hover:bg-[#002255] transition-all shadow-lg shadow-blue-900/20 active:scale-95"
              >
                <Plus size={18} />
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="px-8 py-4 flex items-center justify-between bg-[#FDFDFD] font-lato">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-black" />
              <input
                type="text"
                placeholder="Search devices"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-64 h-9 bg-slate-50 border-none rounded-xl pl-9 pr-3 text-[13px] font-medium outline-none focus:ring-1 focus:ring-blue-600/20 transition-all text-black font-lato placeholder:text-slate-400"
              />
            </div>

            <button className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] hover:bg-[rgba(0,0,0,0.04)] rounded-xl transition-colors font-lato">
              <Columns size={16} />
              Columns
            </button>

            <button className="flex items-center gap-2 px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-[0.15em] hover:bg-[rgba(0,0,0,0.04)] rounded-xl transition-colors font-lato">
              <ListFilter size={16} />
              Filters
            </button>
          </div>

          <div className="flex items-center gap-4 font-lato">
            {selectedIds.length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm(`Are you sure you want to remove ${selectedIds.length} devices?`)) {
                    handleBulkDelete(selectedIds);
                    setSelectedIds([]);
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-xl text-[12px] font-semibold hover:bg-red-100 transition-colors border border-red-100 font-lato"
              >
                <Trash2 size={14} />
                Remove Selected ({selectedIds.length})
              </button>
            )}
            <div className="flex items-center p-1 bg-[rgba(0,0,0,0.03)] rounded-xl">
              <button className="p-1.5 bg-white shadow-sm rounded-lg text-[#D4A017]">
                <LayoutGrid size={16} />
              </button>
              <button className="p-1.5 text-black hover:opacity-100">
                <MoreHorizontal size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Device Table */}
        <div className="flex-1 overflow-auto px-8 pb-8 font-lato">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-white z-10 font-lato">
              <tr className="border-b border-[rgba(0,0,0,0.04)] bg-[#FDFDFD]">
                <th className="w-10 py-4 text-left font-lato">
                  <div
                    onClick={toggleSelectAll}
                    className={`w-4 h-4 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${selectedIds.length === filteredDevices.length && filteredDevices.length > 0 ? 'bg-[#00193F] border-[#00193F]' : 'bg-white border-[rgba(0,0,0,0.15)]'}`}
                  >
                    {selectedIds.length === filteredDevices.length && filteredDevices.length > 0 && <Check size={10} className="text-white" />}
                  </div>
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest font-lato">
                  <div className="flex items-center gap-2">
                    Name <ArrowUpDown size={12} className="opacity-40" />
                  </div>
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest font-lato">
                  RemoteLink ID
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest font-lato">
                  Status
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest text-nowrap font-lato">
                  Last Online
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest text-nowrap font-lato">
                  Personal Password
                </th>
                <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-500 uppercase tracking-widest text-nowrap font-lato">
                  Services
                </th>
                <th className="w-12 py-4 text-right font-lato"></th>
              </tr>
            </thead>
            <tbody className="font-lato">
              {filteredDevices.map((device) => {
                const isSelected = selectedIds.includes(device.id);
                const isRowSelected = selectedDevice?.id === device.id;
                return (
                  <tr
                    key={device.id}
                    onClick={() => setSelectedDevice(device)}
                    className={`border-b border-[rgba(0,0,0,0.02)] transition-all group cursor-pointer ${isRowSelected ? 'bg-blue-50/50' : isSelected ? 'bg-blue-50/30' : 'hover:bg-slate-50'}`}
                  >
                    <td className="py-4 font-lato" onClick={e => e.stopPropagation()}>
                      <div
                        onClick={(e) => toggleSelect(device.id, e)}
                        className={`w-4 h-4 rounded-md border flex items-center justify-center cursor-pointer transition-colors ${isSelected ? 'bg-[#00193F] border-[#00193F]' : 'bg-white border-[rgba(0,0,0,0.15)] group-hover:border-[#00193F]'}`}
                      >
                        {isSelected && <Check size={10} className="text-white" />}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-lato">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${device.is_online ? 'bg-blue-50 text-blue-600' : 'bg-[rgba(0,0,0,0.04)] text-black'}`}>
                          {device.device_type?.toLowerCase().includes('phone') ? <Smartphone size={18} /> : <Monitor size={18} />}
                        </div>
                        <div>
                          <p className={`text-[13px] font-semibold transition-colors flex items-center gap-2 font-lato ${isRowSelected ? 'text-blue-600' : 'text-black group-hover:text-blue-600'}`}>
                            {device.device_name || 'Unnamed Host'}
                            {device.id === authUser?.id && (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-md">This device</span>
                            )}
                          </p>
                          <p className="text-[11px] text-black font-medium mt-0.5 font-lato uppercase tracking-tight">#{device.access_key?.slice(0, 3)} group</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-[13px] font-mono text-black font-medium font-lato">
                      {formatID(device.access_key)}
                    </td>
                    <td className="px-4 py-4 font-lato">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${device.is_online ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-50 text-slate-500 border border-slate-200'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${device.is_online ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {device.is_online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-[13px] text-black font-medium font-lato">
                      {device.is_online ? 'Now' : device.last_seen ? new Date(device.last_seen).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-4 text-[13px] text-black font-medium font-lato">
                      {device.access_key ? 'Yes' : 'No'}
                    </td>
                    <td className="px-4 py-4 text-[13px] text-black font-medium font-lato">
                      —
                    </td>
                    <td className="py-4 text-right font-lato" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1 px-4">
                        <button
                          onClick={() => setActionModal({ type: 'assign-group', device })}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                          title="Assign to group"
                        >
                          <Folder size={16} />
                        </button>
                        <button
                          onClick={() => setActionModal({ type: 'rename', device })}
                          className="p-2 text-slate-400 hover:text-black hover:bg-[rgba(0,0,0,0.04)] rounded-lg transition-all"
                          title="More options"
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredDevices.length === 0 && (
            <div className="py-32 flex flex-col items-center justify-center text-black gap-4 animate-in fade-in duration-700 font-lato">
              <div className="w-20 h-20 bg-[rgba(0,0,0,0.02)] rounded-[32px] flex items-center justify-center">
                <MonitorOff size={40} strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-black">No devices found</p>
                <p className="text-xs text-black mt-1 font-semibold">Try adjusting your filters or search query.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Detail Sidebar */}
      {selectedDevice && (
        <div className="w-96 border-l border-[rgba(0,0,0,0.06)] bg-[#FDFDFD] flex flex-col font-lato animate-in slide-in-from-right duration-300 shadow-2xl">
          {/* Sidebar Header */}
          <div className="p-6 border-b border-[rgba(0,0,0,0.04)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 text-[#D4A017] rounded-xl flex items-center justify-center">
                {selectedDevice.device_type?.toLowerCase().includes('phone') ? <Smartphone size={20} /> : <Monitor size={20} />}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-black uppercase tracking-tight truncate max-w-[180px]">
                  {selectedDevice.device_name || 'Unnamed Host'}
                </h2>
                <div className="flex items-center gap-2 mt-0.5">
                  {selectedDevice.id === authUser?.id && (
                    <span className="text-[9px] font-semibold px-1.5 py-0.5 bg-amber-50 text-[#D4A017] rounded-md uppercase">This device</span>
                  )}
                  <span className="text-[10px] font-semibold text-black uppercase">#{selectedDevice.access_key?.slice(0, 3)} group</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedDevice(null)}
              className="p-2 text-black hover:bg-[rgba(0,0,0,0.04)] rounded-xl transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Quick Connect Action */}
            <div>
              <button
                onClick={() => handleDeviceClick(selectedDevice)}
                disabled={!selectedDevice.is_online}
                className={`w-full py-4 rounded-2xl flex items-center justify-center gap-2 text-[14px] font-semibold transition-all shadow-lg ${selectedDevice.is_online ? 'bg-[#00193F] text-white hover:bg-[#002255] shadow-blue-900/10' : 'bg-[rgba(0,0,0,0.05)] text-black cursor-not-allowed shadow-none'}`}
              >
                Establish Link
                <Zap size={14} fill={selectedDevice.is_online ? "currentColor" : "none"} />
              </button>
            </div>

            {/* Device Information Section */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-semibold text-black uppercase tracking-[0.2em]">Device Information</h3>

              <div className="space-y-4">
                {[
                  { label: 'Name', value: selectedDevice.device_name || 'Unnamed' },
                  { label: 'RemoteLink ID', value: formatID(selectedDevice.access_key), isMono: true },
                  { label: 'RemoteLink policy', value: '--' },
                  { label: 'Module', value: 'Full' },
                  { label: 'Version', value: '1.0.4' },
                  { label: 'Description', value: '--' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold text-black uppercase tracking-wider">{item.label}</span>
                    <span className={`text-[13px] font-semibold text-black ${item.isMono ? 'font-mono' : ''}`}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Hardware Section */}
            <div className="space-y-4">
              <h3 className="text-[11px] font-semibold text-black uppercase tracking-[0.2em]">Hardware & OS</h3>
              <div className="p-4 bg-white rounded-2xl border border-[rgba(0,0,0,0.08)] space-y-3 shadow-sm">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-black uppercase">Operating System</span>
                  <span className="text-black">Windows 11 Pro</span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="text-black uppercase">Local IP Address</span>
                  <span className="text-black font-mono">{selectedDevice.local_ip || '192.168.1.104'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Add Group Modal */}
      {showAddGroupModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#111111] w-full max-w-lg p-0 rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Modal Header */}
            <div className="p-8 pb-4 flex items-center justify-between">
              <h3 className="text-[22px] font-semibold text-[#111111] dark:text-[#F5F5F5]">Add group</h3>
              <button
                onClick={() => setShowAddGroupModal(false)}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="px-8 pb-8">
              <p className="text-[14px] text-gray-500 dark:text-[#A0A0A0] mb-6">
                Select the type of group you'd like to create.
              </p>

              <div className="flex gap-4 mb-8">
                <button className="flex-1 p-6 rounded-2xl border-2 border-blue-600 bg-blue-50/50 dark:bg-blue-600/10 text-left relative transition-all">
                  <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center mb-4">
                    <FolderClosed size={20} />
                  </div>
                  <span className="text-[14px] font-bold text-blue-600">Device group</span>
                  <Info size={18} className="absolute top-4 right-4 text-blue-600" />
                </button>

                <button className="flex-1 p-6 rounded-2xl border-2 border-gray-100 dark:border-white/5 bg-transparent text-left relative opacity-60 grayscale hover:grayscale-0 transition-all cursor-not-allowed">
                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 text-gray-600 flex items-center justify-center mb-4">
                    <History size={20} />
                  </div>
                  <span className="text-[14px] font-bold text-gray-600">Group (legacy)</span>
                  <Info size={18} className="absolute top-4 right-4 text-gray-400" />
                </button>
              </div>

              <div className="mb-10">
                <input
                  type="text"
                  placeholder="Device group name"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full h-12 px-4 bg-white dark:bg-transparent border border-gray-200 dark:border-white/10 rounded-xl text-[14px] font-medium focus:border-blue-600 outline-none transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-6">
                <button className="text-[14px] font-bold text-gray-400 hover:text-gray-600 transition-colors">
                  Create and configure
                </button>
                <button
                  onClick={() => {
                    if (newGroupName.trim()) {
                      setCreatedGroups(prev => [...new Set([...prev, newGroupName.trim()])]);
                      setShowAddGroupModal(false);
                      setNewGroupName('');
                    }
                  }}
                  disabled={!newGroupName.trim()}
                  className={`px-8 py-3 rounded-xl text-[14px] font-bold transition-all ${newGroupName.trim() ? 'bg-[#00193F] text-white shadow-lg hover:opacity-90' : 'bg-[#F0F2F5] dark:bg-white/5 text-gray-400 dark:text-white/20 cursor-not-allowed'}`}
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assign to Group Modal */}
      {actionModal?.type === 'assign-group' && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] animate-in fade-in duration-300">
          <div className="bg-white dark:bg-[#111111] w-full max-w-sm p-0 rounded-[28px] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="p-8 pb-4 flex items-center justify-between">
              <h3 className="text-[20px] font-semibold text-[#111111] dark:text-[#F5F5F5]">Assign to group</h3>
              <button 
                onClick={() => setActionModal(null)}
                className="p-2 text-gray-400 hover:text-black dark:hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-8 pb-8">
              <p className="text-[13px] text-gray-500 dark:text-[#A0A0A0] mb-6 font-medium">
                Select a group for <span className="text-black dark:text-white font-bold">{actionModal.device.device_name}</span>
              </p>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                {/* Default My Devices Option */}
                <button 
                  onClick={() => {
                    handleUpdateTags(actionModal.device.id, []);
                    setActionModal(null);
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left ${(!actionModal.device.tags || actionModal.device.tags.length === 0) ? 'bg-blue-50 text-blue-600 border-2 border-blue-600/20' : 'bg-gray-50 dark:bg-white/5 text-black dark:text-white border-2 border-transparent hover:bg-gray-100 dark:hover:bg-white/10'}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${(!actionModal.device.tags || actionModal.device.tags.length === 0) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-black text-gray-400'}`}>
                    <Monitor size={16} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold">My devices</p>
                    <p className="text-[10px] opacity-60">Default group</p>
                  </div>
                  {(!actionModal.device.tags || actionModal.device.tags.length === 0) && <Check size={16} />}
                </button>

                {/* Custom Tags & Created Groups */}
                {Array.from(new Set([
                  ...devices.flatMap(d => d.tags || []),
                  ...createdGroups
                ])).sort().map(tag => (
                  <button 
                    key={tag}
                    onClick={() => {
                      handleUpdateTags(actionModal.device.id, [tag]);
                      setActionModal(null);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all text-left ${(actionModal.device.tags?.includes(tag)) ? 'bg-blue-50 text-blue-600 border-2 border-blue-600/20' : 'bg-gray-50 dark:bg-white/5 text-black dark:text-white border-2 border-transparent hover:bg-gray-100 dark:hover:bg-white/10'}`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${(actionModal.device.tags?.includes(tag)) ? 'bg-blue-600 text-white' : 'bg-white dark:bg-black text-gray-400'}`}>
                      <Folder size={16} />
                    </div>
                    <div className="flex-1">
                      <p className="text-[13px] font-bold">{tag}</p>
                    </div>
                    {actionModal.device.tags?.includes(tag) && <Check size={16} />}
                  </button>
                ))}
              </div>

              <div className="mt-8">
                <button 
                  onClick={() => {
                    setActionModal(null);
                    setShowAddGroupModal(true);
                  }}
                  className="w-full py-4 bg-gray-50 dark:bg-white/5 text-black dark:text-white rounded-2xl text-[12px] font-black uppercase tracking-[0.1em] hover:bg-gray-100 dark:hover:bg-white/10 transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Create new group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
