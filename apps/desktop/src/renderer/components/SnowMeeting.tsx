import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, 
  Settings, Maximize, Share, MessageSquare, 
  MoreHorizontal, Shield, Grid, Layout, X, Copy, Mail, CheckCircle2, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import api from '../lib/api';

interface Participant {
  connectionId: string;
  stream?: MediaStream;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  isLocal?: boolean;
}

interface SnowMeetingProps {
  meetingId: string;
  onLeave: () => void;
}

export const SnowMeeting: React.FC<SnowMeetingProps> = ({ meetingId, onLeave }) => {
  const { user } = useAuthStore();
  const { ws, connectWebSocket } = useChatStore();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [activeLayout, setActiveLayout] = useState<'grid' | 'focus'>('grid');
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');
  
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const hasJoinedRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  const meetingCode = String(meetingId || '').trim();
  const meetingLink = `remotelink://meeting?code=${encodeURIComponent(meetingCode)}`;

  const getAvailableMediaStream = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
    const hasCamera = devices.some((device) => device.kind === 'videoinput');
    const hasMic = devices.some((device) => device.kind === 'audioinput');

    if (hasCamera || hasMic) {
      return navigator.mediaDevices.getUserMedia({
        video: hasCamera,
        audio: hasMic
      });
    }

    const attempts: MediaStreamConstraints[] = [
      { video: true, audio: true },
      { video: true, audio: false },
      { video: false, audio: true }
    ];

    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err: any) {
        if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') continue;
        throw err;
      }
    }

    throw new DOMException('No camera or microphone was found.', 'NotFoundError');
  };

  const requestMedia = async () => {
      try {
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        const stream = await getAvailableMediaStream();
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsCameraOff(stream.getVideoTracks().length === 0);
        setIsMuted(stream.getAudioTracks().length === 0);
        setMediaReady(true);
        setMeetingError(null);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('[Meeting] Failed to get media:', err);
        localStreamRef.current = null;
        setLocalStream(null);
        setMediaReady(true);
        setIsCameraOff(true);
        setIsMuted(true);
        setMeetingError('No camera or microphone was found. You can still join and invite people.');
      }
  };

  // Initialize Media
  useEffect(() => {
    requestMedia();

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(pc => pc.close());
    };
  }, []);

  useEffect(() => {
    async function joinMeeting() {
      if (!ws || ws.readyState !== WebSocket.OPEN || !mediaReady || hasJoinedRef.current) return;

      const token = (window as any).electronAPI
        ? (await (window as any).electronAPI.getToken())?.token
        : localStorage.getItem('access_token');

      hasJoinedRef.current = true;
      ws.send(JSON.stringify({
        type: 'meeting-join',
        meetingId,
        token,
        user: { id: user?.id, name: user?.name, avatar: user?.avatar }
      }));
    }

    joinMeeting();
    if (ws && ws.readyState !== WebSocket.OPEN) {
      ws.addEventListener('open', joinMeeting, { once: true });
      return () => ws.removeEventListener('open', joinMeeting);
    }
  }, [ws, mediaReady, meetingId, user?.id, user?.name, user?.avatar]);

  // Signaling Listener integration
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'meeting-joined':
          setMeetingError(null);
          // Existing participants
          data.participants.forEach((p: any) => {
            setParticipants(prev => {
              if (prev.find(existing => existing.connectionId === p.connectionId)) return prev;
              return [...prev, { ...p }];
            });
            initiatePeerConnection(p.connectionId, true);
          });
          break;

        case 'meeting-error':
          setMeetingError(data.error || 'Could not join this meeting.');
          break;

        case 'meeting-participant-joined':
          // New participant
          initiatePeerConnection(data.participant.connectionId, false);
          setParticipants(prev => {
            if (prev.find(p => p.connectionId === data.participant.connectionId)) return prev;
            return [...prev, { ...data.participant }];
          });
          break;

        case 'meeting-signal':
          handlePeerSignal(data.senderConnectionId, data.signal);
          break;

        case 'meeting-participant-left':
          removeParticipant(data.participantConnectionId);
          break;
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws, localStream]);

  const initiatePeerConnection = (targetId: string, isOffer: boolean) => {
    if (peersRef.current.has(targetId)) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peersRef.current.set(targetId, pc);

    const hasAudioTrack = Boolean(localStream?.getAudioTracks().length);
    const hasVideoTrack = Boolean(localStream?.getVideoTracks().length);

    if (localStream?.getTracks().length) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    if (!hasAudioTrack) {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }
    if (!hasVideoTrack) {
      pc.addTransceiver('video', { direction: 'recvonly' });
    }

    pc.onicecandidate = (e) => {
      if (e.candidate && ws) {
        ws.send(JSON.stringify({
          type: 'meeting-signal',
          meetingId,
          targetConnectionId: targetId,
          signal: { type: 'candidate', candidate: e.candidate }
        }));
      }
    };

    pc.ontrack = (e) => {
      setParticipants(prev => prev.map(p => 
        p.connectionId === targetId ? { ...p, stream: e.streams[0] } : p
      ));
    };

    if (isOffer) {
      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        ws?.send(JSON.stringify({
          type: 'meeting-signal',
          meetingId,
          targetConnectionId: targetId,
          signal: offer
        }));
      });
    }
  };

  const handlePeerSignal = async (senderId: string, signal: any) => {
    let pc = peersRef.current.get(senderId);
    if (!pc) {
       initiatePeerConnection(senderId, false);
       pc = peersRef.current.get(senderId)!;
    }

    if (signal.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      ws?.send(JSON.stringify({
        type: 'meeting-signal',
        meetingId,
        targetConnectionId: senderId,
        signal: answer
      }));
    } else if (signal.type === 'answer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
    } else if (signal.type === 'candidate') {
      await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  };

  const removeParticipant = (id: string) => {
    const pc = peersRef.current.get(id);
    if (pc) pc.close();
    peersRef.current.delete(id);
    setParticipants(prev => prev.filter(p => p.connectionId !== id));
  };

  const toggleMute = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(t => t.enabled = isMuted);
    setIsMuted(!isMuted);
  };

  const toggleCamera = () => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach(t => t.enabled = isCameraOff);
    setIsCameraOff(!isCameraOff);
  };

  const copyInvite = async () => {
    await navigator.clipboard?.writeText(`${meetingCode}\n${meetingLink}`);
    setInviteStatus('sent');
    setInviteMessage('Meeting code copied.');
    setShowInvitePanel(true);
  };

  const sendInvite = async () => {
    const cleanEmail = inviteEmail.trim();
    if (!cleanEmail) return;

    setInviteStatus('sending');
    setInviteMessage('');
    try {
      await api.post('/api/chat/session-invites', {
        email: cleanEmail,
        sessionName: `${user?.name || 'Remote 365'} meeting`,
        sessionCode: meetingCode,
        sessionPassword: '',
        sessionLink: meetingLink,
        type: 'VIDEO_MEETING'
      });
      setInviteStatus('sent');
      setInviteMessage(`Invite sent to ${cleanEmail}.`);
      setInviteEmail('');
    } catch (err: any) {
      setInviteStatus('error');
      setInviteMessage(err.response?.data?.error || err.message || 'Could not send invite.');
    }
  };

  const handleLeave = () => {
    ws?.send(JSON.stringify({ type: 'meeting-leave', meetingId }));
    onLeave();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-[#0A0A0A] flex flex-col font-lato text-white animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-black/40 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
            <Video size={18} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold tracking-tight">Meeting: {meetingId}</h2>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${meetingError ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="text-[11px] text-gray-400 font-medium">
                {meetingError ? meetingError : `LIVE - ${participants.length + 1} Participants`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white">
            <Grid size={18} onClick={() => setActiveLayout('grid')} className={activeLayout === 'grid' ? 'text-blue-500' : ''} />
          </button>
          <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white">
            <Layout size={18} onClick={() => setActiveLayout('focus')} className={activeLayout === 'focus' ? 'text-blue-500' : ''} />
          </button>
          <div className="w-px h-6 bg-white/10 mx-2" />
          <button className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white">
            <Shield size={18} />
          </button>
        </div>
      </div>

      {/* Main Video Grid */}
      <div className="flex-1 p-6 overflow-hidden relative">
        <div className={`grid h-full gap-4 ${
          participants.length === 0 ? 'grid-cols-1' :
          participants.length === 1 ? 'grid-cols-2' :
          participants.length <= 3 ? 'grid-cols-2 grid-rows-2' :
          'grid-cols-3 grid-rows-2'
        }`}>
          
          {/* Local Video */}
          <motion.div 
            layout
            className="relative bg-[#1A1A1A] rounded-3xl overflow-hidden border border-white/5 shadow-2xl group"
          >
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
            className={`w-full h-full object-cover ${isCameraOff || !localStream ? 'hidden' : ''}`}
          />
            {(isCameraOff || !localStream) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#151515]">
                <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 mb-4 border border-blue-500/20">
                  <span className="text-3xl font-bold">{user?.name?.charAt(0) || 'U'}</span>
                </div>
                <p className="text-sm font-medium text-gray-500">
                  {localStream ? 'Camera is off' : 'No camera or microphone found'}
                </p>
                {!localStream && (
                  <button
                    onClick={requestMedia}
                    className="mt-4 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold flex items-center gap-2"
                  >
                    <RefreshCw size={15} />
                    Try again
                  </button>
                )}
              </div>
            )}
            <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[12px] font-bold border border-white/10 flex items-center gap-2">
              <span className="text-white">You (Organizer)</span>
              {isMuted && <MicOff size={12} className="text-red-500" />}
            </div>
          </motion.div>

          {/* Remote Participants */}
          <AnimatePresence mode="popLayout">
            {participants.map((p) => (
              <RemoteVideo key={p.connectionId} participant={p} />
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="h-24 px-8 flex items-center justify-between bg-gradient-to-t from-black to-transparent">
        <button
          onClick={() => setShowInvitePanel(true)}
          className="flex items-center gap-2 text-gray-400 hover:text-white text-sm font-medium transition-colors"
        >
          <Settings size={16} />
          <span>Meeting Details</span>
        </button>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleMute}
            disabled={!localStream}
            title={!localStream ? 'Microphone is unavailable' : 'Mute microphone'}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all disabled:opacity-45 ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          
          <button 
            onClick={toggleCamera}
            disabled={!localStream}
            title={!localStream ? 'Camera is unavailable' : 'Toggle camera'}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all disabled:opacity-45 ${isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>

          <button
            onClick={() => setShowInvitePanel(true)}
            className="w-14 h-14 rounded-2xl bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
            title="Invite people"
          >
            <Share size={22} />
          </button>

          <button className="w-14 h-14 rounded-2xl bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all">
            <MessageSquare size={22} />
          </button>

          <button 
            onClick={handleLeave}
            className="w-20 h-14 rounded-2xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center transition-all shadow-xl shadow-red-600/20"
          >
            <PhoneOff size={24} />
          </button>
        </div>

        <div className="flex items-center gap-4">
          <button onClick={() => setShowInvitePanel(true)} className="p-2 text-gray-400 hover:text-white transition-colors" title="Participants and invites">
            <Users size={20} />
          </button>
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <Maximize size={20} />
          </button>
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showInvitePanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[120] bg-black/45 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              className="w-full max-w-md rounded-2xl bg-[#111111] border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Invite people</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Share this Remote 365 meeting code.</p>
                </div>
                <button
                  onClick={() => setShowInvitePanel(false)}
                  className="w-9 h-9 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-5">
                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Meeting code</label>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-12 rounded-xl bg-black/35 border border-white/10 px-4 flex items-center font-mono text-lg font-bold text-white">
                      {meetingCode}
                    </div>
                    <button
                      onClick={copyInvite}
                      className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/15 text-white flex items-center justify-center"
                      title="Copy meeting code"
                    >
                      <Copy size={18} />
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[11px] uppercase tracking-wider font-bold text-gray-500">Email invite</label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendInvite()}
                      placeholder="person@company.com"
                      className="flex-1 h-12 rounded-xl bg-black/35 border border-white/10 px-4 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={sendInvite}
                      disabled={!inviteEmail.trim() || inviteStatus === 'sending'}
                      className="h-12 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-sm flex items-center gap-2"
                    >
                      {inviteStatus === 'sending' ? <RefreshCw size={16} className="animate-spin" /> : <Mail size={16} />}
                      Send
                    </button>
                  </div>
                </div>

                {inviteMessage && (
                  <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${
                    inviteStatus === 'error'
                      ? 'bg-red-500/10 text-red-300 border border-red-500/20'
                      : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                  }`}>
                    {inviteStatus === 'error' ? <X size={16} className="mt-0.5" /> : <CheckCircle2 size={16} className="mt-0.5" />}
                    <span>{inviteMessage}</span>
                  </div>
                )}

                <div className="rounded-xl bg-white/[0.03] border border-white/10 px-4 py-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Participants</span>
                    <span className="font-bold text-white">{participants.length + 1}</span>
                  </div>
                  <div className="mt-3 space-y-2">
                    <ParticipantRow name={`${user?.name || 'You'} (You)`} />
                    {participants.map((participant) => (
                      <ParticipantRow key={participant.connectionId} name={participant.user?.name || 'Participant'} />
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ParticipantRow: React.FC<{ name: string }> = ({ name }) => (
  <div className="flex items-center gap-3 text-sm text-gray-300">
    <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-300 flex items-center justify-center text-xs font-bold">
      {name.charAt(0).toUpperCase()}
    </div>
    <span className="truncate">{name}</span>
  </div>
);

const RemoteVideo: React.FC<{ participant: Participant }> = ({ participant }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className="relative bg-[#1A1A1A] rounded-3xl overflow-hidden border border-white/5 shadow-2xl"
    >
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className="w-full h-full object-cover"
      />
      {!participant.stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#151515]">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 mb-3 border border-white/5">
              <span className="text-2xl font-bold">{participant.user?.name?.charAt(0) || 'P'}</span>
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">Connecting...</p>
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[12px] font-bold border border-white/10">
        {participant.user?.name || 'Participant'}
      </div>
    </motion.div>
  );
};
