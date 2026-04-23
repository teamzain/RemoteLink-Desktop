import React, { useState, useEffect } from 'react';
import { Mail, Trash2, Lock, Zap } from 'lucide-react';
import api from '../../lib/api';
import { notify } from '../NotificationProvider';

interface SnowMembersProps {
    user: any;
}

export const SnowMembers: React.FC<SnowMembersProps> = ({ user }) => {
    const [members, setMembers] = useState<any[]>([]);
    const [pendingInvites, setPendingInvites] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('USER');

    const isRestricted = user?.plan === 'FREE' || user?.plan === 'PRO';

    useEffect(() => {
        if (!isRestricted) {
            fetchMembers();
        } else {
            setIsLoading(false);
        }
    }, [isRestricted]);

    const fetchMembers = async () => {
        try {
            const { data } = await api.get('/api/auth/members');
            setMembers(data.members || []);
            setPendingInvites(data.pendingInvites || []);
        } catch (err) {
            notify('Failed to fetch team members', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/api/auth/members/invite', { email: inviteEmail, role: inviteRole });
            notify('Invitation sent successfully', 'success');
            setInviteEmail('');
            fetchMembers();
        } catch (err: any) {
            notify(err.response?.data?.error || 'Failed to send invitation', 'error');
        }
    };

    const handleRemove = async (userId: string) => {
        if (!window.confirm('Are you sure you want to remove this member?')) return;
        try {
            await api.delete(`/api/auth/members/${userId}`);
            notify('Member removed', 'success');
            fetchMembers();
        } catch (err) {
            notify('Failed to remove member', 'error');
        }
    };

    if (isRestricted) {
        return (
            <div className="max-w-4xl mx-auto py-20 px-6 text-center animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="w-20 h-20 bg-blue-50 rounded-[28px] flex items-center justify-center mx-auto mb-8 shadow-sm border border-blue-100">
                    <Lock size={32} className="text-blue-500" />
                </div>
                <h2 className="text-3xl font-black text-[#1C1C1C] mb-4 tracking-tight">Team Management Required</h2>
                <p className="text-sm text-[rgba(28,28,28,0.4)] font-medium max-w-md mx-auto mb-10 leading-relaxed">
                    Collaborate with your team, assign roles, and manage shared device access. This feature is reserved for <strong>Team</strong> and <strong>Enterprise</strong> plans.
                </p>

                <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-10 shadow-xl shadow-black/5 max-w-2xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center gap-8 text-left">
                        <div className="w-full md:w-1/2 space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                                    <Zap size={10} className="text-emerald-500" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-[#1C1C1C]">Unlimited Team Members</span>
                                    <p className="text-[10px] text-[rgba(28,28,28,0.4)]">Invite your entire workforce without seat limits.</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-5 h-5 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                                    <Zap size={10} className="text-emerald-500" />
                                </div>
                                <div>
                                    <span className="text-xs font-bold text-[#1C1C1C]">Role-Based Access</span>
                                    <p className="text-[10px] text-[rgba(28,28,28,0.4)]">Assign specific permissions to departments or users.</p>
                                </div>
                            </div>
                        </div>
                        <div className="w-full md:w-1/2 flex flex-col gap-4">
                            <button
                                onClick={() => window.location.href = '/pricing'}
                                className="w-full py-4 bg-[#1C1C1C] text-white rounded-2xl text-xs font-black shadow-lg shadow-black/10 hover:scale-[1.02] transition-all"
                            >
                                UPGRADE TO TEAM
                            </button>
                            <p className="text-[10px] text-center text-[rgba(28,28,28,0.3)] font-medium">Starting at $24.96/month</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto space-y-10 animate-in fade-in duration-700 pb-20">

            {/* Header & Invite Section */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
                <div className="flex flex-col">
                    <h2 className="text-2xl font-black text-[#1C1C1C] tracking-tight mb-1">Team Members</h2>
                    <p className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Manage your organization's access and hierarchy.</p>
                </div>

                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row items-center gap-3 bg-white p-2 rounded-[24px] border border-[rgba(28,28,28,0.06)] shadow-sm">
                    <div className="flex items-center gap-3 px-4 py-2 bg-[#F9F9FA] rounded-xl flex-1 min-w-[240px]">
                        <Mail size={16} className="text-[rgba(28,28,28,0.3)]" />
                        <input
                            type="email"
                            placeholder="colleague@company.com"
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            required
                            className="bg-transparent border-none outline-none text-xs font-bold w-full placeholder:text-[rgba(28,28,28,0.2)]"
                        />
                    </div>
                    <select
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value)}
                        className="bg-[#F9F9FA] border border-[rgba(28,28,28,0.04)] rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-wider outline-none"
                    >
                        <option value="USER">Member</option>
                        <option value="SUB_ADMIN">Manager</option>
                    </select>
                    <button
                        type="submit"
                        className="px-6 py-3 bg-[#1C1C1C] text-white rounded-xl text-[10px] font-bold hover:opacity-90 shadow-lg shadow-black/5"
                    >
                        Send Invite
                    </button>
                </form>
            </div>

            {/* Members List */}
            <div className="grid grid-cols-1 gap-4">
                <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] overflow-hidden shadow-sm">
                    <div className="px-8 py-4 border-b border-[rgba(28,28,28,0.04)] bg-[#F9F9FA]/50 flex items-center justify-between">
                        <span className="text-[10px] font-black text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Active Members ({members.length})</span>
                    </div>

                    <div className="divide-y divide-[rgba(28,28,28,0.04)]">
                        {isLoading ? (
                            <div className="p-20 text-center text-[rgba(28,28,28,0.3)] text-xs font-medium animate-pulse">Synchronizing directory...</div>
                        ) : members.length === 0 ? (
                            <div className="p-20 text-center text-[rgba(28,28,28,0.3)] text-xs font-medium">No members found in your organization.</div>
                        ) : members.map((member: any) => (
                            <div key={member.id} className="p-6 flex items-center justify-between group hover:bg-[#F9F9FA]/30 transition-all">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-[rgba(28,28,28,0.02)] border border-[rgba(28,28,28,0.04)] flex items-center justify-center text-sm font-black text-[#1C1C1C] shadow-sm">
                                        {member.name?.[0] || member.email[0].toUpperCase()}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-[#1C1C1C]">{member.name || 'Unnamed Member'}</span>
                                        <span className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium">{member.email}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-8">
                                    <div className="flex flex-col items-end">
                                        <div className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter border ${member.role === 'SUB_ADMIN' ? 'bg-indigo-50 text-indigo-500 border-indigo-100' : 'bg-slate-50 text-slate-500 border-slate-100'}`}>
                                            {member.role === 'SUB_ADMIN' ? 'Manager' : 'Member'}
                                        </div>
                                        <span className="text-[9px] text-[rgba(28,28,28,0.2)] font-black mt-1">Joined {new Date(member.createdAt).toLocaleDateString()}</span>
                                    </div>

                                    <button
                                        onClick={() => handleRemove(member.id)}
                                        disabled={member.id === user.id}
                                        className={`p-2 rounded-xl transition-all ${member.id === user.id ? 'opacity-0' : 'text-[rgba(28,28,28,0.2)] hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100'}`}
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Pending Invites */}
                {pendingInvites.length > 0 && (
                    <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] overflow-hidden shadow-sm">
                        <div className="px-8 py-4 border-b border-[rgba(28,28,28,0.04)] bg-[#F9F9FA]/50 flex items-center justify-between">
                            <span className="text-[10px] font-black text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Pending Invitations ({pendingInvites.length})</span>
                        </div>
                        <div className="divide-y divide-[rgba(28,28,28,0.04)]">
                            {pendingInvites.map((invite: any) => (
                                <div key={invite.id} className="p-6 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                                            <Mail size={16} className="text-orange-400" />
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-bold text-[#1C1C1C]">{invite.email}</span>
                                            <span className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium">Expires {new Date(invite.expiresAt).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="px-2 py-0.5 bg-orange-50 text-orange-500 rounded-full text-[8px] font-black uppercase tracking-tighter border border-orange-100">Pending</div>
                                        <button className="text-[rgba(28,28,28,0.2)] hover:text-red-500 p-2">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
