import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserPlus, 
  Mail, 
  Shield, 
  Tag as TagIcon, 
  Trash2, 
  Clock, 
  CheckCircle2, 
  X,
  AlertCircle,
  MoreVertical,
  ChevronDown
} from 'lucide-react';
import api from '../lib/api';

interface Member {
  id: string;
  email: string;
  name: string;
  role: string;
  department?: { name: string };
  createdAt: string;
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
  const [inviteTags, setInviteTags] = useState('');

  useEffect(() => {
    fetchTeamData();
  }, []);

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
    
    const tagsArray = inviteTags.split(',').map(t => t.trim()).filter(t => t !== '');

    try {
      await api.post('/api/members/invite', {
        email: inviteEmail,
        role: inviteRole,
        allowedTags: tagsArray
      });
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteTags('');
      fetchTeamData();
    } catch (err: any) {
      setInviteError(err.response?.data?.error || 'Failed to send invitation');
    }
  };

  const removeMember = async (userId: string) => {
    if (!window.confirm('Are you sure you want to remove this member?')) return;
    try {
      await api.delete(`/api/members/${userId}`);
      fetchTeamData();
    } catch (err) {
      alert('Failed to remove member');
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
          onClick={() => setShowInviteModal(true)}
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
              <th className="px-6 py-4 text-[11px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-[0.1em]">Department</th>
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
                  <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider ${
                    member.role === 'SUB_ADMIN' ? 'bg-purple-50 text-purple-600' :
                    member.role === 'OPERATOR' ? 'bg-blue-50 text-blue-600' :
                    'bg-slate-50 text-slate-500'
                  }`}>
                    {member.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-xs text-[#1C1C1C]">{member.department?.name || '---'}</span>
                </td>
                <td className="px-6 py-4 text-xs text-[rgba(28,28,28,0.4)]">
                  {new Date(member.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => removeMember(member.id)}
                    className="p-2 text-[rgba(28,28,28,0.2)] hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={16} />
                  </button>
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
                  <button className="p-2 text-amber-600/40 hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {members.length === 0 && invitations.length === 0 && !loading && (
          <div className="py-20 flex flex-col items-center justify-center text-[rgba(28,28,28,0.4)] gap-2">
            <Users size={48} strokeWidth={1} />
            <span className="text-xs">No team members yet. Invite your first colleague!</span>
          </div>
        )}
      </div>

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
                <label className="block text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest mb-2 px-1">Access Tags (Optional)</label>
                <div className="relative">
                  <TagIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]" />
                  <input 
                    type="text" 
                    value={inviteTags}
                    onChange={(e) => setInviteTags(e.target.value)}
                    placeholder="e.g. it-room, dev-cluster"
                    className="w-full pl-11 pr-4 py-3 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-xl text-sm focus:border-[#1C1C1C] outline-none transition-all font-inter"
                  />
                </div>
                <p className="mt-2 text-[10px] text-[rgba(28,28,28,0.4)] leading-relaxed italic px-1">Comma-separated tags. Operators only see devices matching these tags.</p>
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
