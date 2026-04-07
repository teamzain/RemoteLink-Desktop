import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import * as Device from 'expo-device';
import { Platform, NativeModules, Alert } from 'react-native';
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

const SIGNALING_URL = 'ws://159.65.84.190/api/signal';

const _initiateWebRTC = async (viewerId: string, socket: WebSocket | null) => {
  console.log('[Host] Initiating WebRTC for viewer:', viewerId);
  _currentViewerId = viewerId;
  if (_peerConnection) {
    _peerConnection.close();
    _peerConnection = null;
  }

  _peerConnection = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
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
      // Smooth Bitrate Ramp-up: Start at 750kbps and ramp to 2.5Mbps 
      // over 3 seconds to avoid slamming the hardware encoder.
      try {
        const setBitrate = (kbps: number) => {
          _peerConnection?.getSenders?.()?.forEach?.((sender: any) => {
            if (sender.track?.kind !== 'video') return;
            const params = sender.getParameters?.();
            if (!params?.encodings?.length) return;
            params.encodings[0].maxBitrate = kbps * 1000;
            params.encodings[0].degradationPreference = 'maintain-resolution';
            sender.setParameters?.(params)?.catch?.(() => { });
          });
        };

        setBitrate(750);
        setTimeout(() => setBitrate(1500), 1500);
        setTimeout(() => setBitrate(2500), 3000);
      } catch { }
    }
  };

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
          if (_lastTouchDown && (Date.now() - _lastTouchDown.time) < 200) {
            // Tap detected! Use atomic click for better OS recognition
            console.log('[Host] Short tap detected, injecting atomic click');
            ConnectXModule.dispatchClick(event.x, event.y, 50);
            _lastTouchDown = null;
          } else {
            ConnectXModule.endContinuousGesture(event.x, event.y);
            _lastTouchDown = null;
          }
          break;

        case 'wheel': {
          // Map scroll wheel to a vertical swipe gesture
          const SCROLL_SCALE = 0.15; // fraction of screen per scroll tick
          const swipeDelta = Math.max(-SCROLL_SCALE, Math.min(SCROLL_SCALE, -event.deltaY / 300));
          const cx = event.x ?? 0.5;
          const cy = event.y ?? 0.5;
          ConnectXModule.dispatchSwipe(cx, cy, cx, cy + swipeDelta, 150);
          break;
        }

        case 'typeText':
          ConnectXModule.injectText(event.text);
          break;

        case 'globalAction':
          ConnectXModule.performGlobalAction(event.action);
          break;

        case 'request-keyframe': {
          console.log('[Host] Viewer requested keyframe recovery. Toggling track to force IDR...');
          const videoTrack = _localStream?.getVideoTracks?.()[0];
          if (videoTrack) {
            console.log('[Host] Track Settings:', videoTrack.getSettings?.() ?? 'Unavailable');
            // Longer toggle to ensure the Android OS/Encoder detects the state change
            videoTrack.enabled = false;
            setTimeout(() => {
              if (videoTrack) videoTrack.enabled = true;
              console.log('[Host] Track recovered. Keyframe emitted.');
              
              // Second pass: Some Android versions need a short blip to truly reset the encoder GOP
              setTimeout(() => {
                if (videoTrack) {
                   videoTrack.enabled = false;
                   setTimeout(() => { if (videoTrack) videoTrack.enabled = true; }, 50);
                }
              }, 500);
            }, 500);
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('[Host] DataChannel Error:', err);
    }
  };

  if (_localStream) {
    _localStream.getTracks().forEach((track: any) => {
      _peerConnection?.addTrack(track, _localStream);
    });
  }

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
      // Force profile-level-id=42e01f (Constrained Baseline, Level 3.1)
      return line.replace(/profile-level-id=[0-9a-fA-F]+/, 'profile-level-id=42e01f');
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

  socket?.send(JSON.stringify({
    type: 'offer',
    sdp: offer.sdp,
    hostType: 'android',
    targetId: viewerId,
  }));
};

  const _disconnectViewer = () => {
    if (_peerConnection) {
      _peerConnection.close();
      _peerConnection = null;
    }
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
                if (_localStream) _initiateWebRTC(data.viewerId, _socket);
                else {
                  _pendingViewerId = data.viewerId;
                  await get().startHosting();
                }
                break;
              case 'viewer-left': _disconnectViewer(); break;
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
      if (get().isHosting) return;
      set({ error: null });

      try {
        await get().ensureHosting();
        await get().checkAccessibilityStatus();

        // Check Accessibility
        if (!get().isAccessibilityEnabled) {
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
      }
    },

    stopHosting: async () => {
      // Notify the current viewer so the desktop updates immediately
      if (_socket && _socket.readyState === WebSocket.OPEN && _currentViewerId) {
        try {
          _socket.send(JSON.stringify({ type: 'host-stopped', targetId: _currentViewerId }));
        } catch { }
      }
      // Only tear down WebRTC — keep _localStream alive so the next
      // startHosting() call skips the screen-capture consent dialog.
      set({ isHosting: false });
      if (_peerConnection) {
        _peerConnection.close();
        _peerConnection = null;
        _pendingViewerId = null;
        _currentViewerId = null;
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
    if (!_localStream) {
      // Note: Android 14+ requires a foreground service of type 'mediaProjection'.
      // Standard react-native-webrtc getDisplayMedia() handles this naturally.
      // Explicitly calling startProjectionService() caused a double-dialog bug.

      // Capture screen via WebRTC
      _localStream = await (mediaDevices as any).getDisplayMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
        },
      });

      // 'detail' mode: tell the encoder this is screen content
      const videoTrack = _localStream?.getVideoTracks?.()[0];
      if (videoTrack) {
        (videoTrack as any).contentHint = 'detail';

        // Self-Healing Track Monitor
        videoTrack.onmute = () => {
          console.warn('[Host] Video track MUTED by OS! Attempting recovery...');
          videoTrack.enabled = false;
          videoTrack.enabled = true;
        };
        videoTrack.onunmute = () => {
          console.log('[Host] Video track UNMUTED. Stream should resume.');
        };
      }
    }

    // ── Accessibility Service Runtime Guard ──────────────────────────────────
    // Android reconnects the Accessibility Service asynchronously after app
    // restart. Poll for up to 5s before warning the user.
    const { ConnectXModule } = NativeModules;
    if (ConnectXModule?.isAccessibilityServiceConnected) {
      let svcConnected = false;
      for (let attempt = 0; attempt < 10; attempt++) {
        svcConnected = await ConnectXModule.isAccessibilityServiceConnected();
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
            { text: 'Open Settings', onPress: () => ConnectXModule.openAccessibilitySettings() },
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

