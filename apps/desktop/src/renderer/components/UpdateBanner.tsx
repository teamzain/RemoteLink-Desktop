import React, { useEffect, useState } from 'react';
import { Download, RefreshCw, X, AlertCircle, CheckCircle } from 'lucide-react';

const UpdateBanner: React.FC = () => {
  const [updateInfo, setUpdateInfo] = useState<any>(null);
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<'available' | 'downloading' | 'downloaded' | 'error' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!(window as any).electronAPI?.updates) return;

    // @ts-ignore
    const unAvailable = window.electronAPI.updates.onAvailable((info: any) => {
      setUpdateInfo(info);
      setStatus('available');
      setVisible(true);
    });

    // @ts-ignore
    const unProgress = window.electronAPI.updates.onDownloadProgress((p: any) => {
      setProgress(p.percent);
      setStatus('downloading');
    });

    // @ts-ignore
    const unDownloaded = window.electronAPI.updates.onDownloaded(() => {
      setStatus('downloaded');
    });

    // @ts-ignore
    const unError = window.electronAPI.updates.onError((err: string) => {
      setError(err);
      setStatus('error');
      setVisible(true);
    });

    window.electronAPI.isPackaged?.().then((isPackaged: boolean) => {
      if (isPackaged) {
        window.electronAPI.updates.check().catch((err: any) => {
          setError(err?.message || 'Unable to check for updates.');
          setStatus('error');
          setVisible(true);
        });
      }
    });

    return () => {
      unAvailable();
      unProgress();
      unDownloaded();
      unError();
    };
  }, []);

  if (!visible) return null;

  const handleDownload = () => {
    // @ts-ignore
    window.electronAPI.updates.download();
  };

  const handleInstall = () => {
    // @ts-ignore
    window.electronAPI.updates.quitAndInstall();
  };

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-2xl px-4 animate-in fade-in slide-in-from-top duration-300">
      <div className="bg-[#1A1A1E]/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-4 flex items-center gap-4 overflow-hidden relative">
        {/* Progress Bar Background */}
        {status === 'downloading' && (
          <div 
            className="absolute bottom-0 left-0 h-1 bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        )}

        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
          {status === 'available' && <Download className="w-5 h-5 text-blue-400" />}
          {status === 'downloading' && <RefreshCw className="w-5 h-5 text-blue-400 animate-spin" />}
          {status === 'downloaded' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
          {status === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
        </div>

        <div className="flex-grow">
          <h4 className="text-sm font-semibold text-white">
            {status === 'available' && `Update Available: v${updateInfo?.version}`}
            {status === 'downloading' && `Downloading update... ${Math.round(progress)}%`}
            {status === 'downloaded' && 'Update Ready to Install'}
            {status === 'error' && 'Update Error'}
          </h4>
          <p className="text-xs text-white/50">
            {status === 'available' && 'A new version of Remote 365 is ready for download.'}
            {status === 'downloading' && 'Please wait while we prepare the new version.'}
            {status === 'downloaded' && 'Restart Remote 365 to apply the latest improvements.'}
            {status === 'error' && error}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status === 'available' && (
            <button
              onClick={handleDownload}
              className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Update Now
            </button>
          )}
          {status === 'downloaded' && (
            <button
              onClick={handleInstall}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors"
            >
              Restart to Update
            </button>
          )}
          <button 
            onClick={() => setVisible(false)}
            className="p-1.5 hover:bg-white/5 rounded-lg text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default UpdateBanner;
