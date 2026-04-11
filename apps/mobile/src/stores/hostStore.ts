import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { Platform, NativeModules, Alert } from 'react-native';
const ConnectX = NativeModules.ConnectXModule;
import api from '../api';
import { useAuthStore } from './authStore';
import { mediaDevices, RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } from 'react-native-webrtc';

interface HostState {
  isHosting: boolean;
  isSignaling: boolean;
  isAccessibilityEnabled: boolean;
  hasOverlayPermission: boolean;
  hasIgnoreBatteryOptimization: boolean;
  isRegistering: boolean;
  hasPassword: boolean | null; // null = not yet checked
  deviceId: string | null;
  sessionId: string | null;
  error: string | null;

  registerDevice: () => Promise<void>;
  setHostPassword: (password: string) => Promise<void>;
  ensureHosting: () => Promise<void>;
  startHosting: () => Promise<void>;
  stopHosting: () => Promise<void>;
  disconnect: () => void;
  checkAccessibilityStatus: () => Promise<void>;
  openAccessibilitySettings: () => void;
  checkOverlayPermission: () => Promise<void>;
  requestOverlayPermission: () => void;
  checkBatteryOptimization: () => Promise<void>;
  requestBatteryOptimizationExemption: () => void;
  testLocalTouch: () => void;
}

// Private transient variables
let _socket: WebSocket | null = null;
let _peerConnection: any = null;
let _localStream: any = null;
let _controlChannel: any = null;
let _reconnectTimer: any = null;
let _reconnectAttempts = 0;
let _pendingViewerId: string | null = null;
let _currentViewerId: string | null = null;
let _lastTouchDown: { x: number, y: number, time: number } | null = null;
let _isTogglingTrack = false;
let _isHandlingJoin = false;
let _isStartingHosting = false;
let _isProceeding = false;

// Removed old forceKeyframe hack - handled by fresh session lifecycle now


const SIGNALING_URL = 'ws://159.65.84.190/api/signal';

const _triggerKeyframe = (intensity = 0.505) => {
  if (!_localStream || _isTogglingTrack) return;
  console.log(`[Host] Force-triggering IDR keyframe via system nudge (${intensity})...`);
  if (ConnectX) {
    ConnectX.dispatchSwipe(0.5, 0.5, intensity, intensity, 100);
  }
};

const _initiateWebRTC = async (viewerId: string, socket: WebSocket | null) => {
  console.log('[Host] Initiating WebRTC for viewer:', viewerId);
  _currentViewerId = viewerId;
   console.log('[Host] stage: cleanup-old-pc');
   if (_peerConnection) {
     _peerConnection.close();
     _peerConnection = null;
   }
 
   console.log('[Host] stage: create-new-pc');

  _peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { 
        urls: 'turn:159.65.84.190:3478',
        username: 'admin',
        credential: 'B07qfTNwSC2yZvcs'
      }
    ],
  });

  _peerConnection.onicecandidate = (event: any) => {
    if (event.candidate && socket) {
      socket.send(JSON.stringify({
        type: 'ice-candidate',
        candidate: event.candidate.candidate,
        sdpMid: event.candidate.sdpMid,
        sdpMLineIndex: event.candidate.sdpMLineIndex,
        targetId: viewerId,
      }));
    }
  };

  _peerConnection.onconnectionstatechange = () => {
    const state = _peerConnection?.connectionState;
    console.log('[Host] Connection state:', state);
    if (state === 'connected') {
      try {
        _peerConnection?.getSenders?.()?.forEach?.((sender: any) => {
          if (sender.track?.kind !== 'video') return;
          const params = sender.getParameters?.();
          if (!params?.encodings?.length) return;
          params.encodings[0].maxBitrate = 3000 * 1000; // Optimized: 3 Mbps for smoother mobile-to-desktop perf
          sender.setParameters?.(params)?.catch?.(() => { });
        });
      } catch { }
      // Session is fresh, codec was just initialized. No 'kick' needed.
    }
  };

   _peerConnection.oniceconnectionstatechange = () => {
     const state = _peerConnection?.iceConnectionState;
     console.log('[Host] ICE connection state:', state);
     
     if (state === 'connected' || state === 'completed') {
       // Force a "Nudge Storm" immediately upon connection to clear any black screen
       // 3 small nudges with 500ms gaps ensure the encoder wakes up even if the first is missed.
       for (let i = 0; i < 3; i++) {
         setTimeout(() => {
           console.log(`[Host] ICE Connected. Nudge Storm ${i + 1}/3...`);
           _triggerKeyframe(0.505 + (i * 0.001));
         }, 500 + (i * 800));
       }
     }
   };


   console.log('[Host] stage: datachannel-setup');
   // Control DataChannel
   _controlChannel = _peerConnection.createDataChannel("control");
  _controlChannel.onopen = () => console.log('[Host] Control DataChannel OPEN');
  _controlChannel.onclose = () => console.log('[Host] Control DataChannel CLOSED');
  _controlChannel.onerror = (err: any) => console.error('[Host] Control DataChannel ERROR:', err);

  _controlChannel.onmessage = (e: any) => {
    try {
      const { ConnectXModule } = NativeModules;
      if (!ConnectXModule) return;
      const event = JSON.parse(e.data);
      // Removed noisy logs for better throughput

      switch (event.type) {
        case 'mousedown':
          _lastTouchDown = { x: event.x, y: event.y, time: Date.now() };
          ConnectXModule.startContinuousGesture(event.x, event.y);
          break;

        case 'mousemove':
          if (_lastTouchDown) {
            const dx = Math.abs(event.x - _lastTouchDown.x);
            const dy = Math.abs(event.y - _lastTouchDown.y);
            if (dx > 0.01 || dy > 0.01) _lastTouchDown = null; // Significant move, not a tap
          }
          ConnectXModule.updateContinuousGesture(event.x, event.y);
          break;

        case 'mouseup':
          if (_lastTouchDown && (Date.now() - _lastTouchDown.time) < 300) {
            // Tap detected! Use atomic click for better OS recognition
            ConnectXModule.dispatchClick(event.x, event.y, 80);
            _lastTouchDown = null;
          } else {
            ConnectXModule.endContinuousGesture(event.x, event.y);
            _lastTouchDown = null;
          }
          break;

        case 'wheel': {
          // Map scroll wheel delta to a swipe gesture.
          // Scale: deltaY=150 (one fast wheel tick) → 30% screen swipe for natural feel.
          const SCROLL_SCALE = 0.35;
          const swipeDeltaY = Math.max(-SCROLL_SCALE, Math.min(SCROLL_SCALE, -event.deltaY / 150));
          const swipeDeltaX = Math.max(-SCROLL_SCALE, Math.min(SCROLL_SCALE, -event.deltaX / 150));
          const cx = event.x ?? 0.5;
          const cy = event.y ?? 0.5;
          // Route to the dominant axis; skip micro-movements
          if (Math.abs(swipeDeltaY) >= Math.abs(swipeDeltaX) && Math.abs(swipeDeltaY) > 0.01) {
            ConnectXModule.dispatchSwipe(cx, cy, cx, cy + swipeDeltaY, 80);
          } else if (Math.abs(swipeDeltaX) > 0.01) {
            ConnectXModule.dispatchSwipe(cx, cy, cx + swipeDeltaX, cy, 80);
          }
          break;
        }

        case 'typeText':
          ConnectXModule.injectText(event.text);
          break;

        case 'globalAction':
          ConnectXModule.performGlobalAction(event.action);
          break;

        case 'request-keyframe': {
          _triggerKeyframe();
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('[Host] DataChannel Error:', err);
    }
  };

   console.log('[Host] stage: adding-tracks');
   if (_localStream) {
     _localStream.getTracks().forEach((track: any) => {
       _peerConnection?.addTrack(track, _localStream);
     });
   }
 
   console.log('[Host] stage: creating-offer');
   const offer = await _peerConnection.createOffer({});

  // --- SDP Normalization (Force Constrained Baseline for Desktop Compatibility) ---
  let sdpLines = (offer.sdp ?? '').split('\r\n');
  let vp8PayloadTypes: string[] = [];
  let h264PayloadTypes: string[] = [];

  // Identify codecs
  for (const line of sdpLines) {
    if (line.includes('a=rtpmap:') && line.includes('VP8/90000')) {
      const match = line.match(/a=rtpmap:(\d+)/);
      if (match) vp8PayloadTypes.push(match[1]);
    }
    if (line.includes('a=rtpmap:') && line.includes('H264/90000')) {
      const match = line.match(/a=rtpmap:(\d+)/);
      if (match) h264PayloadTypes.push(match[1]);
    }
  }

  // Optimize and Normalize H264
  sdpLines = sdpLines.map((line: string) => {
    if (line.includes('a=fmtp:') && h264PayloadTypes.some(pt => line.includes(`a=fmtp:${pt}`))) {
      // Round 7: Force profile-level-id=42e028 (Baseline, Level 4.0)
      // This is the most compatible profile for modern Chromium and Mobile GPUs
      let updatedLine = line;
      if (!updatedLine.includes('profile-level-id=')) {
          updatedLine += ';profile-level-id=42e01f';
      } else {
          updatedLine = updatedLine.replace(/profile-level-id=[0-9a-fA-F]+/, 'profile-level-id=42e01f');
      }
      if (!updatedLine.includes('packetization-mode=')) {
          updatedLine += ';packetization-mode=1';
      }
      return updatedLine;
    }
    return line;
  });

  // Prioritize H264 in the m=video line
  const mVideoIdx = sdpLines.findIndex((l: string) => l.startsWith('m=video'));
  if (mVideoIdx !== -1) {
    const pTypes = sdpLines[mVideoIdx].split(' ').slice(3);
    const prioritizedPTs = [
      ...h264PayloadTypes, 
      ...vp8PayloadTypes, 
      ...pTypes.filter((p: string) => !vp8PayloadTypes.includes(p) && !h264PayloadTypes.includes(p))
    ];
    sdpLines[mVideoIdx] = sdpLines[mVideoIdx].split(' ').slice(0, 3).join(' ') + ' ' + prioritizedPTs.join(' ');
  }

  offer.sdp = sdpLines.join('\r\n');
  console.log('[Host] Sent Offer with Normalized H264 SDP');

  await _peerConnection.setLocalDescription(new RTCSessionDescription({
    type: 'offer',
    sdp: offer.sdp,
  }));

  await new Promise(r => setTimeout(r, 400)); // Small delay to ensure viewer is ready

  socket?.send(JSON.stringify({
    type: 'offer',
    sdp: offer.sdp,
    hostType: 'android',
    targetId: viewerId,
  }));
};


  const _disconnectViewer = async () => {
    console.log('[Host] Disconnecting viewer (PeerConnection cleanup only)...');
    if (_peerConnection) {
      try { _peerConnection.close(); } catch {}
      _peerConnection = null;
    }
    // We intentionally do NOT stop or null _localStream here.
    // This keeps the hardware encoder active and the MediaProjection token valid,
    // allowing the next viewer to connect instantly without a "Start now" prompt.
    
    _pendingViewerId = null;
    _currentViewerId = null;
  };



  export const useHostStore = create<HostState>((set, get) => ({
    isHosting: false,
    isSignaling: false,
    isAccessibilityEnabled: false,
    hasOverlayPermission: false,
    hasIgnoreBatteryOptimization: false,
    isRegistering: false,
    hasPassword: null,
    deviceId: null,
    sessionId: null,
    error: null,

    registerDevice: async () => {
      const { accessToken } = useAuthStore.getState();
      if (!accessToken) {
        set({ error: 'User not authenticated. Please log in.' });
        return;
      }
      const cachedId = await SecureStore.getItemAsync('host_device_id');
      const cachedKey = await SecureStore.getItemAsync('host_access_key');
      const cachedHasPassword = await SecureStore.getItemAsync('host_has_password');
      if (cachedId && cachedKey) {
        // Use cached password status immediately so UI shows correct state before server responds
        set({ deviceId: cachedId, sessionId: cachedKey, hasPassword: cachedHasPassword === 'true' ? true : null });
        try {
          const { data } = await api.get('/api/devices/mine', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const thisDevice = data.find((d: any) => d.id?.toString() === cachedId);
          if (thisDevice) {
            const hp = !!thisDevice.has_password;
            set({ hasPassword: hp });
            await SecureStore.setItemAsync('host_has_password', hp ? 'true' : 'false');
          }
        } catch { }
        return;
      }
      set({ isRegistering: true, error: null });
      try {
        let deviceName = 'React Native Device';
        let hardwareId = 'Unknown';
        if (Platform.OS === 'android' || Platform.OS === 'ios') {
          deviceName = `${Device.manufacturer || ''} ${Device.modelName || ''}`.trim();
          hardwareId = Device.osBuildId || Math.random().toString();
        }
        const response = await api.post('/api/devices/register', {
          name: deviceName,
          deviceType: Platform.OS.toUpperCase(),
          hardwareId: hardwareId,
        }, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (response.status === 200 || response.status === 201) {
          const { id, access_key, has_password } = response.data;
          const deviceIdStr = id.toString();
          await SecureStore.setItemAsync('host_device_id', deviceIdStr);
          await SecureStore.setItemAsync('host_access_key', access_key);
          set({ deviceId: deviceIdStr, sessionId: access_key, hasPassword: !!has_password });
        }
      } catch (error: any) {
        set({ error: error.response?.data?.message || 'Failed to register device' });
      } finally {
        set({ isRegistering: false });
      }
    },

    setHostPassword: async (password: string) => {
      const state = get();
      const { accessToken } = useAuthStore.getState();
      if (!state.deviceId || !accessToken) {
        await state.registerDevice();
      }
      await api.post('/api/devices/set-password', {
        deviceId: get().deviceId,
        password,
      }, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      await SecureStore.setItemAsync('host_has_password', 'true');
      set({ hasPassword: true });
    },

    ensureHosting: async () => {
      if (get().isSignaling) return;
      try {
        const { ConnectXModule } = NativeModules;
        if (ConnectXModule) {
          ConnectXModule.requestNotificationPermission();
          ConnectXModule.startBackgroundService();
        }
        await get().checkAccessibilityStatus();

        const connectSignaling = async () => {
          if (get().isSignaling) return;
          const { accessToken } = useAuthStore.getState();
          if (!accessToken) throw new Error('Not authenticated');
          if (!get().sessionId) await get().registerDevice();
          _socket = new WebSocket(SIGNALING_URL);
          _socket.onopen = () => {
            _socket?.send(JSON.stringify({
              type: 'register',
              token: accessToken,
              role: 'host',
              accessKey: get().sessionId,
            }));
            set({ isSignaling: true });
          };
          _socket.onmessage = async (e) => {
            const data = JSON.parse(e.data);
            switch (data.type) {
              case 'ping': _socket?.send(JSON.stringify({ type: 'pong' })); break;
              case 'viewer-joined':
                console.log(`[Host] Viewer joined: ${data.viewerId}`);
                if (_isHandlingJoin) {
                  console.log('[Host] Busy handling another join, skipping...');
                  return;
                }
                
                 try {
                   _isHandlingJoin = true;
                   
                   // SAFETY WATCHDOG: If join doesn't complete in 15s, release lock anyway.
                   const joinTimeout = setTimeout(() => {
                     if (_isHandlingJoin) {
                       console.warn('[Host] Join watchdog triggered! Releasing lock after 15s hang...');
                       _isHandlingJoin = false;
                     }
                   }, 15000);

                   // Check if we can reuse the existing stream track
                   const hasActiveStream = _localStream && _localStream.getTracks().some((t: any) => t.readyState === 'live');
                   
                   if (hasActiveStream) {
                     console.log('[Host] Reusing existing stream for reconnection ✓');
                     // Force-trigger a frame refresh on the system by doing a 1px nudge
                     if (ConnectX) {
                       console.log('[Host] Persistence: Nudging stream active...');
                       ConnectX.dispatchSwipe(0.5, 0.5, 0.505, 0.505, 100);
                     }
                     set({ isHosting: true, error: null }); // Ensure UI stays in LIVE state
                     console.log('[Host] Waiting for signaling cooldown (1000ms)...');
                     await new Promise(r => setTimeout(r, 1000)); 
                     await _initiateWebRTC(data.viewerId, _socket);
                   } else {
                     console.log('[Host] No active stream or fresh join. Initializing new capture...');
                     // If there's a stale stream or a new viewer, full reset first
                     if (_localStream || _peerConnection) {
                       await _disconnectViewer();
                       await new Promise(r => setTimeout(r, 1000)); // Increased reset cooldown
                     }
                     _pendingViewerId = data.viewerId;
                     await get().startHosting();
                   }
                   clearTimeout(joinTimeout);
                 } finally {
                   _isHandlingJoin = false;
                 }

                break;


              case 'viewer-left': 
                if (data.viewerId === _currentViewerId) {
                  console.log(`[Host] Active viewer left: ${data.viewerId}. Cleaning up...`);
                  _disconnectViewer();
                } else {
                  console.log(`[Host] Stale viewer left: ${data.viewerId}. Ignoring.`);
                }
                break;
              case 'answer':
                if (_peerConnection) await _peerConnection.setRemoteDescription(new RTCSessionDescription({ sdp: data.sdp, type: 'answer' }));
                break;
              case 'ice-candidate':
                if (_peerConnection && data.candidate) await _peerConnection.addIceCandidate(new RTCIceCandidate(data));
                break;
            }
          };
          _socket.onclose = () => {
            set({ isSignaling: false });
            _scheduleReconnect();
          };
        };

        const _scheduleReconnect = () => {
          if (_reconnectTimer) clearTimeout(_reconnectTimer);
          const delay = Math.max(3000, 3000 * Math.pow(2, _reconnectAttempts));
          _reconnectAttempts++;
          _reconnectTimer = setTimeout(async () => {
            if (!get().isSignaling) await connectSignaling().catch(_scheduleReconnect);
          }, delay);
        };

        await connectSignaling();
      } catch (e) {
        console.error('[Host] ensureHosting failed', e);
      }
    },

    startHosting: async () => {
      if (get().isHosting || _isStartingHosting) {
        console.log('[Host] Hosting already active or starting. Ignoring request.');
        return;
      }
      
      _isStartingHosting = true;
      set({ error: null });

      try {
        await get().ensureHosting();
        await get().checkAccessibilityStatus();

        // Check Accessibility
        if (!get().isAccessibilityEnabled) {
          _isStartingHosting = false; // Release lock before showing alert
          return new Promise((resolve) => {
            Alert.alert(
              'Remote Control Required',
              'To control this phone from your desktop, you must enable the Connect-X Accessibility Service. Would you like to turn it on now?',
              [
                {
                  text: 'Host Only (View)', onPress: async () => {
                    await proceedWithHostingActual(set, get);
                    resolve();
                  }
                },
                {
                  text: 'Enable Remote Use', onPress: () => {
                    get().openAccessibilitySettings();
                    resolve();
                  }, style: 'default'
                }
              ]
            );
          });
        }

        await proceedWithHostingActual(set, get);
      } catch (e) {
        console.error('[Host] startHosting failed', e);
        set({ error: 'Failed to start hosting.', isHosting: false });
      } finally {
        _isStartingHosting = false;
      }
    },


    stopHosting: async () => {
      console.log('[Host] Stopping host session...');
      // Notify the current viewer so the desktop updates immediately
      if (_socket && _socket.readyState === WebSocket.OPEN && _currentViewerId) {
        try {
          _socket.send(JSON.stringify({ type: 'host-stopped', targetId: _currentViewerId }));
        } catch { }
      }
      
      set({ isHosting: false });
      await _disconnectViewer();
      
      // Stop the stream since we are stopping the host entirely
      if (_localStream) {
        _localStream.getTracks().forEach((t: any) => {
           try { t.stop(); } catch {}
        });
        _localStream = null;
      }
      const { ConnectXModule } = NativeModules;
      if (ConnectXModule) {
         try { ConnectXModule.stopProjectionService(); } catch {}
      }
    },



    disconnect: () => {
      // Full shutdown: stop stream, signaling, and WebRTC.
      get().stopHosting();
      if (_localStream) {
        _localStream.getTracks().forEach((t: any) => t.stop());
        try { _localStream.release(); } catch { }
        _localStream = null;
      }
      const { ConnectXModule } = NativeModules;
      if (ConnectXModule) ConnectXModule.stopProjectionService();
      if (_reconnectTimer) clearTimeout(_reconnectTimer);
      _reconnectAttempts = 0;
      if (_socket) {
        _socket.close();
        _socket = null;
      }
      set({ isSignaling: false });
    },

    checkAccessibilityStatus: async () => {
      const { ConnectXModule } = NativeModules;
      if (ConnectXModule) {
        const isEnabled = await ConnectXModule.isAccessibilityServiceEnabled();
        set({ isAccessibilityEnabled: !!isEnabled });
      }
    },

    openAccessibilitySettings: () => {
      const { ConnectXModule } = NativeModules;
      if (ConnectXModule) {
        ConnectXModule.openAccessibilitySettings();
      }
    },

    checkOverlayPermission: async () => {
      const { ConnectXModule } = NativeModules;
      if (ConnectXModule?.canDrawOverlays) {
        const granted = await ConnectXModule.canDrawOverlays();
        set({ hasOverlayPermission: !!granted });
      }
    },

    requestOverlayPermission: () => {
      const { ConnectXModule } = NativeModules;
      if (ConnectXModule?.requestDrawOverlays) {
        ConnectXModule.requestDrawOverlays();
      }
    },

    checkBatteryOptimization: async () => {
      const { ConnectXModule } = NativeModules;
      if (ConnectXModule?.isIgnoringBatteryOptimizations) {
        const ignored = await ConnectXModule.isIgnoringBatteryOptimizations();
        set({ hasIgnoreBatteryOptimization: !!ignored });
      }
    },

    requestBatteryOptimizationExemption: () => {
      const { ConnectXModule } = NativeModules;
      if (ConnectXModule?.requestIgnoreBatteryOptimizations) {
        ConnectXModule.requestIgnoreBatteryOptimizations();
      }
    },

    testLocalTouch: () => {
      const { NativeModules } = require('react-native');
      const { ConnectXModule } = NativeModules;
      if (ConnectXModule) {
        console.log('[Host] TRACE: Performing LOCAL TEST touch at (0.5, 0.5)...');
        ConnectXModule.dispatchClick(0.5, 0.5, 100);
      } else {
        console.error('[Host] ConnectXModule missing for test.');
      }
    },
  }));

  // Separate helper to avoid zustand issues
  const proceedWithHostingActual = async (set: any, get: any) => {
    if (_isProceeding) {
      console.warn('[Host] already proceeding with capture. Ignoring.');
      return;
    }
    _isProceeding = true;
    
    try {
      // Always request a fresh service start in Elite Mode
      if (Platform.OS === 'android') {
        const ConnectX = NativeModules.ConnectXModule;
        if (ConnectX) {
          console.log('[Host] Resetting Projection Service...');
          await ConnectX.startProjectionService();
          
          // Wait for service to be confirmed as RUNNING (with defensive check for stale builds)
          let running = false;
          if (typeof ConnectX.isProjectionServiceRunning === 'function') {
            for (let i = 0; i < 10; i++) {
              running = await ConnectX.isProjectionServiceRunning();
              if (running) break;
              await new Promise(r => setTimeout(r, 200));
            }
          } else {
            console.warn('[Host] Native method isProjectionServiceRunning missing. Stale build? Falling back.');
            await new Promise(r => setTimeout(r, 800));
            running = true; 
          }
          if (!running) console.warn('[Host] Service failed to report RUNNING state after 2s');

          
          console.log('[Host] Delaying capture for token stability...');
          await new Promise(r => setTimeout(r, 1200)); // Increased for stability
        }
      }
      
      // Safety check: stop any existing tracks to avoid "operation pending" errors
      if (_localStream) {
        console.log('[Host] Cleaning up stale stream tracks...');
        _localStream.getTracks().forEach((track: any) => {
          try { track.stop(); } catch {}
        });
        _localStream = null;
      }

      console.log('[Host] Launching getDisplayMedia...');
      _localStream = await (mediaDevices as any).getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      if (!_localStream) throw new Error('Local stream not acquired');

      _localStream.getTracks().forEach((track: any) => {
        console.log(`[Host] Track [${track.kind}] state: ${track.readyState}`);
        track.onended = () => {
          console.warn(`[Host] CRITICAL: Track [${track.kind}] ended unexpectedly! (Android cleanup or user revoked)`);
          // Notify the UI if we were active
          if (get().isHosting) {
            get().stopHosting();
          }
        };
      });

      const videoTrack = _localStream?.getVideoTracks?.()[0];
      if (!videoTrack) throw new Error('No video track found in stream');
      (videoTrack as any).contentHint = 'detail';

      // If we had a viewer waiting, initiate connection
      if (_pendingViewerId) {
        console.log('[Host] Triggering delayed WebRTC for pending viewer:', _pendingViewerId);
        await new Promise(r => setTimeout(r, 500));
        await _initiateWebRTC(_pendingViewerId, _socket);
        _pendingViewerId = null;
      }

      set({ isHosting: true, error: null });
      console.log('[Host] Hosting lifecycle established ✓');

      // --- Auto-Initialize Stream (The "Nudge") ---
      // Force a microscopic UI change via Accessibility Service to ensure MediaProjection 
      // emits the first frame without requiring physical user interaction on the phone.
      if (ConnectX) {
        setTimeout(() => {
          console.log('[Host] Performing microscopic nudge to auto-start stream...');
          ConnectX.dispatchSwipe(0.5, 0.5, 0.505, 0.505, 100);
        }, 800);
      }
    } catch (e: any) {
      console.error('[Host] proceedWithHosting failed:', e.message);
      _isProceeding = false;
      throw e;
    } finally {
      _isProceeding = false;
    }

    // ── Accessibility Service Runtime Guard ──────────────────────────────────
    // Android reconnects the Accessibility Service asynchronously after app
    // restart. Poll for up to 5s before warning the user.
    if (ConnectX?.isAccessibilityServiceConnected) {
      let svcConnected = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        svcConnected = await ConnectX.isAccessibilityServiceConnected();
        if (svcConnected) break;
        console.warn(`[Host] Accessibility Service instance not ready yet (attempt ${attempt + 1}/10). Retrying...`);
        await new Promise(r => setTimeout(r, 500));
      }

      if (!svcConnected) {
        console.error('[Host] Accessibility Service STILL not connected after 5s! Remote touch will NOT work.');
        Alert.alert(
          'Remote Control Unavailable',
          'The Accessibility Service is not active. Please go to Settings → Accessibility → Connect-X and toggle it OFF then ON again.',
          [
            { text: 'Open Settings', onPress: () => ConnectX.openAccessibilitySettings() },
            { text: 'Continue Anyway', style: 'cancel' },
          ]
        );
      } else {
        console.log('[Host] Accessibility Service instance confirmed READY. Remote touch enabled ✓');
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    set({ isHosting: true });

    if (_pendingViewerId) {
      _initiateWebRTC(_pendingViewerId, _socket);
      _pendingViewerId = null;
    }
  };

