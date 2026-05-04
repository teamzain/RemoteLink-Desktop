import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, 
  Settings, Maximize, Share, MessageSquare, 
  MoreHorizontal, Shield, Grid, Layout
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';

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
  
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const hasJoinedRef = useRef(false);

  useEffect(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  // Initialize Media
  useEffect(() => {
    let streamToCleanup: MediaStream | null = null;

    async function initMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        streamToCleanup = stream;
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

      } catch (err) {
        console.error('[Meeting] Failed to get media:', err);
        setMeetingError('Camera or microphone access was blocked.');
      }
    }

    initMedia();

    return () => {
      streamToCleanup?.getTracks().forEach(t => t.stop());
      peersRef.current.forEach(pc => pc.close());
    };
  }, []);

  useEffect(() => {
    async function joinMeeting() {
      if (!ws || ws.readyState !== WebSocket.OPEN || !localStream || hasJoinedRef.current) return;

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
  }, [ws, localStream, meetingId, user?.id, user?.name, user?.avatar]);

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

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
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
    if (localStream) {
      localStream.getAudioTracks().forEach(t => t.enabled = isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleCamera = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => t.enabled = isCameraOff);
      setIsCameraOff(!isCameraOff);
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
              className={`w-full h-full object-cover ${isCameraOff ? 'hidden' : ''}`}
            />
            {isCameraOff && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#151515]">
                <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 mb-4 border border-blue-500/20">
                  <span className="text-3xl font-bold">{user?.name?.charAt(0) || 'U'}</span>
                </div>
                <p className="text-sm font-medium text-gray-500">Camera is off</p>
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
        <div className="flex items-center gap-2 text-gray-400 text-sm font-medium">
          <Settings size={16} />
          <span>Meeting Details</span>
        </div>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleMute}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          
          <button 
            onClick={toggleCamera}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>

          <button className="w-14 h-14 rounded-2xl bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all">
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
          <button className="p-2 text-gray-400 hover:text-white transition-colors">
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
    </div>
  );
};

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
