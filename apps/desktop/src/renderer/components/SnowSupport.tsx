import React from 'react';
import { 
  LifeBuoy, 
  Search, 
  MessageCircle, 
  Mail, 
  ExternalLink, 
  ShieldCheck, 
  Globe, 
  Zap, 
  History,
  ChevronRight,
  Plus
} from 'lucide-react';

export const SnowSupport: React.FC = () => {
  const commonTopics = [
    { title: 'Global Node Optimization', icon: Globe, color: 'text-blue-500', bg: 'bg-blue-50/50' },
    { title: 'Identity & Access Keys', icon: ShieldCheck, color: 'text-[#10B981]', bg: 'bg-[#10B981]/10' },
    { title: 'P2P Signaling Over Relays', icon: Zap, color: 'text-[#F59E0B]', bg: 'bg-[#F59E0B]/10' }
  ];

  const tickets = [
    { id: 'TIC-9821', subject: 'Node Latency in SEA Region', status: 'In Review', date: '2 hours ago' },
    { id: 'TIC-9745', subject: 'Billing Discrepancy (Enterprise)', status: 'Closed', date: 'Last week' }
  ];

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 font-inter pb-20">
      
      {/* Support Hero */}
      <div className="bg-[#1C1C1C] rounded-[40px] p-12 text-white relative overflow-hidden shadow-xl">
         <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/20 blur-[100px] -mr-32 -mt-32 rounded-full" />
         
         <div className="relative z-10 max-w-xl">
            <h1 className="text-4xl font-extrabold tracking-tight mb-4">How can we help?</h1>
            <p className="text-white/40 text-lg font-medium mb-8">
               Our global support engineers are available 24/7 to solve your node connectivity and network scaling issues.
            </p>
            
            <div className="flex items-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 pl-5 pr-2 py-2 w-full focus-within:ring-2 focus-within:ring-white/20 transition-all">
               <Search size={18} className="text-white/40 mr-3" />
               <input placeholder="Search help articles, tickets, nodes..." className="bg-transparent border-none outline-none text-sm text-white placeholder:text-white/20 w-full" />
               <button className="px-5 py-2 bg-white text-[#1C1C1C] rounded-xl text-xs font-bold hover:opacity-90 transition-all">Search</button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         {commonTopics.map((topic, i) => (
           <div key={i} className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm hover:border-[rgba(28,28,28,0.2)] transition-all cursor-pointer group">
              <div className={`w-12 h-12 rounded-2xl ${topic.bg} ${topic.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <topic.icon size={24} />
              </div>
              <h3 className="text-sm font-bold text-[#1C1C1C] mb-2">{topic.title}</h3>
              <p className="text-[10px] font-medium text-[rgba(28,28,28,0.4)] leading-relaxed">
                 Access our technical guides for optimizing your localized node presence.
              </p>
           </div>
         ))}
      </div>

      <div className="flex flex-col md:flex-row gap-8">
         {/* Help History - Ticket List */}
         <div className="flex-[2] bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
            <div className="flex items-center justify-between mb-8">
               <h3 className="text-lg font-bold text-[#1C1C1C] tracking-tight flex items-center gap-3">
                 <History size={18} className="text-[rgba(28,28,28,0.2)]" /> Active Assistance Cases
               </h3>
               <button className="flex items-center gap-2 px-4 py-2 bg-[rgba(28,28,28,0.02)] hover:bg-[rgba(28,28,28,0.05)] text-[#1C1C1C] rounded-xl text-[10px] font-bold border border-[rgba(28,28,28,0.04)] transition-all">
                  <Plus size={14} /> New Case
               </button>
            </div>
            
            <div className="space-y-4">
               {tickets.map((ticket, i) => (
                 <div key={i} className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[24px] border border-[rgba(28,28,28,0.02)] hover:border-[rgba(28,28,28,0.1)] transition-all cursor-pointer group">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[rgba(28,28,28,0.4)] group-hover:text-black shadow-sm">
                          <MessageCircle size={18} />
                       </div>
                       <div className="flex flex-col">
                          <span className="text-xs font-bold text-[#1C1C1C]">{ticket.subject}</span>
                          <span className="text-[10px] text-[rgba(28,28,28,0.4)]">{ticket.id} • Last activity {ticket.date}</span>
                       </div>
                    </div>
                    <div className="flex items-center gap-4">
                       <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${ticket.status === 'Closed' ? 'bg-slate-200 text-slate-500' : 'bg-[#71DD8C]/20 text-[#71DD8C]'}`}>
                          {ticket.status}
                       </span>
                       <ChevronRight size={14} className="text-[rgba(28,28,28,0.1)] group-hover:text-[rgba(28,28,28,0.3)] transition-colors" />
                    </div>
                 </div>
               ))}
            </div>
         </div>

         {/* Quick Contact Panel */}
         <div className="flex-1 space-y-4">
            <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm flex flex-col items-center text-center">
               <div className="w-16 h-16 bg-blue-50 rounded-[20px] text-blue-500 flex items-center justify-center mb-6">
                 <MessageCircle size={32} />
               </div>
               <h3 className="text-sm font-bold text-[#1C1C1C] mb-2">Live Tech Support</h3>
               <p className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium mb-6 leading-relaxed">
                  Start an encrypted P2P session with a Support Engineer for immediate triage.
               </p>
               <button className="w-full py-3 bg-[#1C1C1C] text-white rounded-2xl text-xs font-bold shadow-lg shadow-black/10 hover:opacity-95 transition-all">Start Chat Case</button>
            </div>

            <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm flex flex-col items-center text-center">
               <div className="w-16 h-16 bg-[#10B981]/10 rounded-[20px] text-[#10B981] flex items-center justify-center mb-6">
                 <Mail size={32} />
               </div>
               <h3 className="text-sm font-bold text-[#1C1C1C] mb-2">Technical Ticketing</h3>
               <p className="text-[10px] text-[rgba(28,28,28,0.4)] font-medium mb-6 leading-relaxed">
                  Submit a structured report for complex global networking bugs. 
               </p>
               <button className="w-full py-3 bg-[#F9F9FA] text-[#1C1C1C] rounded-2xl text-xs font-bold border border-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.2)] transition-all">Send Report</button>
            </div>
         </div>
      </div>

    </div>
  );
};
