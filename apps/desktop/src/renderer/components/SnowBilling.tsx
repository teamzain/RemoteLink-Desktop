import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Zap,
  Star,
  Crown,
  Package,
  FlaskConical,
  ArrowRight,
  Loader2,
  Check,
  Users,
  Monitor,
} from 'lucide-react';
import api from '../lib/api';
import { useAuthStore } from '../store/authStore';

interface Plan {
  id: string;
  name: string;
  price: number | null;
  priceLabel: string;
  description: string;
  maxDevices: number | null;
  maxUsers: number | null;
  features: string[];
}

interface SnowBillingProps {
  user: any;
  currentPlan?: any;
  onUpgrade?: () => void;
  invoices?: any[];
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  FREE:       <Package  size={20} />,
  PRO:        <Zap      size={20} />,
  BUSINESS:   <Star     size={20} />,
  ENTERPRISE: <Crown    size={20} />,
};

const PLAN_ACCENT: Record<string, { color: string; bg: string; border: string }> = {
  FREE:       { color: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-200'  },
  PRO:        { color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-200'   },
  BUSINESS:   { color: 'text-purple-600', bg: 'bg-purple-50',  border: 'border-purple-200' },
  ENTERPRISE: { color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-200'  },
};

export const SnowBilling: React.FC<SnowBillingProps> = ({ user }) => {
  const setAuth = useAuthStore(s => s.setAuth);
  const accessToken = useAuthStore(s => s.accessToken);
  const refreshToken = useAuthStore(s => s.refreshToken);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [activePlan, setActivePlan] = useState<string>(user?.plan || 'FREE');
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);
  const [successPlan, setSuccessPlan] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        api.get('/api/billing/plans'),
        api.get('/api/billing/subscription'),
      ]);
      setPlans(plansRes.data);
      setActivePlan(subRes.data.plan);
    } catch (err) {
      console.error('Failed to fetch billing info', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchPlan = async (planId: string) => {
    if (planId === activePlan || switching) return;
    setSwitching(planId);
    try {
      await api.patch('/api/billing/my-plan', { plan: planId });
      setActivePlan(planId);
      setSuccessPlan(planId);
      setTimeout(() => setSuccessPlan(null), 3000);

      // Update the user object in the auth store so plan reflects everywhere immediately
      if (user && accessToken) {
        setAuth({ ...user, plan: planId }, accessToken, refreshToken || '');
      }
    } catch (err) {
      console.error('Plan switch failed', err);
    } finally {
      setSwitching(null);
    }
  };

  const currentPlanMeta = PLAN_ACCENT[activePlan] || PLAN_ACCENT.FREE;
  const currentPlanData = plans.find(p => p.id === activePlan);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-inter pb-10">

      {/* Test Mode Banner */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-amber-50 border border-amber-200 rounded-2xl">
        <FlaskConical size={16} className="text-amber-600 flex-shrink-0" />
        <div>
          <span className="text-xs font-bold text-amber-700">Test Mode Active — </span>
          <span className="text-xs text-amber-600 font-medium">
            Plan changes take effect instantly with no real charges. Use this to test features at each tier before going live with Stripe.
          </span>
        </div>
      </div>

      {/* Current Plan Card */}
      <div className="bg-[#1C1C1C] rounded-[24px] p-8 text-white relative overflow-hidden shadow-xl shadow-black/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 blur-[80px] -mr-32 -mt-32 rounded-full" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Active Subscription</p>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-3xl font-bold tracking-tight">
                {loading ? '—' : (currentPlanData?.name || activePlan)}
              </h2>
              <span className="px-2 py-0.5 bg-white/10 rounded-lg text-[10px] font-bold uppercase tracking-wider text-white/60">
                {loading ? '…' : (currentPlanData?.priceLabel || 'Free')}
              </span>
            </div>
            <p className="text-sm text-white/40 font-medium">{currentPlanData?.description || 'Your current plan'}</p>
          </div>
          <div className="flex flex-wrap gap-5">
            <div className="flex flex-col items-center gap-1">
              <Monitor size={18} className="text-white/30" />
              <span className="text-lg font-bold text-white">{currentPlanData?.maxDevices ?? '∞'}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Devices</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Users size={18} className="text-white/30" />
              <span className="text-lg font-bold text-white">{currentPlanData?.maxUsers ?? '∞'}</span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-white/30">Users</span>
            </div>
          </div>
        </div>

        {currentPlanData && (
          <div className="mt-6 pt-6 border-t border-white/[0.06] flex flex-wrap gap-x-6 gap-y-2">
            {currentPlanData.features.map(f => (
              <div key={f} className="flex items-center gap-2">
                <CheckCircle2 size={11} className="text-white/30 flex-shrink-0" />
                <span className="text-[11px] text-white/50 font-medium">{f}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Plan Cards */}
      <div>
        <h3 className="text-sm font-bold text-[#1C1C1C] mb-4 px-1">
          {loading ? 'Loading plans…' : 'Available Plans'}
        </h3>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-52 bg-[rgba(28,28,28,0.04)] rounded-[20px] animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {plans.map(plan => {
              const accent = PLAN_ACCENT[plan.id] || PLAN_ACCENT.FREE;
              const isActive = plan.id === activePlan;
              const isSwitching = switching === plan.id;
              const isSuccess = successPlan === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`relative rounded-[20px] border p-6 transition-all duration-200 ${
                    isActive
                      ? `${accent.bg} ${accent.border} shadow-sm`
                      : 'bg-white border-[rgba(28,28,28,0.06)] hover:border-[rgba(28,28,28,0.2)] hover:shadow-md hover:shadow-black/5'
                  }`}
                >
                  {/* Active badge */}
                  {isActive && (
                    <div className={`absolute top-4 right-4 px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider ${accent.bg} ${accent.color} border ${accent.border}`}>
                      Current
                    </div>
                  )}

                  {/* Plan header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-white shadow-sm' : 'bg-[rgba(28,28,28,0.04)]'} ${accent.color}`}>
                      {PLAN_ICONS[plan.id]}
                    </div>
                    <div>
                      <h4 className="font-bold text-[#1C1C1C]">{plan.name}</h4>
                      <p className="text-[11px] text-[rgba(28,28,28,0.4)] font-medium">{plan.priceLabel}</p>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-1.5 mb-5">
                    {plan.features.slice(0, 4).map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <Check size={11} className={`flex-shrink-0 ${isActive ? accent.color : 'text-[rgba(28,28,28,0.25)]'}`} />
                        <span className="text-[11px] text-[rgba(28,28,28,0.6)] font-medium">{f}</span>
                      </div>
                    ))}
                    {plan.features.length > 4 && (
                      <span className="text-[10px] text-[rgba(28,28,28,0.35)] font-medium pl-4">
                        +{plan.features.length - 4} more features
                      </span>
                    )}
                  </div>

                  {/* Action button */}
                  {isActive ? (
                    <div className={`w-full py-2.5 rounded-xl text-xs font-bold text-center ${accent.color} ${accent.bg} border ${accent.border}`}>
                      Active Plan
                    </div>
                  ) : (
                    <button
                      onClick={() => handleSwitchPlan(plan.id)}
                      disabled={!!switching}
                      className="w-full py-2.5 rounded-xl text-xs font-bold bg-[#1C1C1C] text-white hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSwitching ? (
                        <><Loader2 size={13} className="animate-spin" /> Switching…</>
                      ) : isSuccess ? (
                        <><CheckCircle2 size={13} /> Switched!</>
                      ) : (
                        <>Switch to {plan.name} <ArrowRight size={13} /></>
                      )}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Account info */}
      <div className="bg-[#F9F9FA] rounded-[24px] border border-[rgba(28,28,28,0.04)] p-6">
        <h3 className="text-sm font-bold text-[#1C1C1C] mb-5">Billing Account</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Registered Email</span>
            <span className="text-xs font-bold text-[#1C1C1C]">{user?.email || '—'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Account Role</span>
            <span className="text-xs font-bold text-[#1C1C1C]">{user?.role?.replace('_', ' ') || 'Member'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Payment Processing</span>
            <span className="text-xs font-bold text-amber-600">Test Mode (No Charges)</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Currency</span>
            <span className="text-xs font-bold text-[#1C1C1C]">USD ($)</span>
          </div>
        </div>
      </div>

    </div>
  );
};
