import React, { useEffect, useState } from 'react';
import logo from '../assets/logo.png';
import { Link } from 'lucide-react';

export const SnowSplashScreen: React.FC<{ isReady: boolean, onFinished?: () => void }> = ({ isReady, onFinished }) => {
  const [shouldRender, setShouldRender] = useState(true);
  const [fadeStatus, setFadeStatus] = useState<'in' | 'out'>('in');

  useEffect(() => {
    if (isReady) {
      setTimeout(() => {
        setFadeStatus('out');
        setTimeout(() => {
          setShouldRender(false);
          onFinished?.();
        }, 800);
      }, 1500); // Show for at least 1.5s for branding impact
    }
  }, [isReady]);

  if (!shouldRender) return null;

  return (
    <div 
      className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#1C1C1C] transition-opacity duration-700 ease-in-out ${fadeStatus === 'out' ? 'opacity-0' : 'opacity-100'}`}
    >
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/10 blur-[120px] rounded-full" />
      
      <div className="relative flex flex-col items-center gap-6 animate-in zoom-in-95 duration-1000">
         <div className="w-32 h-32 rounded-[32px] bg-white/5 border border-white/10 flex items-center justify-center shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            <img src={logo} alt="Connect-X" className="w-24 h-24 object-contain relative z-10 animate-pulse drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
         </div>

         <div className="flex flex-col items-center">
            <h1 className="text-4xl font-extrabold text-white tracking-tighter mb-1">
               Remote 365
            </h1>
            <div className="flex items-center gap-3">
               <div className="h-[1px] w-8 bg-white/20" />
               <span className="text-[10px] font-bold text-white/40 uppercase tracking-[0.3em]">Secure Node Mesh</span>
               <div className="h-[1px] w-8 bg-white/20" />
            </div>
         </div>
      </div>

      <div className="absolute bottom-16 flex flex-col items-center gap-4">
         <div className="w-48 h-[2px] bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-white/60 loading-progress-bar rounded-full" />
         </div>
         <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest">Initialising Secure Signalling...</span>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes loading-progress {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 100%; transform: translateX(0%); }
          100% { width: 0%; transform: translateX(100%); }
        }
        .loading-progress-bar {
          animation: loading-progress 2s cubic-bezier(0.65, 0, 0.35, 1) infinite;
        }
      `}} />
    </div>
  );
};
