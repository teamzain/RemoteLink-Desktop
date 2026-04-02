import React, { useState } from 'react';
import {
  Server,
  Play,
  Tag,
  Bell,
  Shield,
  Monitor,
  Wifi,
  Save,
  Check,
  ChevronRight,
  RotateCcw,
  Volume2,
  VolumeX
} from 'lucide-react';

interface SnowSettingsProps {
  serverIP: string;
  isAutoHostEnabled: boolean;
  setIsAutoHostEnabled: (val: boolean) => void;
  onRenameNode: () => void;
}

type Quality = 'auto' | 'high' | 'medium' | 'low';

export const SnowSettings: React.FC<SnowSettingsProps> = ({
  serverIP,
  isAutoHostEnabled,
  setIsAutoHostEnabled,
  onRenameNode
}) => {
  const [quality, setQuality] = useState<Quality>(
    (localStorage.getItem('stream_quality') as Quality) || 'auto'
  );
  const [notifyNewSession, setNotifyNewSession] = useState(
    localStorage.getItem('notify_new_session') !== 'false'
  );
  const [notifyDisconnect, setNotifyDisconnect] = useState(
    localStorage.getItem('notify_disconnect') !== 'false'
  );
  const [soundEnabled, setSoundEnabled] = useState(
    localStorage.getItem('sound_enabled') !== 'false'
  );
  const [reducedMotion, setReducedMotion] = useState(
    localStorage.getItem('reduced_motion') === 'true'
  );
  const [saved, setSaved] = useState(false);

  const savePreferences = () => {
    localStorage.setItem('stream_quality', quality);
    localStorage.setItem('notify_new_session', String(notifyNewSession));
    localStorage.setItem('notify_disconnect', String(notifyDisconnect));
    localStorage.setItem('sound_enabled', String(soundEnabled));
    localStorage.setItem('reduced_motion', String(reducedMotion));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" className="sr-only peer" checked={checked} onChange={e => onChange(e.target.checked)} />
      <div className="w-9 h-5 bg-[rgba(28,28,28,0.1)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#1C1C1C]" />
    </label>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-500 font-inter pb-20">

      {/* Connection */}
      <section className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
        <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 tracking-tight flex items-center gap-2">
          <Server size={15} className="text-blue-500" /> Connection
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
            <div className="flex flex-col">
              <span className="font-bold text-sm text-[#1C1C1C]">Relay Server Address</span>
              <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Signaling endpoint for P2P connection establishment</span>
            </div>
            <div className="flex items-center bg-white px-3 py-1.5 rounded-xl border border-[rgba(28,28,28,0.08)]">
              <Wifi size={12} className="text-green-500 mr-2" />
              <span className="text-xs font-mono text-[#1C1C1C]">{serverIP}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
            <div className="flex flex-col">
              <span className="font-bold text-sm text-[#1C1C1C]">Auto-Start Hosting</span>
              <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Automatically broadcast this machine on app launch</span>
            </div>
            <Toggle checked={isAutoHostEnabled} onChange={(val) => {
              setIsAutoHostEnabled(val);
              localStorage.setItem('is_auto_host_enabled', String(val));
            }} />
          </div>

          <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
            <div className="flex flex-col">
              <span className="font-bold text-sm text-[#1C1C1C]">Node Identifier</span>
              <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Custom display name for this machine on your device map</span>
            </div>
            <button
              onClick={onRenameNode}
              className="flex items-center gap-2 px-4 py-2 font-bold text-[11px] uppercase tracking-widest bg-white border border-[rgba(28,28,28,0.08)] hover:border-[rgba(28,28,28,0.3)] text-[#1C1C1C] rounded-xl transition-all shadow-sm"
            >
              <Tag size={12} /> Modify
            </button>
          </div>
        </div>
      </section>

      {/* Streaming Quality */}
      <section className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
        <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 tracking-tight flex items-center gap-2">
          <Monitor size={15} className="text-purple-500" /> Streaming Quality
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(['auto', 'high', 'medium', 'low'] as Quality[]).map(q => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`p-4 rounded-[20px] border text-center transition-all ${quality === q
                ? 'bg-[#1C1C1C] border-[#1C1C1C] text-white shadow-lg shadow-black/10'
                : 'bg-[#F9F9FA] border-[rgba(28,28,28,0.04)] text-[#1C1C1C] hover:border-[rgba(28,28,28,0.2)]'
              }`}
            >
              <span className="block text-sm font-bold capitalize">{q}</span>
              <span className={`text-[10px] font-medium mt-1 block ${quality === q ? 'text-white/60' : 'text-[rgba(28,28,28,0.4)]'}`}>
                {q === 'auto' ? 'Adaptive' : q === 'high' ? '4K / 60fps' : q === 'medium' ? '1080p / 30fps' : '720p / 30fps'}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-50/40 border border-blue-100/50 rounded-xl">
          <p className="text-[10px] text-blue-600/70 font-medium leading-relaxed">
            <strong>Auto</strong> dynamically adjusts based on your network bandwidth. Choose <strong>High</strong> for LAN sessions; <strong>Low</strong> for congested or mobile connections.
          </p>
        </div>
      </section>

      {/* Notifications */}
      <section className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
        <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 tracking-tight flex items-center gap-2">
          <Bell size={15} className="text-orange-500" /> Notifications
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
            <div className="flex flex-col">
              <span className="font-bold text-sm text-[#1C1C1C]">New Session Alert</span>
              <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Notify when a viewer connects to this node</span>
            </div>
            <Toggle checked={notifyNewSession} onChange={setNotifyNewSession} />
          </div>

          <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
            <div className="flex flex-col">
              <span className="font-bold text-sm text-[#1C1C1C]">Disconnect Alert</span>
              <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Notify when a remote session ends unexpectedly</span>
            </div>
            <Toggle checked={notifyDisconnect} onChange={setNotifyDisconnect} />
          </div>

          <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
            <div className="flex items-center gap-3">
              {soundEnabled ? <Volume2 size={16} className="text-[rgba(28,28,28,0.4)]" /> : <VolumeX size={16} className="text-[rgba(28,28,28,0.2)]" />}
              <div className="flex flex-col">
                <span className="font-bold text-sm text-[#1C1C1C]">Sound Effects</span>
                <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Play audio cues for connection events</span>
              </div>
            </div>
            <Toggle checked={soundEnabled} onChange={setSoundEnabled} />
          </div>
        </div>
      </section>

      {/* Appearance */}
      <section className="bg-white rounded-[24px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
        <h3 className="text-sm font-bold text-[#1C1C1C] mb-6 tracking-tight flex items-center gap-2">
          <Shield size={15} className="text-emerald-500" /> Appearance & Accessibility
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[20px] border border-[rgba(28,28,28,0.04)]">
            <div className="flex flex-col">
              <span className="font-bold text-sm text-[#1C1C1C]">Reduce Motion</span>
              <span className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] mt-1">Disable animations and transitions throughout the UI</span>
            </div>
            <Toggle checked={reducedMotion} onChange={setReducedMotion} />
          </div>
        </div>
      </section>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={savePreferences}
          className="h-11 px-8 bg-[#1C1C1C] text-white rounded-xl font-bold text-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-black/10"
        >
          {saved ? <Check size={15} /> : <Save size={15} />}
          {saved ? 'Preferences Saved!' : 'Save Preferences'}
        </button>
      </div>

    </div>
  );
};
