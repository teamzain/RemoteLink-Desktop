import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Globe, 
  Settings, 
  MoreVertical, 
  ExternalLink,
  ShieldCheck,
  Activity,
  X,
  CheckCircle2
} from 'lucide-react';
import api from '../lib/api';

interface Organization {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  _count: {
    users: number;
    devices: number;
  }
}

export const SnowOrgs: React.FC = () => {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOrgs();
  }, []);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/api/organizations');
      setOrgs(data);
    } catch (err) {
      console.error('Failed to fetch orgs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.post('/api/organizations', { name, slug });
      setShowAddModal(false);
      setName('');
      setSlug('');
      fetchOrgs();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create organization');
    }
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-inter">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">Organizations</h1>
          <p className="text-sm text-[rgba(28,28,28,0.4)] mt-1">Global management of all registered companies and tenants.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all transform active:scale-95"
        >
          <Plus size={18} />
          New Organization
        </button>
      </div>

      {/* Grid of Orgs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {orgs.map((org) => (
          <div key={org.id} className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] shadow-sm p-8 hover:shadow-xl hover:shadow-black/5 transition-all duration-300 group cursor-pointer border-transparent hover:border-blue-100">
            <div className="flex items-start justify-between mb-8">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                {org.name[0]}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C]"><Settings size={16} /></button>
                <button className="p-2 text-[rgba(28,28,28,0.2)] hover:text-blue-600"><ExternalLink size={16} /></button>
              </div>
            </div>

            <h3 className="text-lg font-bold text-[#1C1C1C] mb-1">{org.name}</h3>
            <p className="text-xs text-[rgba(28,28,28,0.3)] font-mono mb-6 uppercase tracking-widest">{org.slug}.remotelink.io</p>

            <div className="grid grid-cols-2 gap-4 pb-6 border-b border-[rgba(28,28,28,0.04)] mb-6">
              <div>
                <p className="text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-wider mb-1">Members</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-[#1C1C1C]">{org._count.users}</span>
                  <span className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium">Active</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-wider mb-1">Devices</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-[#1C1C1C]">{org._count.devices}</span>
                  <span className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium">Reg.</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 rounded-lg">
                <ShieldCheck size={12} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Verified Tenant</span>
              </div>
              <span className="text-[10px] text-[rgba(28,28,28,0.3)] font-medium italic">
                {new Date(org.createdAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        ))}

        {orgs.length === 0 && !loading && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-[rgba(28,28,28,0.4)] gap-2">
            <Building2 size={64} strokeWidth={1} />
            <span className="text-sm font-medium">No organizations found. Ready to onboard your first customer?</span>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] w-full max-w-lg shadow-2xl p-10 border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">Create Organization</h2>
              <button onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-[rgba(28,28,28,0.3)] hover:text-[#1C1C1C] transition-colors"><X size={24} /></button>
            </div>

            <form onSubmit={handleCreateOrg} className="space-y-6">
              <div>
                <label className="block text-[11px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] mb-3 px-1">Display Name</label>
                <div className="relative">
                  <Building2 size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]" />
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (!slug) setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'));
                    }}
                    placeholder="Acme Corporation"
                    className="w-full pl-12 pr-6 py-4 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-2xl text-[15px] font-medium focus:border-blue-500/50 focus:bg-white outline-none transition-all shadow-sm font-inter"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em] mb-3 px-1">Organization Slug (URL identifier)</label>
                <div className="relative">
                  <Globe size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-[rgba(28,28,28,0.3)]" />
                  <input 
                    type="text" 
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="acme-corp"
                    className="w-full pl-12 pr-6 py-4 bg-[#F9F9FA] border border-[rgba(28,28,28,0.06)] rounded-2xl text-[15px] font-medium font-mono focus:border-blue-500/50 focus:bg-white outline-none transition-all shadow-sm"
                    required
                  />
                </div>
                <p className="mt-3 text-[11px] text-[rgba(28,28,28,0.4)] leading-relaxed italic px-1">Unique identifier used for subdomains and deep linking (no spaces).</p>
              </div>

              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl text-[13px] font-bold border border-red-100">
                  <Activity size={16} /> {error}
                </div>
              )}

              <button 
                type="submit"
                className="w-full py-5 bg-blue-600 text-white rounded-[24px] text-base font-bold shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:shadow-blue-500/30 transition-all transform active:scale-[0.98] mt-4 flex items-center justify-center gap-3"
              >
                <CheckCircle2 size={20} />
                Provision Organization
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
