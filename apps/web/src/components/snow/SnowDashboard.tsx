import React from 'react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RTooltip, 
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart, 
  Bar, 
  Cell, 
  PieChart, 
  Pie 
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, ShieldCheck, Zap } from 'lucide-react';

const performanceData = [
  { name: 'Jan', current: 6000, previous: 4000 },
  { name: 'Feb', current: 8000, previous: 3000 },
  { name: 'Mar', current: 5000, previous: 2000 },
  { name: 'Apr', current: 11000, previous: 2780 },
  { name: 'May', current: 16000, previous: 1890 },
  { name: 'Jun', current: 14000, previous: 2390 },
  { name: 'Jul', current: 20000, previous: 3490 },
];

const locationData = [
  { name: 'United States', value: 52.1, fill: '#000000' },
  { name: 'Canada', value: 22.8, fill: '#7DBBFF' },
  { name: 'Mexico', value: 13.9, fill: '#71DD8C' },
  { name: 'Other', value: 11.2, fill: '#A0BCE8' },
];

interface MetricCardProps {
  title: string;
  value: string;
  trend: string;
  isPositive: boolean;
  bg: string;
}

const MetricCard: React.FC<MetricCardProps & { data?: any[] }> = ({ title, value, trend, isPositive, bg, data }) => (
  <div className={`p-4 lg:p-5 rounded-[24px] flex-1 min-w-[160px] sm:min-w-[220px] flex flex-col gap-2 lg:gap-3 ${bg} border border-[rgba(28,28,28,0.04)] shadow-sm hover:shadow-md transition-all duration-300 group`}>
    <div className="flex justify-between items-start">
      <span className="text-[11px] font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-[0.1em]">{title}</span>
      <div className={`px-2 py-0.5 rounded-lg text-[9px] font-black flex items-center gap-1 uppercase tracking-tighter ${isPositive ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'}`}>
        {trend} {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      </div>
    </div>
    
    <div className="flex items-end justify-between">
      <div className="flex flex-col">
        <span className="text-xl lg:text-2xl font-bold text-[#1C1C1C] tracking-tight">{value}</span>
      </div>
      
      {/* Sparkline Chart */}
      <div className="w-16 lg:w-20 h-8 lg:h-10 -mb-1 opacity-60 group-hover:opacity-100 transition-opacity">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data || [
            { v: 10 }, { v: 15 }, { v: 8 }, { v: 22 }, { v: 18 }, { v: 25 }
          ]}>
            <Line 
              type="monotone" 
              dataKey="v" 
              stroke={isPositive ? '#10B981' : '#EF4444'} 
              strokeWidth={2} 
              dot={false} 
              isAnimationActive={true}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 backdrop-blur text-white p-3 rounded-xl text-xs shadow-xl border border-white/10">
        <p className="font-semibold mb-1">{label}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.payload.fill }} />
            <span>{entry.name}: {entry.value}</span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export const SnowDashboard: React.FC<{
  devices: any[];
}> = ({ devices }) => {
  const [streamData, setStreamData] = React.useState(performanceData);

  // Dynamically calculate OS distribution from connected devices
  const osDistribution = React.useMemo(() => {
    const counts: Record<string, number> = { Windows: 0, Mac: 0, iOS: 0, Android: 0, Linux: 0, Other: 0 };
    devices.forEach(d => {
      const type = (d.device_type || '').toLowerCase();
      if (type.includes('win')) counts.Windows++;
      else if (type.includes('mac') || type.includes('apple') || type.includes('darwin')) counts.Mac++;
      else if (type.includes('ios') || type.includes('iphone') || type.includes('ipad')) counts.iOS++;
      else if (type.includes('android')) counts.Android++;
      else if (type.includes('linux')) counts.Linux++;
      else counts.Other++;
    });
    
    return [
      { name: 'Win', uv: Math.max(counts.Windows, 1), fill: '#7DBBFF' },
      { name: 'Mac', uv: Math.max(counts.Mac, 1), fill: '#6BE6D3' },
      { name: 'iOS', uv: Math.max(counts.iOS, 1), fill: '#000000' },
      { name: 'And', uv: Math.max(counts.Android, 1), fill: '#B899EB' },
      { name: 'Lin', uv: Math.max(counts.Linux, 1), fill: '#A0BCE8' },
      { name: 'Oth', uv: Math.max(counts.Other, 1), fill: '#71DD8C' },
    ];
  }, [devices]);

  const onlineCount = devices.filter(d => d.is_online).length;

  React.useEffect(() => {
    const interval = setInterval(() => {
      setStreamData(prev => {
        const newData = [...prev.slice(1)];
        const last = prev[prev.length - 1];
        newData.push({
          name: last.name,
          current: Math.max(1000, last.current + (Math.random() - 0.5) * 500),
          previous: last.previous
        });
        return newData;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-3xl overflow-hidden relative font-inter transition-all duration-500 shadow-sm border border-[rgba(28,28,28,0.02)]">
      <div className="flex-1 flex flex-col p-4 lg:p-8 pt-6 overflow-y-auto custom-scrollbar bg-[#F8F9FA]/50">
        
        {/* Metric Cards Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
          <MetricCard 
            title="Registered Nodes" 
            value={devices.length.toString()} 
            trend="+12.5%" 
            isPositive={true} 
            bg="bg-white" 
            data={[{v:10}, {v:12}, {v:11}, {v:15}, {v:14}, {v:18}]}
          />
          <MetricCard 
            title="Nodes Online" 
            value={onlineCount.toString()} 
            trend="+2.4%" 
            isPositive={true} 
            bg="bg-white" 
            data={[{v:20}, {v:18}, {v:19}, {v:17}, {v:15}, {v:14}]}
          />
          <MetricCard 
            title="Active Sessions" 
            value={Math.floor(onlineCount * 0.7).toString()} 
            trend="+18.2%" 
            isPositive={true} 
            bg="bg-white" 
            data={[{v:5}, {v:8}, {v:12}, {v:15}, {v:22}, {v:30}]}
          />
          <MetricCard 
            title="P2P Stability" 
            value={onlineCount > 0 ? "99.9%" : "0%"} 
            trend="+0.01%" 
            isPositive={true} 
            bg="bg-white" 
            data={[{v:98}, {v:99}, {v:99.5}, {v:99.8}, {v:99.9}, {v:99.9}]}
          />
        </div>

        {/* Big Line Chart (Performance) */}
        <div className="w-full h-[330px] bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-6 lg:p-8 mb-8 flex flex-col shadow-sm relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[120px] rounded-full translate-x-32 -translate-y-32 transition-all group-hover:bg-blue-500/10" />
           
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 relative z-10">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 lg:gap-6">
                <span className="text-sm font-bold text-[#1C1C1C] tracking-tight">Global Node Traffic</span>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[#1C1C1C]"></div><span className="text-[10px] font-black text-[rgba(28,28,28,0.2)] uppercase tracking-wider">Current</span></div>
                  <div className="flex items-center gap-1.5"><div className="w-1.5 h-1.5 rounded-full bg-[rgba(28,28,28,0.1)]"></div><span className="text-[10px] font-black text-[rgba(28,28,28,0.2)] uppercase tracking-wider">Historical</span></div>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-black text-[#71DD8C] bg-[#71DD8C]/5 px-3 py-1.5 rounded-xl border border-[#71DD8C]/10 uppercase tracking-widest animate-pulse">
                <Zap size={10} /> Live Feed
              </div>
           </div>
           
           <div className="flex-1 w-full relative z-10">
               <ResponsiveContainer width="100%" height="100%">
                 <AreaChart data={streamData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                   <defs>
                     <linearGradient id="colorPrev" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#A0BCE8" stopOpacity={0.1}/>
                       <stop offset="95%" stopColor="#A0BCE8" stopOpacity={0}/>
                     </linearGradient>
                     <linearGradient id="colorCurr" x1="0" y1="0" x2="0" y2="1">
                       <stop offset="5%" stopColor="#000000" stopOpacity={0.05}/>
                       <stop offset="95%" stopColor="#000000" stopOpacity={0}/>
                     </linearGradient>
                   </defs>
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'rgba(28,28,28,0.2)', fontSize: 10, fontWeight: 700}} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: 'rgba(28,28,28,0.2)', fontSize: 10, fontWeight: 700}} tickFormatter={(val) => `${val/1000}K`} />
                   <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" />
                   <RTooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(0,0,0,0.05)', strokeWidth: 1, strokeDasharray: '3 3' }} />
                   
                   <Area type="monotone" dataKey="previous" stroke="rgba(0,0,0,0.1)" strokeWidth={1} strokeDasharray="5 5" fill="url(#colorPrev)" />
                   <Area type="monotone" dataKey="current" stroke="#1C1C1C" strokeWidth={2.5} fill="url(#colorCurr)" animationDuration={1000} />
                 </AreaChart>
               </ResponsiveContainer>
            </div>
        </div>

        {/* Grid for Bottom Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
           {/* OS Distribution Bar Chart */}
           <div className="h-[360px] bg-white border border-[rgba(28,28,28,0.06)] rounded-[32px] p-6 lg:p-8 flex flex-col shadow-sm group">
             <div className="flex justify-between items-center mb-10">
                <div className="flex flex-col">
                  <h3 className="text-xs font-black text-[#1C1C1C] uppercase tracking-widest">Fleet OS Mix</h3>
                  <span className="text-[10px] font-bold text-[rgba(28,28,28,0.2)] mt-1 uppercase">Dynamic Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full bg-blue-500 animate-slow-pulse" />
                   <span className="text-[10px] font-bold text-blue-500 uppercase tracking-wider">Syncing</span>
                </div>
             </div>
             <div className="flex-1 w-full">
               <ResponsiveContainer width="100%" height="100%">
                 <BarChart data={osDistribution} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: 'rgba(28,28,28,0.2)', fontSize: 10, fontWeight: 700}} dy={5} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: 'rgba(28,28,28,0.2)', fontSize: 10, fontWeight: 700}} />
                   <RTooltip cursor={{fill: 'rgba(0,0,0,0.02)'}} contentStyle={{borderRadius: '16px', border: 'none', background: '#1C1C1C', color: 'white'}} />
                   <Bar dataKey="uv" radius={[12, 12, 12, 12]} barSize={28} fill="#1C1C1C" />
                 </BarChart>
               </ResponsiveContainer>
             </div>
           </div>

           {/* Location Distribution Pie Chart */}
           <div className="h-[360px] bg-white border border-[rgba(28,28,28,0.06)] rounded-[32px] p-6 lg:p-8 flex flex-col shadow-sm overflow-hidden">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-xs font-black text-[#1C1C1C] uppercase tracking-widest">Geographic Relay Density</h3>
             </div>
             <div className="flex flex-1 flex-col sm:flex-row items-center justify-center sm:justify-between gap-6 overflow-hidden">
               <div className="w-[180px] h-[180px] shrink-0">
                 <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={locationData}
                       cx="50%"
                       cy="50%"
                       innerRadius={60}
                       outerRadius={80}
                       paddingAngle={8}
                       dataKey="value"
                     >
                       {locationData.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.fill} stroke="none" />
                       ))}
                     </Pie>
                     <RTooltip />
                   </PieChart>
                 </ResponsiveContainer>
               </div>
               <div className="flex-1 grid grid-cols-2 sm:flex sm:flex-col gap-3 sm:gap-4 pl-0 sm:pl-8 w-full">
                 {locationData.map((loc, i) => (
                   <div key={i} className="flex justify-between items-center group cursor-pointer">
                      <div className="flex items-center gap-2 lg:gap-3 shrink-0">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: loc.fill }}></div>
                        <span className="text-[10px] lg:text-xs font-bold text-[#1C1C1C] opacity-60 group-hover:opacity-100 transition-opacity tracking-tight truncate max-w-[80px] lg:max-w-none">{loc.name}</span>
                      </div>
                      <span className="text-[10px] lg:text-xs font-black text-[#1C1C1C]">{loc.value}%</span>
                    </div>
                 ))}
               </div>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
};
