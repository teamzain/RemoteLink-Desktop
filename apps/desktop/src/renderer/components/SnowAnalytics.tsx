import React, { useState, useEffect } from 'react';
import { 
  Users, Building2, Monitor, TrendingUp, ArrowUpRight, 
  Calendar, Shield, Activity, Search, ChevronRight,
  PieChart as PieIcon, CreditCard, DollarSign
} from 'lucide-react';
import api from '../lib/api';

interface AnalyticsData {
  users: {
    total: number;
    last24h: number;
    last7d: number;
    trend: { date: string; count: number }[];
  };
  orgs: {
    total: number;
  };
  devices: {
    total: number;
    health?: {
      cpuUsage: number;
      memoryLoad: number;
      bandwidth: string;
      adapterUsage: number;
    };
  };
  recentUsers: any[];
}

interface RevenueData {
  totalRevenue: number;
  availableBalance: number;
  pendingBalance: number;
  currency: string;
  subscriptions: { plan: string; _count: number }[];
}

export const SnowAnalytics: React.FC = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const [analyticsRes, revenueRes] = await Promise.all([
        api.get('/api/analytics/summary'),
        api.get('/api/billing/revenue')
      ]);
      setData(analyticsRes.data);
      setRevenue(revenueRes.data);
    } catch (err: any) {
      console.error('Failed to fetch analytics:', err);
      // If 403, we show a synchronization error which indicates the user needs to re-login
    } finally {
      setLoading(false);
    }
  };

  if (loading || !data || !revenue) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-[rgba(28,28,28,0.05)] border-t-[#1C1C1C] rounded-full animate-spin mb-4" />
        <p className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-[0.2em]">
          {loading ? 'Aggregating Platform Data...' : 'Synchronization Error. Retrying...'}
        </p>
      </div>
    );
  }

  const maxTrend = Math.max(...data.users.trend.map(t => t.count), 1);

  return (
    <div className="max-w-6xl mx-auto space-y-10 py-6 animate-in fade-in duration-700">
      
      {/* Platform Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Registered Customers', value: data.users?.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Registered Devices', value: data.devices?.total, icon: Monitor, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Organizations', value: data.orgs?.total, icon: Building2, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Total Revenue', value: `$${revenue.totalRevenue?.toFixed(2)}`, icon: DollarSign, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[24px] border border-[rgba(28,28,28,0.06)] shadow-sm hover:shadow-md transition-all group">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center transition-transform group-hover:scale-110`}>
                <stat.icon size={20} />
              </div>
              <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <TrendingUp size={10} />
                <span>+12%</span>
              </div>
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black text-[#1C1C1C] tracking-tight">{stat.value}</span>
              <span className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest mt-1">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Platform Health Metrics */}
      <div className="bg-white p-8 rounded-[32px] border border-[rgba(28,28,28,0.06)] shadow-sm">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-lg font-black text-[#1C1C1C] uppercase tracking-tight">Platform Node Health</h3>
            <p className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest mt-1">Average real-time performance across all registered devices</p>
          </div>
          <div className="flex gap-4">
             <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 rounded-lg border border-emerald-100">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
               <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Systems Online</span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-[11px] font-black tracking-widest text-[#1C1C1C] uppercase">CPU Usage</span>
              <span className="text-[11px] font-mono text-[rgba(28,28,28,0.4)]">{data.devices?.health?.cpuUsage}%</span>
            </div>
            <div className="h-2 bg-[#F9F9FA] rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 rounded-full transition-all duration-1000"
                style={{ width: `${data.devices?.health?.cpuUsage}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-[11px] font-black tracking-widest text-[#1C1C1C] uppercase">Memory Load</span>
              <span className="text-[11px] font-mono text-[rgba(28,28,28,0.4)]">{data.devices?.health?.memoryLoad}%</span>
            </div>
            <div className="h-2 bg-[#F9F9FA] rounded-full overflow-hidden">
              <div 
                className="h-full bg-purple-500 rounded-full transition-all duration-1000"
                style={{ width: `${data.devices?.health?.memoryLoad}%` }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-[11px] font-black tracking-widest text-[#1C1C1C] uppercase">Bandwidth Utilization</span>
              <span className="text-[11px] font-mono text-[rgba(28,28,28,0.4)]">{data.devices?.health?.bandwidth} Mbps</span>
            </div>
            <div className="h-2 bg-[#F9F9FA] rounded-full overflow-hidden">
              <div 
                className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                style={{ width: '65%' }}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-end">
              <span className="text-[11px] font-black tracking-widest text-[#1C1C1C] uppercase">Adapter Usage</span>
              <span className="text-[11px] font-mono text-[rgba(28,28,28,0.4)]">{data.devices?.health?.adapterUsage}%</span>
            </div>
            <div className="h-2 bg-[#F9F9FA] rounded-full overflow-hidden">
              <div 
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000"
                style={{ width: `${data.devices?.health?.adapterUsage}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* User Growth Chart */}
        <div className="lg:col-span-2 bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-10">
            <div>
              <h3 className="text-lg font-black text-[#1C1C1C] uppercase tracking-tight">Registration Trends</h3>
              <p className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest mt-1">Daily user growth over the last 7 days</p>
            </div>
            <div className="flex gap-2">
              <div className="px-3 py-1.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.04)] text-[10px] font-bold text-[rgba(28,28,28,0.6)] uppercase tracking-widest">
                Last 7 Days
              </div>
            </div>
          </div>

          <div className="h-64 flex items-end justify-between gap-4 px-2">
            {data?.users.trend.map((t, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-4 group">
                <div className="relative w-full flex flex-col items-center">
                   {/* Tooltip */}
                   <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-[#1C1C1C] text-white text-[10px] font-bold px-2 py-1 rounded-lg mb-2 whitespace-nowrap">
                    {t.count} Users
                  </div>
                  {/* Bar */}
                  <div 
                    className="w-full max-w-[40px] bg-[#1C1C1C] rounded-t-xl transition-all duration-1000 group-hover:bg-blue-600" 
                    style={{ height: `${(t.count / maxTrend) * 200}px`, minHeight: '4px' }}
                  />
                </div>
                <span className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-tighter">{t.date}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="bg-[#1C1C1C] rounded-[32px] p-8 text-white shadow-xl shadow-black/10 flex flex-col">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <PieIcon size={20} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-widest">Subscriptions</h3>
              <p className="text-[10px] font-bold text-white/40 uppercase tracking-[0.2em]">Active Paid Plans</p>
            </div>
          </div>

          <div className="space-y-6 flex-grow">
            {['PRO', 'BUSINESS', 'ENTERPRISE'].map((plan) => {
              const stat = revenue?.subscriptions.find(s => s.plan === plan);
              const count = stat?._count || 0;
              const totalSubs = revenue?.subscriptions.reduce((acc, s) => acc + s._count, 0) || 1;
              const percentage = (count / totalSubs) * 100;

              return (
                <div key={plan} className="space-y-2">
                  <div className="flex justify-between items-end">
                    <span className="text-[11px] font-black tracking-widest">{plan}</span>
                    <span className="text-[11px] font-mono text-white/60">{count} Active</span>
                  </div>
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        plan === 'PRO' ? 'bg-blue-400' : 
                        plan === 'BUSINESS' ? 'bg-purple-400' : 'bg-amber-400'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 pt-8 border-t border-white/5 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-white/30 uppercase tracking-[0.2em] mb-1">Available Payout</p>
              <p className="text-2xl font-black tracking-tighter">${revenue?.availableBalance.toFixed(2)}</p>
            </div>
            <div className="w-12 h-12 bg-emerald-500/20 border border-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400">
              <ArrowUpRight size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] overflow-hidden shadow-sm">
        <div className="p-8 border-b border-[rgba(28,28,28,0.04)] flex items-center justify-between">
          <div>
            <h3 className="text-lg font-black text-[#1C1C1C] uppercase tracking-tight">Recent Sign-ups</h3>
            <p className="text-[10px] font-bold text-[rgba(28,28,28,0.4)] uppercase tracking-widest mt-1">Latest user accounts across all organizations</p>
          </div>
          <button className="text-[10px] font-black text-[#1C1C1C] uppercase tracking-widest bg-[#F9F9FA] px-4 py-2 rounded-xl border border-[rgba(28,28,28,0.06)] hover:bg-white transition-all">
            View All Users
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-[#F9F9FA]/50">
                <th className="px-8 py-4 text-left text-[10px] font-black text-[rgba(28,28,28,0.3)] uppercase tracking-widest">User / Email</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-[rgba(28,28,28,0.3)] uppercase tracking-widest">Organization</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-[rgba(28,28,28,0.3)] uppercase tracking-widest">Role</th>
                <th className="px-8 py-4 text-left text-[10px] font-black text-[rgba(28,28,28,0.3)] uppercase tracking-widest">Joined At</th>
                <th className="px-8 py-4 text-right text-[10px] font-black text-[rgba(28,28,28,0.3)] uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(28,28,28,0.04)]">
              {data?.recentUsers.map((u, i) => (
                <tr key={i} className="hover:bg-[rgba(28,28,28,0.01)] transition-colors group">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-[#1C1C1C] rounded-xl flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0">
                        {u.name?.[0]?.toUpperCase() || u.email[0].toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-[#1C1C1C]">{u.name || 'Anonymous'}</span>
                        <span className="text-[10px] font-medium text-[rgba(28,28,28,0.4)]">{u.email}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[11px] font-bold text-[#1C1C1C]">{u.organization?.name || 'Personal'}</span>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg uppercase tracking-tighter ${
                      u.role === 'SUPER_ADMIN' ? 'bg-red-50 text-red-600' :
                      u.role === 'SUB_ADMIN' ? 'bg-purple-50 text-purple-600' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[11px] font-mono text-[rgba(28,28,28,0.4)]">{new Date(u.createdAt).toLocaleDateString()}</span>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] hover:bg-[#F9F9FA] rounded-xl transition-all">
                      <ChevronRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
