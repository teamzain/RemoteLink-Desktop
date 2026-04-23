import React, { useState } from 'react';
import {
   User,
   Mail,
   Shield,
   Key,
   Camera,
   MapPin,
   Calendar,
   ChevronRight,
   LogOut,
   Bell,
   Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../../lib/api';
import { notify } from '../NotificationProvider';

export const SnowProfile: React.FC<{ user: any; logout: () => void }> = ({ user, logout }) => {
   const [name, setName] = useState(user?.name || 'ByeWind');
   const [email, setEmail] = useState(user?.email || 'charles@synclink.io');
   const [isDeleting, setIsDeleting] = useState(false);
   const navigate = useNavigate();

   const handleCloseAccount = async () => {
      if (!window.confirm('WARNING: This will permanently delete your account, all devices, and all associated data. This action cannot be undone. Are you sure?')) {
         return;
      }

      setIsDeleting(true);
      try {
         await api.delete('/api/auth/me');
         notify('Your account has been closed and all data has been wiped.', 'success');
         logout();
         navigate('/login');
      } catch (err: any) {
         notify(err.response?.data?.error || 'Failed to close account', 'error');
      } finally {
         setIsDeleting(false);
      }
   };

   return (
      <div className="max-w-4xl mx-auto flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-6 duration-700 font-inter pb-20">

         {/* Profile Header Card */}
         <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 blur-[80px] -mr-32 -mt-32 rounded-full" />

            <div className="relative group">
               <div className="w-24 h-24 rounded-[32px] bg-[rgba(28,28,28,0.04)] flex items-center justify-center overflow-hidden border-2 border-white shadow-md">
                  {user?.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : <div className="text-2xl font-bold text-[#1C1C1C]">{user?.name?.[0]?.toUpperCase() || 'U'}</div>}
               </div>
               <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-[#1C1C1C] text-white flex items-center justify-center border-2 border-white hover:scale-105 transition-transform">
                  <Camera size={14} />
               </button>
            </div>

            <div className="flex flex-col text-center md:text-left">
               <h1 className="text-3xl font-extrabold text-[#1C1C1C] tracking-tight mb-2">{name}</h1>
               <div className="flex items-center justify-center md:justify-start gap-4 text-xs font-bold text-[rgba(28,28,28,0.3)] uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><Shield size={12} className="text-blue-500" /> Enterprise Plan</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-[rgba(28,28,28,0.1)]" />
                  <span className="flex items-center gap-1.5"><MapPin size={12} /> Global Nodes</span>
               </div>
            </div>

            <div className="md:ml-auto flex gap-3">
               <button className="h-10 px-6 bg-white border border-[rgba(28,28,28,0.08)] hover:border-[rgba(28,28,28,0.2)] text-[#1C1C1C] rounded-xl text-xs font-bold transition-all shadow-sm">
                  Share Profile
               </button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Personal Information */}
            <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm border border-[rgba(28,28,28,0.04)]">
               <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 tracking-tight flex items-center gap-2">
                  <User size={16} className="text-blue-500" /> Personal Details
               </h3>

               <div className="space-y-4">
                  <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.02)]">
                     <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase">Display Name</span>
                     <input value={name} onChange={e => setName(e.target.value)} className="bg-transparent text-sm font-semibold text-[#1C1C1C] outline-none" />
                  </div>
                  <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.02)]">
                     <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase">Email Address</span>
                     <input value={email} onChange={e => setEmail(e.target.value)} className="bg-transparent text-sm font-semibold text-[#1C1C1C] outline-none" />
                  </div>
                  <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-[#F9F9FA] rounded-xl border border-[rgba(28,28,28,0.02)]">
                     <span className="text-[10px] font-bold text-[rgba(28,28,28,0.3)] uppercase">Member Since</span>
                     <span className="text-sm font-semibold text-[#1C1C1C] leading-none py-1">March 2026</span>
                  </div>
               </div>
            </div>

            {/* Security & Activity */}
            <div className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-6 shadow-sm border border-[rgba(28,28,28,0.04)]">
               <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 tracking-tight flex items-center gap-2">
                  <Lock size={16} className="text-purple-500" /> Security
               </h3>

               <div className="flex flex-col gap-3">
                  {[
                     { title: 'Password Protection', sub: 'Last changed 2 months ago', icon: Key },
                     { title: 'Login Notifications', sub: 'Alert me on new sessions', icon: Bell },
                     { title: 'Global 2FA Status', sub: 'Authenticated via Device Sync', icon: Shield }
                  ].map((item, i) => (
                     <div key={i} className="flex items-center justify-between p-3.5 hover:bg-[#F9F9FA] rounded-xl border border-transparent hover:border-[rgba(28,28,28,0.04)] transition-all cursor-pointer group">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-[rgba(0,0,0,0.02)] flex items-center justify-center text-[rgba(28,28,28,0.3)] group-hover:text-black">
                              <item.icon size={18} />
                           </div>
                           <div className="flex flex-col">
                              <span className="text-xs font-bold text-[#1C1C1C]">{item.title}</span>
                              <span className="text-[10px] text-[rgba(28,28,28,0.4)]">{item.sub}</span>
                           </div>
                        </div>
                        <ChevronRight size={14} className="text-[rgba(28,28,28,0.1)]" />
                     </div>
                  ))}
               </div>
            </div>
         </div>

         <div className="mt-8 flex justify-between items-center px-4 py-3 bg-[#FFF5F5] border border-red-50 rounded-2xl">
            <div className="flex flex-col">
               <span className="text-xs font-bold text-red-600">Danger Zone</span>
               <span className="text-[10px] text-red-400">Permanently remove all your nodes and account data.</span>
            </div>
            <button
               onClick={handleCloseAccount}
               disabled={isDeleting}
               className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 border border-red-100 rounded-xl text-xs font-bold hover:bg-red-50 transition-colors shadow-sm disabled:opacity-50"
            >
               <LogOut size={14} /> {isDeleting ? 'Closing...' : 'Close Account'}
            </button>
         </div>

      </div>
   );
};
