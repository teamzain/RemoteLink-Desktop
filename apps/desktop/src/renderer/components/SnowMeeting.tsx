import React, { useEffect, useRef, useState } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, 
  Settings, Maximize, Share, MessageSquare, 
  MoreHorizontal, Shield, Grid, Layout, X, Copy, Mail, CheckCircle2, RefreshCw, MousePointer2, Send,
  ScreenShare, ScreenShareOff, Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore';
import api from '../lib/api';

interface Participant {
  connectionId: string;
  stream?: MediaStream;
  user?: {
    id: string;
    name: string;
    avatar?: string;
  };
  mediaState?: {
    isMuted: boolean;
    isCameraOff: boolean;
    isScreenSharing?: boolean;
  };
  isLocal?: boolean;
}

interface SnowMeetingProps {
  meetingId: string;
  onLeave: () => void;
  hostAccessKey?: string | null;
  devicePassword?: string;
  serverIP?: string;
}

interface MeetingChatMessage {
  id: string;
  senderConnectionId: string;
  senderName: string;
  text: string;
  createdAt: number;
}

interface ControlRequest {
  requestId: string;
  requesterConnectionId: string;
  requesterName: string;
}

const normalizeMeetingCode = (value: string) => String(value || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const getMeetingWsUrl = () => {
  const envUrl = import.meta.env.VITE_SIGNAL_URL;
  if (envUrl && envUrl.includes('localhost')) {
    if (import.meta.env.VITE_API_URL?.includes('159.65.84.190')) {
      return 'ws://159.65.84.190/api/signal';
    }
    return envUrl;
  }
  return envUrl || 'ws://159.65.84.190/api/signal';
};

const formatMeetingCode = (value: string) => {
  const clean = String(value || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (clean.length === 9) return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6, 9)}`;
  return clean || String(value || '').trim();
};

export const SnowMeeting: React.FC<SnowMeetingProps> = ({ meetingId, onLeave, hostAccessKey, devicePassword, serverIP = '159.65.84.190' }) => {
  const { user } = useAuthStore();
  
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [activeLayout, setActiveLayout] = useState<'grid' | 'focus'>('grid');
  const [focusedParticipantId, setFocusedParticipantId] = useState<string | null>(null);
  const [meetingError, setMeetingError] = useState<string | null>(null);
  const [mediaReady, setMediaReady] = useState(false);
  const [showInvitePanel, setShowInvitePanel] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [inviteMessage, setInviteMessage] = useState('');
  const [showChatPanel, setShowChatPanel] = useState(false);
  const [chatMessages, setChatMessages] = useState<MeetingChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [controlRequest, setControlRequest] = useState<ControlRequest | null>(null);
  const [controlStatus, setControlStatus] = useState('');
  const [showSecurityPanel, setShowSecurityPanel] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [shareSystemAudio, setShareSystemAudio] = useState(() => localStorage.getItem('remote365_meeting_share_system_audio') === 'true');
  
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const hasJoinedRef = useRef(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const placeholderVideoTrackRef = useRef<MediaStreamTrack | null>(null);

  const roomId = normalizeMeetingCode(meetingId);
  const meetingCode = formatMeetingCode(roomId);
  const meetingLink = `remotelink://meeting?code=${encodeURIComponent(meetingCode)}`;

  useEffect(() => {
    const meetingSocket = new WebSocket(getMeetingWsUrl());
    setWs(meetingSocket);
    meetingSocket.onopen = () => {
      console.info(`[Meeting] Signaling connected for room ${roomId || '(pending)'}`);
    };
    meetingSocket.onerror = () => {
      setMeetingError('Meeting connection failed. Please check your internet connection.');
    };
    meetingSocket.onclose = () => {
      setWs((current) => current === meetingSocket ? null : current);
    };

    return () => {
      hasJoinedRef.current = false;
      meetingSocket.close();
    };
  }, [roomId]);

  const sendMeetingSignal = (targetConnectionId: string, signal: any) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify({
      type: 'meeting-signal',
      meetingId: roomId,
      targetConnectionId,
      signal
    }));
  };

  const renegotiatePeer = async (targetId: string, pc: RTCPeerConnection) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || pc.signalingState !== 'stable') return;
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    sendMeetingSignal(targetId, offer);
  };

  const replacePeerTrack = async (kind: 'audio' | 'video', track: MediaStreamTrack | null, renegotiate = false) => {
    await Promise.all([...peersRef.current.entries()].map(async ([targetId, pc]) => {
      let transceiver = pc.getTransceivers().find((item) => item.sender.track?.kind === kind || item.receiver.track?.kind === kind);
      if (!transceiver) {
        transceiver = pc.addTransceiver(kind, { direction: 'sendrecv' });
        renegotiate = true;
      }
      await transceiver.sender.replaceTrack(track);
      if (renegotiate) await renegotiatePeer(targetId, pc);
    }));
  };

  const getPlaceholderVideoTrack = () => {
    if (placeholderVideoTrackRef.current?.readyState === 'live') return placeholderVideoTrackRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 9;
    const context = canvas.getContext('2d');
    context!.fillStyle = '#151515';
    context!.fillRect(0, 0, canvas.width, canvas.height);
    const stream = canvas.captureStream(1);
    const track = stream.getVideoTracks()[0];
    placeholderVideoTrackRef.current = track;
    return track;
  };

  const getOutgoingVideoTrack = () => (
    screenStreamRef.current?.getVideoTracks()[0]
    || localStreamRef.current?.getVideoTracks()[0]
    || getPlaceholderVideoTrack()
  );

  const getOutgoingAudioTrack = () => {
    const screenAudio = screenStreamRef.current?.getAudioTracks()[0] || null;
    return (shareSystemAudio && screenAudio)
      ? screenAudio
      : (localStreamRef.current?.getAudioTracks()[0] || null);
  };

  const publishMediaState = (nextMuted = isMuted, nextCameraOff = isCameraOff, nextScreenSharing = isScreenSharing) => {
    if (!ws || ws.readyState !== WebSocket.OPEN || !hasJoinedRef.current) return;
    ws.send(JSON.stringify({
      type: 'meeting-media-state',
      meetingId: roomId,
      mediaState: {
        isMuted: nextMuted,
        isCameraOff: nextCameraOff,
        isScreenSharing: nextScreenSharing
      }
    }));
  };

  const sendMediaState = (nextMuted = isMuted, nextCameraOff = isCameraOff) => {
    publishMediaState(nextMuted, nextCameraOff, isScreenSharing);
  };

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
        const nextCameraOff = stream.getVideoTracks().length === 0;
        const nextMuted = stream.getAudioTracks().length === 0;
        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsCameraOff(nextCameraOff);
        setIsMuted(nextMuted);
        setMediaReady(true);
        setMeetingError(null);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        if (!screenStreamRef.current && peersRef.current.size) {
          await replacePeerTrack('video', stream.getVideoTracks()[0] || getPlaceholderVideoTrack(), true);
          await replacePeerTrack('audio', stream.getAudioTracks()[0] || null, true);
          publishMediaState(nextMuted, nextCameraOff, false);
        }
      } catch (err) {
        console.info('[Meeting] Camera or microphone unavailable. Joining without local media.', err);
        localStreamRef.current = null;
        setLocalStream(null);
        setMediaReady(true);
        setIsCameraOff(true);
        setIsMuted(true);
        setMeetingError(null);
      }
  };

  // Initialize Media
  useEffect(() => {
    requestMedia();

    return () => {
      localStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      placeholderVideoTrackRef.current?.stop();
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
        meetingId: roomId,
        token,
        user: { id: user?.id, name: user?.name, avatar: user?.avatar },
        mediaState: {
          isMuted,
          isCameraOff,
          isScreenSharing
        }
      }));
    }

    joinMeeting();
    if (ws && ws.readyState !== WebSocket.OPEN) {
      ws.addEventListener('open', joinMeeting, { once: true });
      return () => ws.removeEventListener('open', joinMeeting);
    }
  }, [ws, mediaReady, roomId, user?.id, user?.name, user?.avatar, isMuted, isCameraOff, isScreenSharing]);

  // Signaling Listener integration
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong' }));
          break;

        case 'meeting-joined':
          console.info(`[Meeting] Joined ${data.meetingId} with ${data.participants?.length || 0} remote participants.`);
          setMeetingError(null);
          // Existing participants
          data.participants.forEach((p: any) => {
            setParticipants(prev => {
              if (prev.find(existing => existing.connectionId === p.connectionId)) return prev;
              return [...prev, { ...p }];
            });
            initiatePeerConnection(p.connectionId, true).catch((err) => console.warn('[Meeting] Peer init failed:', err));
          });
          break;

        case 'meeting-chat':
          if (data.message) {
            setChatMessages(prev => prev.some(m => m.id === data.message.id) ? prev : [...prev, data.message]);
            if (data.message.senderConnectionId !== 'local') setShowChatPanel(true);
          }
          break;

        case 'meeting-control-request':
          setControlRequest({
            requestId: data.requestId,
            requesterConnectionId: data.requesterConnectionId,
            requesterName: data.requesterName || 'Participant'
          });
          break;

        case 'meeting-control-response':
          handleControlResponse(data);
          break;

        case 'meeting-error':
          setMeetingError(data.error || 'Could not join this meeting.');
          break;

        case 'meeting-participant-joined':
          // New participant
          initiatePeerConnection(data.participant.connectionId, false).catch((err) => console.warn('[Meeting] Peer init failed:', err));
          setParticipants(prev => {
            if (prev.find(p => p.connectionId === data.participant.connectionId)) return prev;
            return [...prev, { ...data.participant }];
          });
          break;

        case 'meeting-media-state':
          setParticipants(prev => prev.map(p =>
            p.connectionId === data.participantConnectionId
              ? { ...p, mediaState: data.mediaState }
              : p
          ));
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

  const initiatePeerConnection = async (targetId: string, isOffer: boolean) => {
    if (peersRef.current.has(targetId)) return;

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    peersRef.current.set(targetId, pc);

    const videoTrack = getOutgoingVideoTrack();
    const audioTrack = getOutgoingAudioTrack();
    const videoTransceiver = pc.addTransceiver('video', { direction: 'sendrecv' });
    const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' });

    await videoTransceiver.sender.replaceTrack(videoTrack);
    await audioTransceiver.sender.replaceTrack(audioTrack);

    pc.onicecandidate = (e) => {
      if (e.candidate && ws) {
        sendMeetingSignal(targetId, { type: 'candidate', candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      const stream = e.streams[0] || new MediaStream([e.track]);
      if (!stream.getTracks().includes(e.track)) {
        stream.addTrack(e.track);
      }
      setParticipants(prev => {
        const existing = prev.find((p) => p.connectionId === targetId);
        if (!existing) {
          return [...prev, {
            connectionId: targetId,
            stream,
            user: { id: targetId, name: 'Participant' },
            mediaState: { isMuted: false, isCameraOff: false, isScreenSharing: false }
          }];
        }
        return prev.map(p => {
          if (p.connectionId !== targetId) return p;
          const nextStream = p.stream || stream;
          if (!nextStream.getTracks().includes(e.track)) {
            nextStream.addTrack(e.track);
          }
          return { ...p, stream: nextStream };
        });
      });
    };

    if (isOffer) {
      await renegotiatePeer(targetId, pc).catch((err) => console.warn('[Meeting] Offer failed:', err));
    }
  };

  const handlePeerSignal = async (senderId: string, signal: any) => {
    let pc = peersRef.current.get(senderId);
    if (!pc) {
       await initiatePeerConnection(senderId, false);
       pc = peersRef.current.get(senderId)!;
    }

    if (signal.type === 'offer') {
      await pc.setRemoteDescription(new RTCSessionDescription(signal));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      sendMeetingSignal(senderId, answer);
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
    const nextMuted = !isMuted;
    localStream.getAudioTracks().forEach(t => t.enabled = !nextMuted);
    setIsMuted(nextMuted);
    sendMediaState(nextMuted, isCameraOff);
  };

  const toggleCamera = async () => {
    if (isScreenSharing) return;

    if (!isCameraOff) {
      const current = localStreamRef.current;
      current?.getVideoTracks().forEach((track) => {
        track.stop();
        current.removeTrack(track);
      });
      await replacePeerTrack('video', getPlaceholderVideoTrack());
      setLocalStream(current && current.getTracks().length ? current : null);
      setIsCameraOff(true);
      if (localVideoRef.current) localVideoRef.current.srcObject = current || null;
      publishMediaState(isMuted, true, false);
      return;
    }

    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      const videoTrack = cameraStream.getVideoTracks()[0];
      const current = localStreamRef.current || new MediaStream();
      current.getVideoTracks().forEach((track) => {
        track.stop();
        current.removeTrack(track);
      });
      if (videoTrack) current.addTrack(videoTrack);
      localStreamRef.current = current;
      setLocalStream(current);
      await replacePeerTrack('video', videoTrack || getPlaceholderVideoTrack());
      if (localVideoRef.current) localVideoRef.current.srcObject = current;
      setIsCameraOff(false);
      setMediaReady(true);
      publishMediaState(isMuted, false, false);
    } catch (err: any) {
      setMeetingError(err?.message || 'Could not turn camera on.');
      setIsCameraOff(true);
      publishMediaState(isMuted, true, false);
    }
  };

  const stopScreenShare = async () => {
    const screenStream = screenStreamRef.current;
    screenStream?.getTracks().forEach(track => track.stop());
    screenStreamRef.current = null;
    const cameraVideo = localStreamRef.current?.getVideoTracks()[0] || getPlaceholderVideoTrack();
    const micAudio = localStreamRef.current?.getAudioTracks()[0] || null;
    await replacePeerTrack('video', cameraVideo);
    await replacePeerTrack('audio', micAudio);
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    setIsScreenSharing(false);
    publishMediaState(isMuted, isCameraOff, false);
  };

  const startScreenShare = async () => {
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: shareSystemAudio
      } as DisplayMediaStreamOptions);
      const screenVideo = displayStream.getVideoTracks()[0];
      const systemAudio = displayStream.getAudioTracks()[0] || null;
      screenStreamRef.current = displayStream;
      if (!screenVideo) throw new Error('No screen video track was returned.');
      await replacePeerTrack('video', screenVideo);
      if (shareSystemAudio && systemAudio) {
        await replacePeerTrack('audio', systemAudio);
      }
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = displayStream;
      }
      setIsScreenSharing(true);
      publishMediaState(isMuted, false, true);
      screenVideo?.addEventListener('ended', () => stopScreenShare(), { once: true });
    } catch (err: any) {
      if (err?.name !== 'NotAllowedError') {
        setMeetingError(err?.message || 'Could not start screen sharing.');
      }
    }
  };

  const toggleScreenShare = () => {
    if (isScreenSharing) stopScreenShare();
    else startScreenShare();
  };

  const updateShareSystemAudio = (checked: boolean) => {
    setShareSystemAudio(checked);
    localStorage.setItem('remote365_meeting_share_system_audio', String(checked));
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
    const mailto = `mailto:${encodeURIComponent(cleanEmail)}?subject=${encodeURIComponent('Remote 365 meeting invite')}&body=${encodeURIComponent(`Join my Remote 365 meeting:\n\nCode: ${meetingCode}\nLink: ${meetingLink}`)}`;
    try {
      const token = (window as any).electronAPI
        ? (await (window as any).electronAPI.getToken())?.token
        : localStorage.getItem('access_token');
      if (!token) {
        if ((window as any).electronAPI?.openExternal) {
          await (window as any).electronAPI.openExternal(mailto);
        } else {
          window.location.href = mailto;
        }
        setInviteStatus('sent');
        setInviteMessage('Opened your email app with the meeting invite.');
        setInviteEmail('');
        return;
      }
      await api.post('/api/chat/session-invites', {
        email: cleanEmail,
        sessionName: `${user?.name || 'Remote 365'} meeting`,
        sessionCode: roomId,
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

  const sendChatMessage = () => {
    const text = chatText.trim();
    if (!text || !ws || ws.readyState !== WebSocket.OPEN) return;
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    ws.send(JSON.stringify({ type: 'meeting-chat', meetingId: roomId, id, message: text }));
    setChatText('');
  };

  const requestParticipantControl = (participant: Participant) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    ws.send(JSON.stringify({
      type: 'meeting-control-request',
      meetingId: roomId,
      requestId,
      targetConnectionId: participant.connectionId
    }));
    setControlStatus(`Control request sent to ${participant.user?.name || 'participant'}.`);
    setShowInvitePanel(true);
  };

  const respondToControlRequest = (approved: boolean) => {
    if (!controlRequest || !ws || ws.readyState !== WebSocket.OPEN) return;
    const cleanAccessKey = String(hostAccessKey || '').replace(/\D/g, '');
    if (approved && !cleanAccessKey) {
      setControlStatus('Your device access key is not ready yet.');
      return;
    }
    ws.send(JSON.stringify({
      type: 'meeting-control-response',
      meetingId: roomId,
      requestId: controlRequest.requestId,
      targetConnectionId: controlRequest.requesterConnectionId,
      approved,
      accessKey: cleanAccessKey,
      password: devicePassword || '',
      deviceName: user?.name || 'Remote 365 device'
    }));
    setControlStatus(approved ? `Approved control for ${controlRequest.requesterName}.` : `Denied control for ${controlRequest.requesterName}.`);
    setControlRequest(null);
  };

  const handleControlResponse = async (data: any) => {
    if (!data.approved) {
      setControlStatus(`${data.approverName || 'Participant'} denied your control request.`);
      setShowInvitePanel(true);
      return;
    }

    try {
      setControlStatus(`Opening remote control for ${data.deviceName || data.approverName || 'participant'}...`);
      const { data: authData } = await api.post('/api/devices/verify-access', {
        accessKey: String(data.accessKey || '').replace(/\D/g, ''),
        password: data.password
      });
      if ((window as any).electronAPI?.openViewerWindow) {
        await (window as any).electronAPI.openViewerWindow(
          String(data.accessKey || '').replace(/\D/g, ''),
          serverIP,
          authData.token,
          data.deviceName || data.approverName || 'Meeting participant',
          'desktop'
        );
        setControlStatus('Remote control window opened.');
      } else {
        setControlStatus('Remote control requires the desktop app.');
      }
    } catch (err: any) {
      setControlStatus(err.response?.data?.error || err.message || 'Could not open remote control.');
    } finally {
      setShowInvitePanel(true);
    }
  };

  const handleLeave = () => {
    ws?.send(JSON.stringify({ type: 'meeting-leave', meetingId: roomId }));
    onLeave();
  };

  const sharingTileIds = [
    ...(isScreenSharing ? ['local'] : []),
    ...participants.filter((participant) => participant.mediaState?.isScreenSharing).map((participant) => participant.connectionId)
  ];
  const primaryTileId = sharingTileIds.length
    ? (focusedParticipantId && sharingTileIds.includes(focusedParticipantId) ? focusedParticipantId : sharingTileIds[0])
    : (activeLayout === 'focus' && focusedParticipantId ? focusedParticipantId : null);
  const hasSpotlightLayout = Boolean(primaryTileId);
  const tileClassFor = (tileId: string) => {
    if (!hasSpotlightLayout) return '';
    return tileId === primaryTileId
      ? 'col-start-1 row-start-1 row-span-4 min-h-0'
      : 'col-start-2 min-h-0';
  };
  const hideTile = (tileId: string) => activeLayout === 'focus'
    && !sharingTileIds.length
    && Boolean(focusedParticipantId)
    && focusedParticipantId !== tileId;

  const toggleFullscreen = async () => {
    const target = document.documentElement;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await target.requestFullscreen();
      }
    } catch (err) {
      console.warn('[Meeting] Fullscreen failed:', err);
    }
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
            <h2 className="text-[15px] font-bold tracking-tight">Meeting: {meetingCode}</h2>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${meetingError ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
              <span className="text-[11px] text-gray-400 font-medium">
                {meetingError ? meetingError : `LIVE - ${participants.length + 1} Participants`}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveLayout('grid'); setFocusedParticipantId(null); }}
            className={`p-2 hover:bg-white/10 rounded-xl transition-colors ${activeLayout === 'grid' ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}
            title="Grid view"
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => { setActiveLayout('focus'); setFocusedParticipantId(prev => prev || 'local'); }}
            className={`p-2 hover:bg-white/10 rounded-xl transition-colors ${activeLayout === 'focus' ? 'text-blue-500' : 'text-gray-400 hover:text-white'}`}
            title="Focus view"
          >
            <Layout size={18} />
          </button>
          <div className="w-px h-6 bg-white/10 mx-2" />
          <button
            onClick={() => setShowSecurityPanel(true)}
            className="p-2 hover:bg-white/10 rounded-xl transition-colors text-gray-400 hover:text-white"
            title="Meeting security and permissions"
          >
            <Shield size={18} />
          </button>
        </div>
      </div>

      {/* Main Video Grid */}
      <div className="flex-1 p-6 overflow-hidden relative">
        <div className={`grid h-full gap-4 ${
          hasSpotlightLayout ? 'grid-cols-[minmax(0,1fr)_minmax(220px,26vw)] grid-rows-4' :
          activeLayout === 'focus' ? 'grid-cols-1' :
          participants.length === 0 ? 'grid-cols-1' :
          participants.length === 1 ? 'grid-cols-2' :
          participants.length <= 3 ? 'grid-cols-2 grid-rows-2' :
          'grid-cols-3 grid-rows-2'
        }`}>
          
          {/* Local Video */}
          <motion.div 
            layout
            onClick={() => { setActiveLayout('focus'); setFocusedParticipantId('local'); }}
            className={`relative bg-[#1A1A1A] rounded-3xl overflow-hidden border border-white/5 shadow-2xl group ${tileClassFor('local')} ${hideTile('local') ? 'hidden' : ''}`}
          >
            <video 
              ref={localVideoRef} 
              autoPlay 
              muted 
              playsInline 
            className={`w-full h-full ${isScreenSharing ? 'object-contain bg-black' : 'object-cover'} ${(!isScreenSharing && (isCameraOff || !localStream)) ? 'hidden' : ''}`}
          />
            {(!isScreenSharing && (isCameraOff || !localStream)) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#151515]">
                <div className="w-24 h-24 rounded-full bg-blue-600/20 flex items-center justify-center text-blue-500 mb-4 border border-blue-500/20">
                  <span className="text-3xl font-bold">{user?.name?.charAt(0) || 'U'}</span>
                </div>
                <p className="text-sm font-medium text-gray-500">
                  {isScreenSharing ? 'You are sharing your screen' : localStream ? 'Camera is off' : 'No camera or microphone found'}
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
              {isScreenSharing && <ScreenShare size={12} className="text-blue-300" />}
            </div>
          </motion.div>

          {/* Remote Participants */}
          <AnimatePresence mode="popLayout">
            {participants.map((p) => (
              <RemoteVideo
                key={p.connectionId}
                participant={p}
                hidden={hideTile(p.connectionId)}
                className={tileClassFor(p.connectionId)}
                onFocus={() => { setActiveLayout('focus'); setFocusedParticipantId(p.connectionId); }}
                onRequestControl={() => requestParticipantControl(p)}
              />
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
            disabled={isScreenSharing}
            title={isScreenSharing ? 'Stop screen sharing before changing camera' : isCameraOff ? 'Turn camera on' : 'Turn camera off'}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all disabled:opacity-45 ${isCameraOff ? 'bg-red-500 text-white' : 'bg-white/10 text-white hover:bg-white/20'}`}
          >
            {isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>

          <button
            onClick={toggleScreenShare}
            className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all ${isScreenSharing ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-white/10 text-white hover:bg-white/20'}`}
            title={isScreenSharing ? 'Stop screen sharing' : 'Share screen'}
          >
            {isScreenSharing ? <ScreenShareOff size={22} /> : <ScreenShare size={22} />}
          </button>

          <button
            onClick={() => setShowChatPanel(true)}
            className="w-14 h-14 rounded-2xl bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
            title="Meeting chat"
          >
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
          <button onClick={toggleFullscreen} className="p-2 text-gray-400 hover:text-white transition-colors" title="Fullscreen">
            <Maximize size={20} />
          </button>
          <button onClick={() => setShowInvitePanel(true)} className="p-2 text-gray-400 hover:text-white transition-colors" title="More meeting options">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {controlRequest && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="absolute top-20 left-1/2 -translate-x-1/2 z-[130] w-full max-w-md rounded-2xl bg-[#151515] border border-white/10 shadow-2xl p-5"
          >
            <h3 className="text-base font-bold text-white">Remote control request</h3>
            <p className="mt-1 text-sm text-gray-400">{controlRequest.requesterName} wants to use your PC.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => respondToControlRequest(false)} className="px-4 py-2 rounded-xl bg-white/10 text-white text-sm font-bold">Deny</button>
              <button onClick={() => respondToControlRequest(true)} className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold">Approve</button>
            </div>
          </motion.div>
        )}

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
                  <p className="text-xs text-gray-400 mt-0.5">Share this Remote 365 meeting code. Login is not required.</p>
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

                {controlStatus && (
                  <div className="rounded-xl px-4 py-3 text-sm bg-blue-500/10 text-blue-200 border border-blue-500/20">
                    {controlStatus}
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
                      <div key={participant.connectionId} className="flex items-center gap-2">
                        <ParticipantRow
                          name={participant.user?.name || 'Participant'}
                          mediaState={participant.mediaState}
                        />
                        <button
                          onClick={() => requestParticipantControl(participant)}
                          className="ml-auto w-8 h-8 rounded-lg bg-white/10 hover:bg-white/15 text-white flex items-center justify-center"
                          title="Request remote control"
                        >
                          <MousePointer2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showSecurityPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[125] bg-black/45 backdrop-blur-sm flex items-center justify-center px-4"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 14 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 14 }}
              className="w-full max-w-md rounded-2xl bg-[#111111] border border-white/10 shadow-2xl overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-white">Meeting settings</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Screen, audio, and permission controls.</p>
                </div>
                <button
                  onClick={() => setShowSecurityPanel(false)}
                  className="w-9 h-9 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center"
                  title="Close"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <label className="flex items-center justify-between gap-4 rounded-xl bg-white/[0.04] border border-white/10 px-4 py-3">
                  <span className="flex items-center gap-3">
                    <Volume2 size={18} className="text-blue-300" />
                    <span>
                      <span className="block text-sm font-bold text-white">Share desktop audio</span>
                      <span className="block text-xs text-gray-500">Includes audio from apps like YouTube during screen share.</span>
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={shareSystemAudio}
                    onChange={(e) => updateShareSystemAudio(e.target.checked)}
                    className="w-4 h-4"
                  />
                </label>

                <button
                  onClick={() => {
                    setShowSecurityPanel(false);
                    toggleScreenShare();
                  }}
                  className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm flex items-center justify-center gap-2"
                >
                  {isScreenSharing ? <ScreenShareOff size={18} /> : <ScreenShare size={18} />}
                  {isScreenSharing ? 'Stop screen sharing' : 'Start screen sharing'}
                </button>

                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-200">
                  Remote control is approval-only. When someone asks to use your PC, this window shows an Approve/Deny dialog before access opens.
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showChatPanel && (
          <motion.div
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 24 }}
            className="absolute right-5 top-20 bottom-28 z-[115] w-full max-w-sm rounded-2xl bg-[#111111] border border-white/10 shadow-2xl flex flex-col overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Meeting chat</h3>
                <p className="text-xs text-gray-500">{meetingCode}</p>
              </div>
              <button onClick={() => setShowChatPanel(false)} className="w-9 h-9 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chatMessages.length === 0 ? (
                <p className="text-sm text-gray-500 text-center mt-8">No messages yet.</p>
              ) : chatMessages.map((message) => (
                <div key={message.id} className="rounded-xl bg-white/[0.04] border border-white/10 px-3 py-2">
                  <div className="text-[11px] font-bold text-blue-300">{message.senderName}</div>
                  <div className="mt-1 text-sm text-gray-200 break-words">{message.text}</div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-white/10 flex gap-2">
              <input
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendChatMessage()}
                placeholder="Message everyone..."
                className="flex-1 h-11 rounded-xl bg-black/35 border border-white/10 px-3 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
              />
              <button onClick={sendChatMessage} className="w-11 h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center">
                <Send size={17} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ParticipantRow: React.FC<{ name: string; mediaState?: Participant['mediaState'] }> = ({ name, mediaState }) => (
  <div className="flex items-center gap-3 text-sm text-gray-300">
    <div className="w-7 h-7 rounded-full bg-blue-600/20 text-blue-300 flex items-center justify-center text-xs font-bold">
      {name.charAt(0).toUpperCase()}
    </div>
    <span className="truncate">{name}</span>
    <span className="ml-auto flex items-center gap-1 text-gray-500">
      {mediaState?.isMuted && <MicOff size={13} className="text-red-400" />}
      {mediaState?.isCameraOff && <VideoOff size={13} className="text-red-400" />}
    </span>
  </div>
);

const RemoteVideo: React.FC<{
  participant: Participant;
  hidden?: boolean;
  className?: string;
  onFocus?: () => void;
  onRequestControl?: () => void;
}> = ({ participant, hidden, className = '', onFocus, onRequestControl }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoReady, setVideoReady] = useState(false);
  const hasIncomingVideo = videoReady || Boolean(participant.stream?.getVideoTracks().some((track) => track.readyState === 'live'));
  const shouldShowPlaceholder = !hasIncomingVideo;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !participant.stream) {
      setVideoReady(false);
      return;
    }

    const updateReady = () => {
      setVideoReady(Boolean(video.videoWidth && video.videoHeight) || participant.stream!.getVideoTracks().some((track) => track.readyState === 'live'));
    };
    video.srcObject = participant.stream;
    video.addEventListener('loadedmetadata', updateReady);
    video.addEventListener('resize', updateReady);
    participant.stream.getVideoTracks().forEach((track) => {
      track.addEventListener('unmute', updateReady);
      track.addEventListener('ended', updateReady);
    });
    updateReady();
    video.play().catch(() => {});

    return () => {
      video.removeEventListener('loadedmetadata', updateReady);
      video.removeEventListener('resize', updateReady);
      participant.stream?.getVideoTracks().forEach((track) => {
        track.removeEventListener('unmute', updateReady);
        track.removeEventListener('ended', updateReady);
      });
    };
  }, [participant.stream]);

  return (
    <motion.div 
      layout
      onClick={onFocus}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`relative bg-[#1A1A1A] rounded-3xl overflow-hidden border border-white/5 shadow-2xl group ${className} ${hidden ? 'hidden' : ''}`}
    >
      <video 
        ref={videoRef} 
        autoPlay 
        playsInline 
        className={`w-full h-full ${participant.mediaState?.isScreenSharing ? 'object-contain bg-black' : 'object-cover'}`}
      />
      {shouldShowPlaceholder && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#151515]">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-gray-400 mb-3 border border-white/5">
              <span className="text-2xl font-bold">{participant.user?.name?.charAt(0) || 'P'}</span>
            </div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">
              {participant.mediaState?.isCameraOff ? 'Camera is off' : 'Connecting...'}
            </p>
          </div>
        </div>
      )}
      <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full text-[12px] font-bold border border-white/10 flex items-center gap-2">
        {participant.user?.name || 'Participant'}
        {participant.mediaState?.isMuted && <MicOff size={12} className="text-red-400" />}
        {participant.mediaState?.isScreenSharing && <ScreenShare size={12} className="text-blue-300" />}
      </div>
      <button
        onClick={(event) => {
          event.stopPropagation();
          onRequestControl?.();
        }}
        className="absolute top-4 right-4 h-10 rounded-xl bg-blue-600/90 hover:bg-blue-700 text-white transition-all flex items-center justify-center gap-2 border border-white/10 px-3 shadow-lg"
        title="Request remote control"
      >
        <MousePointer2 size={17} />
        <span className="text-xs font-bold">Control</span>
      </button>
    </motion.div>
  );
};
