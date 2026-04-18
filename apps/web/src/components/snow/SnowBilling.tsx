import React from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  Zap,
  Download,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';

interface SnowBillingProps {
  billingInfo: any;
  handleUpgrade: () => void;
  handleManagePortal: () => Promise<void>;
}

export const SnowBilling: React.FC<SnowBillingProps> = ({ billingInfo, handleUpgrade, handleManagePortal }) => {
  const currentPlan = billingInfo?.plan || 'Free Tier';
  const renewalDate = billingInfo?.currentPeriodEnd 
    ? new Date(billingInfo.currentPeriodEnd).toLocaleDateString()
    : 'N/A';
  
  const history = billingInfo?.invoices || [
    { id: 'inv_102', date: 'Mar 01, 2026', amount: '$0.00', status: 'Completed' },
    { id: 'inv_101', date: 'Feb 01, 2026', amount: '$0.00', status: 'Completed' },
    { id: 'inv_100', date: 'Jan 01, 2026', amount: '$0.00', status: 'Completed' },
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-inter pb-20">
      
      {/* Active Subscription Card */}
      <div className="bg-[#1C1C1C] rounded-[32px] p-8 text-white relative overflow-hidden shadow-xl shadow-black/10 border border-[rgba(28,28,28,0.04)]">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[100px] -mr-32 -mt-32 rounded-full" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-[80px] -ml-16 -mb-16 rounded-full" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="px-3 py-1 bg-white/10 rounded-full border border-white/10">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Current Subscription</span>
              </div>
            </div>
            <h2 className="text-4xl font-bold tracking-tight mb-2">{currentPlan}</h2>
            <p className="text-sm text-white/50 font-medium">Your subscription {billingInfo?.status === 'active' ? 'renews' : 'expires'} on <span className="text-white/80">{renewalDate}</span></p>
          </div>

          <button 
            onClick={handleUpgrade}
            className="h-12 px-8 bg-white text-[#1C1C1C] rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2 shadow-lg"
          >
             Scale Identity <ArrowUpRight size={16} />
          </button>
        </div>

        <div className="mt-10 pt-10 border-t border-white/5 flex flex-wrap gap-10">
           {[
             { label: 'Cloud Relays', val: 'Unlimited', icon: Zap },
             { label: 'Device Capacity', val: 'Up to 5 Devices', icon: CreditCard },
             { label: 'SLA Guarantee', val: '99.9%', icon: CheckCircle2 }
           ].map((feat, i) => (
             <div key={i} className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-white/40 border border-white/5">
                 <feat.icon size={16} />
               </div>
               <div className="flex flex-col">
                 <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">{feat.label}</span>
                 <span className="text-xs font-bold text-white/80">{feat.val}</span>
               </div>
             </div>
           ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Payment Method */}
        <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
          <div className="flex items-center justify-between mb-8">
             <h3 className="text-sm font-bold text-[#1C1C1C] tracking-tight">Stored Payment Method</h3>
             <button onClick={handleManagePortal} className="text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wider">Configure</button>
          </div>

          <div className="p-5 bg-[rgba(28,28,28,0.02)] rounded-[24px] border border-[rgba(28,28,28,0.04)] flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="w-12 h-8 bg-[#1C1C1C] rounded-lg flex items-center justify-center text-white text-[10px] italic font-black">{billingInfo?.card_brand?.toUpperCase() || 'VISA'}</div>
               <div className="flex flex-col">
                  <span className="text-sm font-bold text-[#1C1C1C]">{billingInfo?.card_brand ? `${billingInfo.card_brand.charAt(0).toUpperCase() + billingInfo.card_brand.slice(1)} ending in ${billingInfo.card_last4}` : 'No card on file'}</span>
                  <span className="text-[11px] text-[rgba(28,28,28,0.4)] font-medium">{billingInfo?.card_exp_month ? `Expires ${billingInfo.card_exp_month}/${billingInfo.card_exp_year}` : 'Add a payment method'}</span>
               </div>
            </div>
            {billingInfo?.card_brand && <CheckCircle2 size={18} className="text-[#71DD8C]" />}
          </div>

          <div className="mt-6 p-4 bg-orange-50/50 border border-orange-100/50 rounded-[18px] flex gap-3">
             <AlertTriangle size={16} className="text-orange-400 shrink-0 mt-0.5" />
             <p className="text-[11px] text-orange-600/80 font-medium leading-relaxed">
               SyncLink uses Stripe for secure terminal billing. You are currently in a test environment.
             </p>
          </div>
        </div>

        {/* Quick Details */}
        <div className="bg-[#F9F9FA] rounded-[32px] border border-[rgba(28,28,28,0.04)] p-8">
           <h3 className="text-sm font-bold text-[#1C1C1C] mb-8 tracking-tight">Terminal Statistics</h3>
           <div className="space-y-5">
             <div className="flex items-center justify-between">
                <span className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Billing Period</span>
                <span className="text-xs font-bold text-[#1C1C1C]">Monthly Sync</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Next Invoice</span>
                <span className="text-xs font-bold text-[#1C1C1C]">{renewalDate}</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Reporting Currency</span>
                <span className="text-xs font-bold text-[#1C1C1C]">USD ($)</span>
             </div>
             <div className="pt-2">
                <div className="flex justify-between mb-2">
                   <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Node Bandwidth Usage</span>
                   <span className="text-[10px] font-bold text-[#1C1C1C]">0.2 GB / 50 GB</span>
                </div>
                <div className="w-full h-1.5 bg-[rgba(28,28,28,0.05)] rounded-full overflow-hidden">
                   <div className="h-full bg-blue-500 w-[2%]" />
                </div>
             </div>
           </div>
        </div>

      </div>

      {/* Invoice History */}
      <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
        <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 tracking-tight">Secure Payment History</h3>
        <div className="overflow-x-auto">
           <table className="w-full">
             <thead>
               <tr className="border-b border-[rgba(0,0,0,0.04)] text-left">
                 <th className="pb-4 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Descriptor</th>
                 <th className="pb-4 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Timestamp</th>
                 <th className="pb-4 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Amount</th>
                 <th className="pb-4 text-[10px] font-bold text-[rgba(28,28,28,0.2)] uppercase tracking-widest">Status</th>
                 <th className="pb-4 w-12"></th>
               </tr>
             </thead>
             <tbody className="divide-y divide-[rgba(0,0,0,0.02)]">
               {history.map((inv: any, i: number) => (
                 <tr key={i} className="group hover:bg-[rgba(28,28,28,0.01)] transition-colors">
                   <td className="py-5 text-xs font-bold text-[#1C1C1C]">{inv.number || inv.id}</td>
                   <td className="py-5 text-xs font-medium text-[rgba(28,28,28,0.4)]">{inv.created ? new Date(inv.created * 1000).toLocaleDateString() : inv.date}</td>
                   <td className="py-5 text-xs font-bold text-[#1C1C1C]">{inv.total ? `$${(inv.total / 100).toFixed(2)}` : inv.amount}</td>
                   <td className="py-5">
                     <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${inv.status === 'paid' || inv.status === 'Completed' ? 'bg-emerald-50 text-emerald-500 border-emerald-100' : 'bg-orange-50 text-orange-500 border-orange-100'}`}>
                       {inv.status}
                     </span>
                   </td>
                   <td className="py-5 text-right">
                     <a href={inv.invoice_pdf} target="_blank" rel="noreferrer" className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors inline-block">
                        <Download size={14} />
                     </a>
                   </td>
                 </tr>
               ))}
               {history.length === 0 && (
                 <tr>
                   <td colSpan={5} className="py-10 text-center text-xs text-[rgba(28,28,28,0.3)] font-medium italic">
                     No mesh invoices generated yet.
                   </td>
                 </tr>
               )}
             </tbody>
           </table>
        </div>
      </div>

    </div>
  );
};
