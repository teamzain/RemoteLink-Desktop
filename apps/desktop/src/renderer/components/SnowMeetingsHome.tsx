import React, { useState, useEffect } from 'react';
import { Video, Keyboard, Settings, Clock, Calendar, Copy, RefreshCw, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import api from '../lib/api';

interface SnowMeetingsHomeProps {
  onJoinMeeting: (meetingId: string) => void;
  user: any;
}

export const SnowMeetingsHome: React.FC<SnowMeetingsHomeProps> = ({ onJoinMeeting, user }) => {
  const [meetingCode, setMeetingCode] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [meetings, setMeetings] = useState<any[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoadingMeetings, setIsLoadingMeetings] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchMeetings = async () => {
    setIsLoadingMeetings(true);
    try {
      const { data } = await api.get('/api/chat/meetings');
      setMeetings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[Meetings] Failed to load meetings', err);
    } finally {
      setIsLoadingMeetings(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const formatCode = (code: string) => {
    const clean = String(code || '').replace(/[^a-zA-Z0-9]/g, '');
    if (clean.length === 9) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
    return code;
  };

  const extractMeetingCode = (value: string) => {
    const trimmed = value.trim();
    try {
      const parsed = new URL(trimmed);
      return parsed.searchParams.get('code') || parsed.pathname.split('/').filter(Boolean).pop() || trimmed;
    } catch {
      return trimmed;
    }
  };

  const handleNewMeeting = async () => {
    setIsCreating(true);
    setErrorMessage('');
    try {
      const { data } = await api.post('/api/chat/meetings', {
        name: `${user?.name || 'Remote 365'} meeting`
      });
      setMeetings((prev) => [data, ...prev.filter((meeting) => meeting.id !== data.id)]);
      onJoinMeeting(data.displayCode || formatCode(data.sessionCode));
    } catch (err: any) {
      setErrorMessage(err.response?.data?.error || err.message || 'Could not create meeting.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoin = () => {
    if (meetingCode.trim()) {
      onJoinMeeting(formatCode(extractMeetingCode(meetingCode)));
    }
  };

  const getMeetingExpiresAt = (meeting: any) => {
    if (meeting?.expiresAt) return new Date(meeting.expiresAt);
    return new Date(new Date(meeting?.createdAt || Date.now()).getTime() + 30 * 60 * 1000);
  };

  const isMeetingJoinable = (meeting: any) =>
    String(meeting?.status || 'ACTIVE').toUpperCase() === 'ACTIVE' &&
    !meeting?.isExpired &&
    getMeetingExpiresAt(meeting).getTime() > Date.now();

  const formattedTime = currentTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const formattedDate = currentTime.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#080808] font-sans overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="h-16 flex items-center justify-between px-6 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xl font-medium text-gray-800 dark:text-gray-200">{formattedTime}</span>
          <span className="text-gray-400 dark:text-gray-500">•</span>
          <span className="text-sm font-medium text-gray-500">{formattedDate}</span>
        </div>
        
        <div className="flex items-center gap-4">
          <button className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-8 gap-16 md:gap-24">
        
        {/* Left Side: Actions */}
        <div className="flex flex-col max-w-md w-full animate-in slide-in-from-left-8 duration-700">
          <h1 className="text-4xl md:text-5xl font-normal text-gray-900 dark:text-white mb-4 tracking-tight">
            Premium video meetings.
            <br />
            Now built right in.
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400 mb-10">
            Connect, collaborate, and celebrate from anywhere with Remote 365 secure meetings.
          </p>

          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button 
              onClick={handleNewMeeting}
              disabled={isCreating}
              className="w-full sm:w-auto px-6 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 active:scale-95"
            >
              {isCreating ? <RefreshCw size={20} className="animate-spin" /> : <Video size={20} />}
              {isCreating ? 'Creating...' : 'New meeting'}
            </button>

            <div className="relative w-full sm:w-auto flex-1 group">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-500 transition-colors">
                <Keyboard size={20} />
              </div>
              <input
                type="text"
                placeholder="Enter a code or link"
                value={meetingCode}
                onChange={(e) => setMeetingCode(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                className="w-full h-[52px] pl-12 pr-20 bg-transparent border border-gray-300 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-gray-500"
              />
              <button 
                onClick={handleJoin}
                disabled={!meetingCode.trim()}
                className={`absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  meetingCode.trim() 
                    ? 'text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10' 
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                Join
              </button>
            </div>
          </div>
          {errorMessage && (
            <p className="mt-4 text-sm text-red-500">{errorMessage}</p>
          )}
          
          <div className="mt-10 h-px w-full bg-gray-200 dark:bg-white/5" />
          <div className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                <Clock size={16} />
                Recent meetings
              </div>
              <button
                onClick={fetchMeetings}
                className="w-8 h-8 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-center"
                title="Refresh meetings"
              >
                <RefreshCw size={15} className={isLoadingMeetings ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="space-y-2 max-h-44 overflow-auto pr-1">
              {meetings.length === 0 ? (
                <div className="text-sm text-gray-500 dark:text-gray-400 border border-dashed border-gray-200 dark:border-white/10 rounded-xl px-4 py-5 text-center">
                  No meetings yet.
                </div>
              ) : meetings.slice(0, 4).map((meeting) => {
                const code = meeting.displayCode || formatCode(meeting.sessionCode);
                const joinable = isMeetingJoinable(meeting);
                const expiresAt = getMeetingExpiresAt(meeting);
                return (
                  <div
                    key={meeting.id}
                    onClick={() => joinable && onJoinMeeting(code)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/70 dark:bg-white/[0.03] transition-colors ${
                      joinable ? 'cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-500/10' : 'cursor-not-allowed opacity-60'
                    }`}
                    title={joinable ? 'Join meeting' : 'This meeting link has expired'}
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center">
                      <Calendar size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{meeting.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{code} • {joinable ? `Expires ${expiresAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : 'Expired'}</p>
                    </div>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        navigator.clipboard?.writeText(code);
                      }}
                      className="w-8 h-8 rounded-lg text-gray-500 hover:bg-white dark:hover:bg-white/10 flex items-center justify-center"
                      title="Copy meeting code"
                    >
                      <Copy size={15} />
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        if (joinable) onJoinMeeting(code);
                      }}
                      disabled={!joinable}
                      className="w-8 h-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed"
                      title={joinable ? 'Join meeting' : 'Expired'}
                    >
                      <Play size={15} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Side: Carousel/Hero Graphic */}
        <div className="hidden md:flex flex-col items-center justify-center w-full max-w-lg animate-in slide-in-from-right-8 duration-700">
          <div className="relative w-full aspect-square max-h-[400px]">
            {/* Dynamic Abstract Background Elements */}
            <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob" />
            <div className="absolute top-10 right-10 w-32 h-32 bg-emerald-500 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-2000" />
            <div className="absolute -bottom-8 left-20 w-32 h-32 bg-purple-500 rounded-full mix-blend-multiply filter blur-2xl opacity-40 animate-blob animation-delay-4000" />
            
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                className="w-64 h-64 bg-white dark:bg-[#111111] rounded-[40px] shadow-2xl border border-gray-100 dark:border-white/10 flex flex-col items-center justify-center p-8 text-center relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-purple-500/5" />
                <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center text-blue-600 mb-6 relative">
                  <Video size={32} />
                  <div className="absolute top-0 right-0 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white dark:border-[#111111]" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Secure Link Ready</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Enterprise-grade encryption for all your conversations.</p>
              </motion.div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
