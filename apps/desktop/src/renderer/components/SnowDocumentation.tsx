import React, { useState } from 'react';
import api from '../lib/api';
import {
  BookOpen,
  Zap,
  Shield,
  Globe,
  Terminal,
  ChevronRight,
  ExternalLink,
  LifeBuoy,
  Search,
  MessageSquare,
  Key,
  X,
  ChevronDown
} from 'lucide-react';

interface Article {
  title: string;
  content: string;
}

interface Category {
  title: string;
  icon: React.ElementType;
  desc: string;
  items: Article[];
  color: string;
  bg: string;
}

const categories: Category[] = [
  {
    title: 'Getting Started',
    icon: Zap,
    desc: 'Learn the fundamentals of Connect-X node architecture and initial setup.',
    color: 'text-blue-500',
    bg: 'bg-blue-50/50',
    items: [
      { title: 'System Requirements', content: 'Connect-X requires Windows 10+, macOS 12+, or Ubuntu 20.04+. Minimum 4GB RAM and a stable internet connection (5 Mbps+). For hosting, port 443 should be open or a relay will be used automatically.' },
      { title: 'Initial Node Setup', content: 'After installing, launch the app and register an account. Your device is automatically registered as a node. Copy your Access Key from the Host Device screen and share it with viewers who need to connect.' },
      { title: 'Authentication Flows', content: 'Connect-X uses JWT-based auth with short-lived access tokens (15 min) and long-lived refresh tokens (7 days). Tokens are stored securely in the system keychain on desktop. Web sessions fall back to localStorage.' },
    ]
  },
  {
    title: 'P2P Connectivity',
    icon: Globe,
    desc: 'Master signaling, relay optimization, and NAT traversal techniques.',
    color: 'text-emerald-500',
    bg: 'bg-emerald-50/50',
    items: [
      { title: 'Signaling Servers', content: 'Signaling is handled over WSS at the primary relay (159.65.84.190). The client sends an offer SDP, the relay forwards it to the host, and ICE candidates are exchanged. Signaling data is never stored.' },
      { title: 'ICE/STUN/TURN Guides', content: 'Connect-X first attempts a direct P2P connection using STUN. If NAT traversal fails (symmetric NAT), it falls back to TURN relay automatically. You can inspect your connection type in the session overlay (Ctrl+Shift+I).' },
      { title: 'Relay Optimization', content: 'To reduce relay latency: (1) ensure both peers are on the same continent, (2) disable VPNs that route through distant servers, (3) check that UDP port 3478 is not blocked by your firewall.' },
    ]
  },
  {
    title: 'Security & Auth',
    icon: Shield,
    desc: 'Implement end-to-end encryption and secure access key management.',
    color: 'text-purple-500',
    bg: 'bg-purple-50/50',
    items: [
      { title: 'Access Keys', content: 'Every node has a unique 9-digit Access Key. Keys can be regenerated from the Host screen at any time. Optionally add a Hardware Password to require a secondary passphrase before any viewer can connect.' },
      { title: 'E2EE Setup', content: 'All video and input data is encrypted using DTLS-SRTP (WebRTC standard). Control channel messages use an additional AES-256 layer. Keys are derived per-session and never leave the endpoints.' },
      { title: 'Hardware Partitioning', content: 'Enterprise plans support partitioned node groups. Each partition has isolated access keys, separate audit logs, and role-based viewer permissions. Configure partitions from your Admin Dashboard.' },
    ]
  }
];

const apiRefs = [
  { title: 'Command Line Interface', sub: 'Control nodes via terminal', icon: Terminal, content: 'Run `connect-x --help` to see all CLI commands. Key commands: `connect-x host` (start hosting), `connect-x connect <key>` (connect to a node), `connect-x status` (show active sessions), `connect-x logout` (clear credentials).' },
  { title: 'Auth Token Management', sub: 'Manage session lifecycle', icon: Key, content: 'GET /api/auth/me — returns current user. POST /api/auth/refresh — refreshes your access token using a refresh token. POST /api/auth/logout — invalidates the refresh token. All endpoints require Bearer token in Authorization header.' },
  { title: 'Broadcasting Params', sub: 'Fine-tune streaming performance', icon: Zap, content: 'Set video quality via query params: ?fps=30&bitrate=4000&codec=h264. Available codecs: h264 (default), vp8. Max bitrate 8000 kbps on BUSINESS+. Latency mode: ?latency=ultra disables B-frames for sub-100ms sessions.' },
];

export const SnowDocumentation: React.FC<{ onNavigateToSupport?: () => void }> = ({ onNavigateToSupport }) => {
  const [query, setQuery] = useState('');
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [expandedRef, setExpandedRef] = useState<string | null>(null);
  const [customGuideOpen, setCustomGuideOpen] = useState(false);
  const [guideRequest, setGuideRequest] = useState('');
  const [guideSent, setGuideSent] = useState(false);

  const q = query.toLowerCase().trim();

  const filteredCategories = categories.map(cat => ({
    ...cat,
    items: cat.items.filter(
      item => !q || item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q) || cat.title.toLowerCase().includes(q)
    )
  })).filter(cat => !q || cat.items.length > 0 || cat.title.toLowerCase().includes(q) || cat.desc.toLowerCase().includes(q));

  const filteredRefs = apiRefs.filter(
    r => !q || r.title.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q) || r.content.toLowerCase().includes(q)
  );

  const totalResults = filteredCategories.reduce((a, c) => a + c.items.length, 0) + filteredRefs.length;

  return (
    <div className="max-w-5xl mx-auto flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 font-lato pb-20">

      {/* Documentation Hero */}
      <div className="bg-[#1C1C1C] rounded-[40px] p-12 text-white relative overflow-hidden shadow-xl shadow-black/10">
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-purple-600/10 blur-[100px] -mr-32 -mt-32 rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-600/10 blur-[80px] -ml-16 -mb-16 rounded-full" />

        <div className="relative z-10 max-w-2xl">
          <div className="flex items-center gap-2 mb-6">
            <div className="px-2 py-0.5 bg-white/10 rounded-full border border-white/10">
              <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Knowledge Base</span>
            </div>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight mb-4">Connect-X Technical Docs</h1>
          <p className="text-white/40 text-lg font-medium mb-8 leading-relaxed">
            Comprehensive guides and API references to help you build high-performance, secure P2P node networks.
          </p>

          <div className="flex items-center bg-white/10 backdrop-blur-md rounded-2xl border border-white/10 pl-5 pr-2 py-2 w-full focus-within:ring-2 focus-within:ring-white/20 transition-all max-w-md">
            <Search size={18} className="text-white/40 mr-3 shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search technical guides..."
              className="bg-transparent border-none outline-none text-sm text-white placeholder:text-white/20 w-full"
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 text-white/30 hover:text-white/60 transition-colors mr-1">
                <X size={14} />
              </button>
            )}
            <button className="px-5 py-2 bg-white text-[#1C1C1C] rounded-xl text-xs font-bold hover:opacity-90 transition-all shrink-0">Search</button>
          </div>

          {q && (
            <p className="mt-3 text-white/30 text-xs font-medium">
              {totalResults} result{totalResults !== 1 ? 's' : ''} for "{query}"
            </p>
          )}
        </div>
      </div>

      {/* Category Grid */}
      {filteredCategories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {filteredCategories.map((cat, i) => (
            <div key={i} className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm hover:border-[rgba(28,28,28,0.2)] transition-all group">
              <div className={`w-12 h-12 rounded-2xl ${cat.bg} ${cat.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                <cat.icon size={24} />
              </div>
              <h3 className="text-base font-bold text-[#1C1C1C] mb-2">{cat.title}</h3>
              <p className="text-[11px] font-medium text-[rgba(28,28,28,0.4)] leading-relaxed mb-6">{cat.desc}</p>

              <div className="space-y-1">
                {cat.items.map((item, j) => (
                  <div key={j}>
                    <button
                      onClick={() => setExpandedArticle(expandedArticle === `${i}-${j}` ? null : `${i}-${j}`)}
                      className="w-full flex items-center justify-between py-2.5 px-1 border-b border-[rgba(28,28,28,0.04)] last:border-0 hover:bg-[#F9F9FA] rounded-lg px-2 transition-colors"
                    >
                      <span className="text-xs font-semibold text-[rgba(28,28,28,0.7)] text-left">{item.title}</span>
                      <ChevronDown size={13} className={`text-[rgba(28,28,28,0.2)] transition-transform shrink-0 ml-2 ${expandedArticle === `${i}-${j}` ? 'rotate-180' : ''}`} />
                    </button>
                    {expandedArticle === `${i}-${j}` && (
                      <div className="px-2 py-3 text-[11px] text-[rgba(28,28,28,0.6)] leading-relaxed bg-[#F9F9FA] rounded-xl mb-1 animate-in slide-in-from-top-1 duration-200">
                        {item.content}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-[rgba(28,28,28,0.3)]">
          <BookOpen size={40} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm font-semibold">No articles matched "{query}"</p>
          <button onClick={() => setQuery('')} className="mt-3 text-xs font-bold text-blue-500 hover:underline">Clear search</button>
        </div>
      )}

      {/* API & CLI Reference + Custom Guide */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[32px] border border-[rgba(28,28,28,0.06)] p-8 shadow-sm">
          <h3 className="text-lg font-bold text-[#1C1C1C] tracking-tight mb-8 flex items-center gap-3">
            <Terminal size={18} className="text-blue-500" /> API & CLI Reference
          </h3>
          <div className="space-y-3">
            {filteredRefs.map((item, k) => (
              <div key={k}>
                <button
                  onClick={() => setExpandedRef(expandedRef === item.title ? null : item.title)}
                  className="w-full flex items-center justify-between p-4 bg-[#F9F9FA] rounded-[24px] border border-[rgba(28,28,28,0.02)] hover:border-[rgba(28,28,28,0.1)] transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center text-[rgba(28,28,28,0.3)] group-hover:text-black shadow-sm shrink-0">
                      <item.icon size={18} />
                    </div>
                    <div className="flex flex-col text-left">
                      <span className="text-xs font-bold text-[#1C1C1C]">{item.title}</span>
                      <span className="text-[10px] text-[rgba(28,28,28,0.4)]">{item.sub}</span>
                    </div>
                  </div>
                  <ChevronDown size={14} className={`text-[rgba(28,28,28,0.2)] transition-transform shrink-0 ${expandedRef === item.title ? 'rotate-180' : ''}`} />
                </button>
                {expandedRef === item.title && (
                  <div className="mt-1 px-4 py-3 text-[11px] text-[rgba(28,28,28,0.6)] leading-relaxed bg-[#F9F9FA] rounded-2xl animate-in slide-in-from-top-1 duration-200">
                    {item.content}
                  </div>
                )}
              </div>
            ))}
            {filteredRefs.length === 0 && q && (
              <p className="text-xs text-[rgba(28,28,28,0.3)] text-center py-4">No references matched your search.</p>
            )}
          </div>
        </div>

        <div className="bg-[#F9F9FA] rounded-[32px] border border-[rgba(28,28,28,0.04)] p-8 flex flex-col items-center justify-center text-center">
          {!customGuideOpen && !guideSent ? (
            <>
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center shadow-xl shadow-black/5 mb-8">
                <MessageSquare size={32} className="text-[#1C1C1C]" />
              </div>
              <h3 className="text-xl font-bold text-[#1C1C1C] mb-2 tracking-tight">Need a custom guide?</h3>
              <p className="text-xs font-medium text-[rgba(28,28,28,0.4)] mb-8 leading-relaxed max-w-xs">
                Our solutions engineers can build a custom deployment guide for your enterprise use case.
              </p>
              <button
                onClick={() => setCustomGuideOpen(true)}
                className="px-8 py-3.5 bg-[#1C1C1C] text-white rounded-2xl font-bold text-xs shadow-lg shadow-black/10 hover:opacity-95 transition-all"
              >
                Request Guide
              </button>
            </>
          ) : guideSent ? (
            <div className="flex flex-col items-center">
              <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-6">
                <BookOpen size={28} className="text-green-500" />
              </div>
              <h3 className="text-base font-bold text-[#1C1C1C] mb-2">Request Sent!</h3>
              <p className="text-xs text-[rgba(28,28,28,0.4)] font-medium">Our team will reach out within 1 business day.</p>
            </div>
          ) : (
            <div className="w-full space-y-4">
              <h3 className="text-base font-bold text-[#1C1C1C] mb-2">Describe your use case</h3>
              <textarea
                value={guideRequest}
                onChange={e => setGuideRequest(e.target.value)}
                placeholder="E.g. We need a guide for deploying Connect-X across 500 remote Windows workstations with SSO..."
                className="w-full h-28 px-4 py-3 bg-white rounded-2xl border border-[rgba(28,28,28,0.08)] text-xs text-[#1C1C1C] placeholder:text-[rgba(28,28,28,0.25)] outline-none resize-none"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setCustomGuideOpen(false)}
                  className="flex-1 py-3 bg-white text-[#1C1C1C] rounded-2xl text-xs font-bold border border-[rgba(28,28,28,0.08)] hover:border-[rgba(28,28,28,0.2)] transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => { 
                    if (guideRequest.trim()) { 
                      try {
                        await api.post('/api/support/guides', { description: guideRequest });
                        setGuideSent(true); 
                        setCustomGuideOpen(false); 
                      } catch (err) {
                        console.error('Failed to submit guide request', err);
                      }
                    } 
                  }}
                  disabled={!guideRequest.trim()}
                  className="flex-1 py-3 bg-[#1C1C1C] text-white rounded-2xl text-xs font-bold disabled:opacity-40 hover:opacity-90 transition-all"
                >
                  Submit Request
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer Support Hub Link */}
      <div className="bg-white rounded-[40px] border border-[rgba(28,28,28,0.06)] p-10 flex flex-col md:flex-row items-center justify-between gap-8 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-blue-50/50 text-blue-500 rounded-3xl flex items-center justify-center shadow-inner">
            <LifeBuoy size={32} />
          </div>
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold text-[#1C1C1C] tracking-tight">Documentation alone not enough?</h2>
            <p className="text-[rgba(28,28,28,0.4)] font-medium">Jump over to our Support Hub to chat with an expert directly.</p>
          </div>
        </div>
        <button
          onClick={onNavigateToSupport}
          className="px-8 py-3.5 bg-[#F9F9FA] text-[#1C1C1C] rounded-xl font-bold text-sm border border-[rgba(28,28,28,0.04)] hover:border-[rgba(28,28,28,0.2)] transition-all"
        >
          Go to Support
        </button>
      </div>

    </div>
  );
};
