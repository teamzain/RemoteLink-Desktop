import { create } from 'zustand';
import { 
  RTCPeerConnection, 
  RTCIceCandidate, 
  RTCSessionDescription, 
  MediaStream,
} from 'react-native-webrtc';
import api from '../api';

interface SessionState {
  isConnected: boolean;
  isConnecting: boolean;
  remoteStream: MediaStream | null;
  remoteCursor: { x: number, y: number, visible: boolean } | null;
  error: string | null;
  currentDeviceId: string | null;
  
  connect: (deviceId: string) => Promise<void>;
  disconnect: () => void;
  sendInput: (event: any) => void;
}

export const useSessionStore = create<SessionState>((set, get) => {
  let socket: WebSocket | null = null;
  let pc: any = null; // Using any for PC due to strict type issues with event listeners in current version
  let controlChannel: any = null;
  let offerTimer: any = null;
  let isRemoteDescriptionSet = false;
  const earlyIceCandidates: RTCIceCandidate[] = [];

  const cleanup = () => {
    if (offerTimer) clearInterval(offerTimer);
    if (socket) {
      socket.onmessage = null;
      socket.onopen = null;
      socket.onclose = null;
      socket.close();
    }
    if (pc) {
      pc.close();
    }
    if (controlChannel) {
      controlChannel.close();
    }
    
    socket = null;
    pc = null;
    controlChannel = null;
    isRemoteDescriptionSet = false;
    earlyIceCandidates.length = 0;
    
    set({ 
      isConnected: false, 
      isConnecting: false, 
      remoteStream: null, 
      remoteCursor: null,
      currentDeviceId: null 
    });
  };

  const handleSignalingMessage = async (data: any) => {
    console.log('[WebRTC] Signal:', data.type);
    
    switch (data.type) {
      case 'joined':
        if (data.success === false) {
          set({ error: data.error || 'Failed to join', isConnecting: false });
          cleanup();
        } else {
          startOfferRequests();
        }
        break;

      case 'offer':
        handleOffer(data.sdp);
        break;

      case 'ice-candidate':
        if (data.candidate) {
          // Desktop host sends candidate as a flat string with sdpMid/sdpMLineIndex at top level
          const candidate = new RTCIceCandidate({
            candidate: typeof data.candidate === 'string' ? data.candidate : data.candidate.candidate,
            sdpMid: data.sdpMid ?? (typeof data.candidate === 'object' ? data.candidate?.sdpMid : null) ?? '0',
            sdpMLineIndex: data.sdpMLineIndex ?? (typeof data.candidate === 'object' ? data.candidate?.sdpMLineIndex : null) ?? 0,
          });
          if (pc && isRemoteDescriptionSet) {
            await pc.addIceCandidate(candidate);
          } else {
            earlyIceCandidates.push(candidate);
          }
        }
        break;
    }
  };

  const startOfferRequests = () => {
    let retries = 0;
    const sendReq = () => {
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'request-offer',
          targetId: get().currentDeviceId
        }));
      }
    };

    sendReq();
    offerTimer = setInterval(() => {
      if (isRemoteDescriptionSet || retries > 10) {
        clearInterval(offerTimer);
        if (retries > 10 && !isRemoteDescriptionSet) {
          set({ error: 'Device not responding to signal', isConnecting: false });
        }
        return;
      }
      retries++;
      sendReq();
    }, 2000);
  };

  const handleOffer = async (sdp: string) => {
    try {
      const configuration = {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
        ]
      };

      pc = new RTCPeerConnection(configuration);

      pc.addEventListener('icecandidate', (event: any) => {
        if (event.candidate && socket) {
          socket.send(JSON.stringify({
            type: 'ice-candidate',
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
            targetId: get().currentDeviceId,
          }));
        }
      });

      pc.addEventListener('connectionstatechange', () => {
        console.log('[WebRTC] State:', pc?.connectionState);
        if (pc?.connectionState === 'connected') {
          set({ isConnected: true, isConnecting: false });
          get().sendInput({ type: 'request-keyframe' });
        } else if (pc?.connectionState === 'failed' || pc?.connectionState === 'disconnected') {
          set({ error: 'Connection lost' });
          cleanup();
        }
      });

      pc.addEventListener('track', (event: any) => {
        console.log('[WebRTC] Track received');
        if (event.streams && event.streams[0]) {
          set({ remoteStream: event.streams[0] });
        }
      });

      pc.addEventListener('datachannel', (event: any) => {
        console.log('[WebRTC] Data channel received');
        controlChannel = event.channel;
        controlChannel.onopen = () => {
          controlChannel?.send(JSON.stringify({ type: 'request-keyframe' }));
        };
        controlChannel.onmessage = (e: any) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === 'cursor') {
              set({ remoteCursor: { x: msg.x, y: msg.y, visible: msg.visible } });
            }
          } catch (err) {}
        };
      });

      await pc.setRemoteDescription(new RTCSessionDescription({ sdp, type: 'offer' }));
      isRemoteDescriptionSet = true;

      for (const candidate of earlyIceCandidates) {
        await pc.addIceCandidate(candidate);
      }
      earlyIceCandidates.length = 0;

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (socket) {
        socket.send(JSON.stringify({
          type: 'answer',
          sdp: answer.sdp,
          targetId: get().currentDeviceId
        }));
      }
    } catch (err: any) {
      console.error('[WebRTC] Offer error:', err);
      set({ error: err.message, isConnecting: false });
      cleanup();
    }
  };

  return {
    isConnected: false,
    isConnecting: false,
    remoteStream: null,
    remoteCursor: null,
    error: null,
    currentDeviceId: null,

    connect: async (deviceId: string) => {
      if (get().isConnecting) return;
      
      cleanup();
      set({ isConnecting: true, error: null, currentDeviceId: deviceId });

      try {
        const res = await api.post('/api/devices/verify-access', { accessKey: deviceId });
        const remoteToken = res.data.token;

        socket = new WebSocket('ws://159.65.84.190/api/signal');
        
        socket.onopen = () => {
          socket?.send(JSON.stringify({
            type: 'join',
            sessionId: deviceId,
            token: remoteToken
          }));
        };

        socket.onmessage = (e) => handleSignalingMessage(JSON.parse(e.data));
        socket.onerror = (e) => set({ error: 'Signaling connection failed' });
        socket.onclose = () => {
          if (get().isConnecting || get().isConnected) {
            set({ error: 'Signaling closed' });
            cleanup();
          }
        };

      } catch (err: any) {
        set({ error: err.message || 'Verification failed', isConnecting: false });
      }
    },

    disconnect: () => {
      cleanup();
    },

    sendInput: (event: any) => {
      if (controlChannel && controlChannel.readyState === 'open') {
        controlChannel.send(JSON.stringify(event));
      }
    }
  };
});
