import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Monitor,
  Trash2,
  Clock,
  CheckCircle2,
  X,
  AlertCircle,
  Search,
  Pencil
} from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  allowedDeviceIds?: string[];
  allowedTags?: string[];
  department?: { name: string };
  createdAt: string;
}

interface OrgDevice {
  id: string;
  device_name: string;
  access_key: string;
  device_type: string;
  is_online: boolean;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  token: string;
  expiresAt: string;
}

export const SnowMembers: React.FC = () => {
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Form states for invitation
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('OPERATOR');
  const [inviteAccessType, setInviteAccessType] = useState<'none' | 'full' | 'specific'>('none');
  const [orgDevices, setOrgDevices] = useState<OrgDevice[]>([]);
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);
  const [deviceSearch, setDeviceSearch] = useState('');

  const { user } = useAuthStore();
  const isRestricted = user && (user.plan === 'TRIAL' || user.plan === 'SOLO' || user.plan === 'PRO');

  useEffect(() => {
    if (user && !isRestricted) {
      fetchTeamData();
      fetchOrgDevices();
    } else if (user) {
      setLoading(false);
    }
  }, [user, isRestricted]);

  const fetchOrgDevices = async () => {
    try {
      const { data } = await api.get('/api/devices/mine');
      setOrgDevices(data || []);
    } catch (err) {
      console.error('Failed to fetch org devices:', err);
    }
  };

  const fetchTeamData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/members');
      setMembers(data.members || []);
      setInvitations(data.pendingInvites || []);
    } catch (err) {
      console.error('Failed to fetch team data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    try {
      await api.post('/api/members/invite', {
        email: inviteEmail,
        role: inviteRole,
        accessType: inviteAccessType === 'full' ? 'full' : undefined,
        deviceIds: inviteAccessType === 'specific' ? selectedDeviceIds : []
      });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteAccessType('none');
      setSelectedDeviceIds([]);
      setDeviceSearch('');
      fetchTeamData();
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Failed to send invitation');
    }
  };

  const toggleDevice = (deviceId: string) => {
    setSelectedDeviceIds(prev =>
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    );
  };

  // Edit access modal state
  const [editTarget, setEditTarget] = useState<Member | null>(null);
  const [editAccessType, setEditAccessType] = useState<'none' | 'full' | 'specific'>('none');
  const [editDeviceIds, setEditDeviceIds] = useState<string[]>([]);
  const [editDeviceSearch, setEditDeviceSearch] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const openEditAccess = (member: Member) => {
    setEditTarget(member);
    const ids = member.allowedDeviceIds || [];
    if (ids.includes('__all__')) {
      setEditAccessType('full');
      setEditDeviceIds([]);
    } else if (ids.length > 0) {
      setEditAccessType('specific');
      setEditDeviceIds(ids);
    } else {
      setEditAccessType('none');
      setEditDeviceIds([]);
    }
    setEditDeviceSearch('');
  };

  const toggleEditDevice = (deviceId: string) => {
    setEditDeviceIds(prev =>
      prev.includes(deviceId) ? prev.filter(id => id !== deviceId) : [...prev, deviceId]
    );
  };

  const handleSaveAccess = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    try {
      await api.patch(`/api/members/${editTarget.id}/access`, {
        accessType: editAccessType === 'full' ? 'full' : undefined,
        deviceIds: editAccessType === 'specific' ? editDeviceIds : []
      });
      setEditTarget(null);
      fetchTeamData();
    } catch (err) {
      alert('Failed to update access');
    } finally {
      setEditSaving(false);
    }
  };

  // Update remove functions to use modal
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'member' | 'invitation', email: string } | null>(null);

  const removeMember = async (userId: string) => {
    try {
      await api.delete(`/api/members/${userId}`);
      fetchTeamData();
      setDeleteTarget(null);
    } catch (err) {
      alert('Failed to remove member');
    }
  };

  const removeInvitation = async (invitationId: string) => {
    try {
      await api.delete(`/api/members/invitation/${invitationId}`);
      fetchTeamData();
      setDeleteTarget(null);
    } catch (err) {
      alert('Failed to cancel invitation');
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-inter">

      {/* Header Section */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">Team Management</h1>
          <p className="text-sm text-[rgba(28,28,28,0.4)] mt-1">Manage organization members, roles, and device access.</p>
        </div>
        <button
          onClick={() => { setShowInviteModal(true); setSelectedDeviceIds([]); setDeviceSearch(''); setInviteEmail(''); setInviteAccessType('none'); setInviteError(null); }}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#1C1C1C] text-white rounded-xl text-sm font-bold shadow-lg shadow-black/10 hover:bg-[#2C2C2C] transition-all transform active:scale-95"
        >
          <UserPlus size={18} />
          Invite Member
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 bg-white rounded-3xl border border-[rgba(28,28,28,0.04)] shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Users size={20} />
            </div>
            <span className="text-xs font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Total Members</span>
          </div>
          <p className="text-3xl font-bold text-[#1C1C1C]">{members.length}</p>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-[rgba(28,28,28,0.04)] shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
              <Clock size={20} />
            </div>
            <span className="text-xs font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Pending Invites</span>
          </div>
          <p className="text-3xl font-bold text-[#1C1C1C]">{invitations.length}</p>
        </div>

        <div className="p-6 bg-white rounded-3xl border border-[rgba(28,28,28,0.04)] shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Shield size={20} />
            </div>
            <span className="text-xs font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest">Active Roles</span>
          </div>
          <p className="text-3xl font-bold text-[#1C1C1C]">3</p>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-[#F9F9FA] border-b border-[rgba(28,28,28,0.04)]">
              <th className="px-6 py-4 text-[11px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-[0.1em]">User</th>
              <th className="px-6 py-4 text-[11px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-[0.1em]">Role</th>
              <th className="px-6 py-4 text-[11px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-[0.1em]">Device Access</th>
              <th className="px-6 py-4 text-[11px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-[0.1em]">Joined</th>
              <th className="px-6 py-4 text-right"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(28,28,28,0.04)]">
            {members.map((member) => (
              <tr key={member.id} className="hover:bg-[rgba(28,28,28,0.01)] transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm">
                      {member.name?.[0] || member.email[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1C1C1C]">{member.name || 'Anonymous User'}</div>
                      <div className="text-xs text-[rgba(28,28,28,0.4)]">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${member.role === 'SUB_ADMIN' ? 'bg-purple-50 text-purple-600' :
                    member.role === 'OPERATOR' ? 'bg-blue-50 text-blue-600' :
                      'bg-slate-50 text-slate-500'
                    }`}>
                    {member.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {member.allowedDeviceIds?.includes('__all__') ? (
                    <span className="text-xs text-emerald-600 font-semibold">Full org access</span>
                  ) : member.allowedDeviceIds && member.allowedDeviceIds.length > 0 ? (
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-blue-600">
                      <Monitor size={13} />
                      {member.allowedDeviceIds.length} device{member.allowedDeviceIds.length !== 1 ? 's' : ''}
                    </span>
                  ) : (
                    <span className="text-xs text-red-500 font-semibold">No access</span>
                  )}
                </td>
                <td className="px-6 py-4 text-xs text-[rgba(28,28,28,0.4)]">
                  {new Date(member.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => openEditAccess(member)}
                      className="p-2 text-[rgba(28,28,28,0.2)] hover:text-blue-600 transition-colors"
                      title="Edit device access"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: member.id, type: 'member', email: member.email })}
                      className="p-2 text-[rgba(28,28,28,0.2)] hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {/* Render Pending Invitations */}
            {invitations.map((invite) => (
              <tr key={invite.id} className="bg-amber-50/50 group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-amber-50 flex items-center justify-center text-amber-600">
                      <Mail size={16} />
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#1C1C1C] italic">Invitation Pending</div>
                      <div className="text-xs text-[rgba(28,28,28,0.4)]">{invite.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                    {invite.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-xs text-amber-600/60 italic font-medium">Waiting for join...</td>
                <td className="px-6 py-4 text-xs text-[rgba(28,28,28,0.4)]">---</td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() => setDeleteTarget({ id: invite.id, type: 'invitation', email: invite.email })}
                    className="p-2 text-amber-600/40 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {members.length === 0 && invitations.length === 0 && !loading && !isRestricted && (
          <div className="py-20 flex flex-col items-center justify-center text-[rgba(28,28,28,0.4)] gap-2">
            <Users size={48} strokeWidth={1} />
            <span className="text-xs">No team members yet. Invite your first colleague!</span>
          </div>
        )}

        {isRestricted && (
          <div className="py-24 flex flex-col items-center justify-center text-center px-6">
            <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-[28px] flex items-center justify-center mb-8 shadow-sm">
              <Users size={40} strokeWidth={1.5} />
            </div>
            <h2 className="text-2xl font-bold text-[#1C1C1C] mb-3 tracking-tight">Team Management Restricted</h2>
            <p className="text-sm text-[rgba(28,28,28,0.5)] max-w-sm mb-10 leading-relaxed font-medium">
              Elevate your organization by adding team members, managing roles, and delegating access.
              Team features are available on <span className="text-[#1C1C1C] font-bold">Team</span> and <span className="text-[#1C1C1C] font-bold">Enterprise</span> plans.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <button
                className="px-10 py-4 bg-[#1C1C1C] text-white rounded-2xl text-sm font-bold shadow-2xl shadow-black/10 hover:bg-[#2C2C2C] transition-all transform active:scale-[0.98]"
              >
                Explore Team Plans
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-8 border border-white/20 animate-in zoom-in-95 duration-300 text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 size={32} />
            </div>
            <h3 className="text-xl font-bold text-[#1C1C1C] mb-2">
              {deleteTarget.type === 'member' ? 'Remove Member?' : 'Cancel Invitation?'}
            </h3>
            <p className="text-sm text-[rgba(28,28,28,0.5)] mb-8 px-4 leading-relaxed">
              Are you sure you want to remove <strong>{deleteTarget.email}</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="flex-1 py-3.5 bg-[#F9F9FA] text-[rgba(28,28,28,0.6)] rounded-xl font-bold text-sm hover:bg-[#F0F0F2] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteTarget.type === 'member' ? removeMember(deleteTarget.id) : removeInvitation(deleteTarget.id)}
                className="flex-1 py-3.5 bg-red-600 text-white rounded-xl font-bold text-sm hover:bg-red-700 transition-all shadow-lg shadow-red-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Access Modal */}
      {editTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-[#1C1C1C]">Edit Device Access</h2>
                <p className="text-xs text-[rgba(28,28,28,0.4)] mt-1">{editTarget.name || editTarget.email}</p>
              </div>
              <button onClick={() => setEditTarget(null)} className="text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C]"><X size={24} /></button>
            </div>

            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest px-1">Device Access</label>
              <div className="grid grid-cols-3 gap-2">
                {(['none', 'full', 'specific'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEditAccessType(type)}
                    className={`py-2.5 rounded-xl border text-[11px] font-bold transition-all ${editAccessType === type ? 'bg-[#1C1C1C] text-white border-[#1C1C1C]' : 'bg-white text-[rgba(28,28,28,0.5)] border-[rgba(28,28,28,0.1)] hover:border-[rgba(28,28,28,0.3)]'}`}
                  >
                    {type === 'none' ? 'No Access' : type === 'full' ? 'Full Org' : 'Specific'}
                  </button>
                ))}
              </div>
              {editAccessType === 'none' && (
                <p className="text-[10px] text-red-500 font-medium px-1">This member will not see any devices.</p>
              )}
              {editAccessType === 'full' && (
                <p className="text-[10px] text-emerald-600 font-medium px-1">This member can see all devices in the organization.</p>
              )}
              {editAccessType === 'specific' && (
                <>
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]" />
                    <input
                      type="text"
                      value={editDeviceSearch}
                      onChange={(e) => setEditDeviceSearch(e.target.value)}
                      placeholder="Search devices..."
                      className="w-full pl-9 pr-4 py-2.5 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl text-xs focus:border-[#1C1C1C] outline-none transition-all font-inter"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-[rgba(28,28,28,0.06)] bg-[#F9F9FA] divide-y divide-[rgba(28,28,28,0.04)]">
                    {orgDevices.filter(d =>
                      !editDeviceSearch || d.device_name?.toLowerCase().includes(editDeviceSearch.toLowerCase()) || d.access_key?.includes(editDeviceSearch)
                    ).map(device => (
                      <label key={device.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white transition-colors">
                        <input
                          type="checkbox"
                          checked={editDeviceIds.includes(device.id)}
                          onChange={() => toggleEditDevice(device.id)}
                          className="w-4 h-4 accent-[#1C1C1C] rounded"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-[#1C1C1C] truncate">{device.device_name || 'Unnamed Device'}</div>
                          <div className="text-[10px] text-[rgba(28,28,28,0.4)]">{device.access_key}</div>
                        </div>
                        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${device.is_online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                      </label>
                    ))}
                    {orgDevices.length === 0 && (
                      <div className="py-6 text-center text-[10px] text-[rgba(28,28,28,0.3)]">No devices in your organization</div>
                    )}
                  </div>
                  {editDeviceIds.length > 0 && (
                    <p className="text-[10px] text-blue-600 font-medium px-1">{editDeviceIds.length} device{editDeviceIds.length !== 1 ? 's' : ''} selected</p>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setEditTarget(null)}
                className="flex-1 py-3.5 bg-[#F9F9FA] text-[rgba(28,28,28,0.6)] rounded-xl font-bold text-sm hover:bg-[#F0F0F2] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveAccess}
                disabled={editSaving}
                className="flex-1 py-3.5 bg-[#1C1C1C] text-white rounded-xl font-bold text-sm hover:bg-[#2C2C2C] transition-all shadow-lg shadow-black/10 disabled:opacity-50"
              >
                {editSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl p-8 border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-[#1C1C1C]">Invite Team Member</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C]"><X size={24} /></button>
            </div>

            <form onSubmit={handleSendInvite} className="space-y-5">
              <div>
                <label className="block text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mb-2 px-1">Email Address</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full px-4 py-3 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl text-sm focus:border-[#1C1C1C] outline-none transition-all font-inter"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mb-2 px-1">Assign Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteRole('OPERATOR')}
                    className={`px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${inviteRole === 'OPERATOR' ? 'bg-[#1C1C1C] text-white border-[#1C1C1C]' : 'bg-white text-[rgba(28,28,28,0.6)] border-[rgba(28,28,28,0.1)] hover:border-[rgba(28,28,28,0.3)]'}`}
                  >
                    Operator (Full Access)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteRole('VIEWER')}
                    className={`px-3 py-2.5 rounded-xl border text-[11px] font-bold transition-all ${inviteRole === 'VIEWER' ? 'bg-[#1C1C1C] text-white border-[#1C1C1C]' : 'bg-white text-[rgba(28,28,28,0.6)] border-[rgba(28,28,28,0.1)] hover:border-[rgba(28,28,28,0.3)]'}`}
                  >
                    Viewer (View Only)
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mb-2 px-1">Device Access</label>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {(['none', 'full', 'specific'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setInviteAccessType(type)}
                      className={`py-2.5 rounded-xl border text-[11px] font-bold transition-all ${inviteAccessType === type ? 'bg-[#1C1C1C] text-white border-[#1C1C1C]' : 'bg-white text-[rgba(28,28,28,0.5)] border-[rgba(28,28,28,0.1)] hover:border-[rgba(28,28,28,0.3)]'}`}
                    >
                      {type === 'none' ? 'No Access' : type === 'full' ? 'Full Org' : 'Specific'}
                    </button>
                  ))}
                </div>
                {inviteAccessType === 'none' && (
                  <p className="text-[10px] text-red-500 font-medium px-1">This member will not see any devices.</p>
                )}
                {inviteAccessType === 'full' && (
                  <p className="text-[10px] text-emerald-600 font-medium px-1">This member can see all devices in the organization.</p>
                )}
                {inviteAccessType === 'specific' && (
                  <>
                    <div className="relative mb-2">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]" />
                      <input
                        type="text"
                        value={deviceSearch}
                        onChange={(e) => setDeviceSearch(e.target.value)}
                        placeholder="Search devices..."
                        className="w-full pl-9 pr-4 py-2.5 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl text-xs focus:border-[#1C1C1C] outline-none transition-all font-inter"
                      />
                    </div>
                    <div className="max-h-44 overflow-y-auto rounded-xl border border-[rgba(28,28,28,0.06)] bg-[#F9F9FA] divide-y divide-[rgba(28,28,28,0.04)]">
                      {orgDevices.filter(d =>
                        !deviceSearch || d.device_name?.toLowerCase().includes(deviceSearch.toLowerCase()) || d.access_key?.includes(deviceSearch)
                      ).map(device => (
                        <label key={device.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white transition-colors">
                          <input
                            type="checkbox"
                            checked={selectedDeviceIds.includes(device.id)}
                            onChange={() => toggleDevice(device.id)}
                            className="w-4 h-4 accent-[#1C1C1C] rounded"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-[#1C1C1C] truncate">{device.device_name || 'Unnamed Device'}</div>
                            <div className="text-[10px] text-[rgba(28,28,28,0.4)]">{device.access_key}</div>
                          </div>
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${device.is_online ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </label>
                      ))}
                      {orgDevices.length === 0 && (
                        <div className="py-6 text-center text-[10px] text-[rgba(28,28,28,0.3)]">No devices found in your organization</div>
                      )}
                    </div>
                    {selectedDeviceIds.length > 0 && (
                      <p className="mt-1.5 text-[10px] text-blue-600 font-medium px-1">{selectedDeviceIds.length} device{selectedDeviceIds.length !== 1 ? 's' : ''} selected</p>
                    )}
                  </>
                )}
              </div>

              {inviteError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 text-red-600 rounded-xl text-xs font-bold border border-red-100 animate-pulse">
                  <AlertCircle size={14} /> {inviteError}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-4 bg-[#1C1C1C] text-white rounded-2xl text-sm font-bold shadow-xl shadow-black/10 hover:bg-[#2C2C2C] transition-all transform active:scale-[0.98] mt-4"
              >
                Send Invitation Link
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
