import React from 'react';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Zap,
  Download,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';

interface SnowBillingProps {
  user: any;
}

export const SnowBilling: React.FC<SnowBillingProps> = ({ user }) => {
  const currentPlan = user?.plan || 'Free Tier';
  
  const history = [
    { id: 'inv_102', date: 'Mar 01, 2026', amount: '$0.00', status: 'Completed' },
    { id: 'inv_101', date: 'Feb 01, 2026', amount: '$0.00', status: 'Completed' },
    { id: 'inv_100', date: 'Jan 01, 2026', amount: '$0.00', status: 'Completed' },
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500 font-inter">
      
      {/* Active Subscription Card */}
      <div className="bg-[#1C1C1C] rounded-[24px] p-8 text-white relative overflow-hidden shadow-xl shadow-black/10">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/20 blur-[100px] -mr-32 -mt-32" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-[80px] -ml-16 -mb-16" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className="px-2 py-0.5 bg-white/10 rounded-full border border-white/10">
                 <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Current Plan</span>
              </div>
            </div>
            <h2 className="text-3xl font-bold tracking-tight mb-2">{currentPlan}</h2>
            <p className="text-sm text-white/50 font-medium">Your subscription renews on <span className="text-white/80">April 01, 2026</span></p>
          </div>

          <button className="h-11 px-8 bg-white text-[#1C1C1C] rounded-xl font-bold text-sm hover:bg-white/90 transition-all flex items-center gap-2">
             Upgrade Plan <ArrowUpRight size={16} />
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-white/5 flex flex-wrap gap-8">
           {[
             { label: 'Cloud Relays', val: 'Unlimited', icon: Zap },
             { label: 'Host Capacity', val: 'Up to 5 Devices', icon: CreditCard },
             { label: 'SLA Guarantee', val: '99.9%', icon: CheckCircle2 }
           ].map((feat, i) => (
             <div key={i} className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/40">
                 <feat.icon size={14} />
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
        <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
             <h3 className="text-sm font-semibold text-[#1C1C1C]">Payment Method</h3>
             <button className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">Edit</button>
          </div>

          <div className="p-4 bg-[rgba(28,28,28,0.02)] rounded-2xl border border-[rgba(28,28,28,0.04)] flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="w-12 h-8 bg-[#1C1C1C] rounded-md flex items-center justify-center text-white italic font-bold">VISA</div>
               <div className="flex flex-col">
                  <span className="text-sm font-bold text-[#1C1C1C]">Visa ending in 4242</span>
                  <span className="text-[11px] text-[rgba(28,28,28,0.4)] font-medium">Expires 12/28</span>
               </div>
            </div>
            <CheckCircle2 size={16} className="text-[#71DD8C]" />
          </div>

          <div className="mt-4 p-3 bg-orange-50/50 border border-orange-100/50 rounded-xl flex gap-3">
             <AlertTriangle size={14} className="text-orange-400 shrink-0 mt-0.5" />
             <p className="text-[10px] text-orange-600/80 font-medium leading-normal">
               You are using a mock payment method for this beta session. No actual charges will occur.
             </p>
          </div>
        </div>

        {/* Quick Details */}
        <div className="bg-[#F9F9FA] rounded-[24px] border border-[rgba(28,28,28,0.04)] p-6">
           <h3 className="text-sm font-semibold text-[#1C1C1C] mb-6">Billing Info</h3>
           <div className="space-y-4">
             <div className="flex items-center justify-between">
                <span className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Registered Email</span>
                <span className="text-xs font-bold text-[#1C1C1C]">{user?.email || 'user@example.com'}</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Billing Address</span>
                <span className="text-xs font-bold text-[#1C1C1C] text-right">No address on file</span>
             </div>
             <div className="flex items-center justify-between">
                <span className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Currency</span>
                <span className="text-xs font-bold text-[#1C1C1C]">USD ($)</span>
             </div>
           </div>
        </div>

      </div>

      {/* Invoice History */}
      <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-[#1C1C1C] mb-4">Payment History</h3>
        <div className="overflow-hidden">
           <table className="w-full">
             <thead>
               <tr className="border-b border-[rgba(0,0,0,0.04)] text-left">
                 <th className="pb-3 text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Invoice ID</th>
                 <th className="pb-3 text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Date</th>
                 <th className="pb-3 text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Amount</th>
                 <th className="pb-3 text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider">Status</th>
                 <th className="pb-3 text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-wider"></th>
               </tr>
             </thead>
             <tbody className="divide-y divide-[rgba(0,0,0,0.02)]">
               {history.map((inv, i) => (
                 <tr key={i} className="group hover:bg-[rgba(28,28,28,0.01)] transition-colors">
                   <td className="py-4 text-xs font-bold text-[#1C1C1C]">{inv.id}</td>
                   <td className="py-4 text-xs font-medium text-[rgba(28,28,28,0.4)]">{inv.date}</td>
                   <td className="py-4 text-xs font-bold text-[#1C1C1C]">{inv.amount}</td>
                   <td className="py-4">
                     <span className="px-2 py-0.5 bg-[rgba(113,221,140,0.1)] text-[#71DD8C] rounded-full text-[10px] font-bold uppercase tracking-wider">
                       {inv.status}
                     </span>
                   </td>
                   <td className="py-4 text-right">
                     <button className="p-2 text-[rgba(28,28,28,0.2)] hover:text-[#1C1C1C] transition-colors"><Download size={14} /></button>
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
