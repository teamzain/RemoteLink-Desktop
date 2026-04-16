import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/widgets.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'auth_provider.dart';

class HostProvider extends ChangeNotifier with WidgetsBindingObserver {
  static const _controlChannelName = 'com.example.remotelink/control';
  final _methodChannel = const MethodChannel(_controlChannelName);

  AuthProvider _authProvider;
  final _storage = const FlutterSecureStorage();
  final _deviceInfo = DeviceInfoPlugin();
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'http://159.65.84.190',
    connectTimeout: const Duration(seconds: 5),
  ));

  bool _isDisposed = false;

  WebSocket? _socket;
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;
  RTCDataChannel? _controlChannel;

  String? _deviceId;
  String? _sessionId;
  bool _isPasswordSet = false;
  bool _isHosting = false;       // screen capture is active
  bool _isSignaling = false;     // websocket is connected
  String? _error;
  bool _isConnecting = false;
  bool _isRegistering = false;
  bool _isAccessibilityEnabled = false;
  bool _hasIgnoreBatteryOptimization = false;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  Timer? _heartbeatTimer;

  // Pending viewer ID waiting for screen capture
  String? _pendingViewerId;
  bool _isHandlingJoin = false;
  bool _intentionalDisconnect = false;

  String? get sessionId => _sessionId;
  bool get isPasswordSet => _isPasswordSet;
  bool get isHosting => _isHosting;
  bool get isSignaling => _isSignaling;
  String? get error => _error;
  bool get isRegistering => _isRegistering;
  bool get isAccessibilityEnabled => _isAccessibilityEnabled;
  bool get hasIgnoreBatteryOptimization => _hasIgnoreBatteryOptimization;

  HostProvider(this._authProvider) {
    WidgetsBinding.instance.addObserver(this);
    _setupMethodChannel();
  }

  void _setupMethodChannel() {
    _methodChannel.setMethodCallHandler((call) async {
      print('[Host] Native call: ${call.method}');
      if (call.method == 'onInputFocusChanged') {
        final bool isFocused = call.arguments as bool;
        _sendFocusToViewer(isFocused);
      }
    });
  }

  void _sendFocusToViewer(bool isFocused) {
    if (_controlChannel != null && _controlChannel!.state == RTCDataChannelState.RTCDataChannelOpen) {
      debugPrint('[Host] Sending keyboard focus event: $isFocused');
      _controlChannel!.send(RTCDataChannelMessage(json.encode({
        'type': 'keyboard_event',
        'visible': isFocused,
      })));
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      checkAccessibilityStatus();
      checkBatteryOptimization();
    }
  }

  void updateAuth(AuthProvider auth) {
    _authProvider = auth;
    if (_authProvider.isAuthenticated) {
      ensureHosting();
    } else {
      // Clear host state on logout to prevent ID mismatch on next login
      _deviceId = null;
      _sessionId = null;
      _isPasswordSet = false;
      _intentionalDisconnect = true;
      disconnect();
    }
  }

  @override
  void notifyListeners() {
    if (_isDisposed) return;
    super.notifyListeners();
  }

  Future<void> registerDevice() async {
    final token = _authProvider.accessToken;
    if (token == null) {
      _error = 'User not authenticated. Please log in.';
      notifyListeners();
      return;
    }
    // Try to load cached identity first
    final cachedId = await _storage.read(key: 'host_device_id');
    final cachedKey = await _storage.read(key: 'host_access_key');

    if (cachedId != null && cachedKey != null) {
      _deviceId = cachedId;
      _sessionId = cachedKey;
      
      // Sync PIN status from server for cached device
      try {
        final resp = await _dio.get(
          '/api/devices/mine',
          options: Options(headers: {'Authorization': 'Bearer $token'}),
        );
        if (resp.statusCode == 200) {
          final List mine = resp.data;
          final self = mine.firstWhere((d) => d['id'].toString() == _deviceId, orElse: () => null);
          if (self != null) {
            _isPasswordSet = self['has_password'] ?? false;
            print('[Host] Cached identity verified. PIN Set: $_isPasswordSet');
          }
        }
      } catch (e) {
        print('[Host] Failed to sync cached identity status: $e');
        // We keep the cached ID/Key but isPasswordSet remains false until we can verify or user re-sets.
      }
      
      notifyListeners();
      return;
    }

    try {
      _isRegistering = true;
      _error = null;
      notifyListeners();

      print('--- Registering Device to http://159.65.84.190 ---');
      
      // Get unique device identity
      String deviceName = 'Android Device';
      String? hardwareId;
      try {
        if (Platform.isAndroid) {
          final androidInfo = await _deviceInfo.androidInfo;
          deviceName = '${androidInfo.manufacturer} ${androidInfo.model}';
          hardwareId = androidInfo.id; // Unique hardware ID
        } else if (Platform.isIOS) {
          final iosInfo = await _deviceInfo.iosInfo;
          deviceName = '${iosInfo.name} (${iosInfo.model})';
          hardwareId = iosInfo.identifierForVendor;
        }
      } catch (e) {
        debugPrint('Failed to get device info: $e');
      }

      final response = await _dio.post(
        '/api/devices/register',
        data: {
          'name': deviceName,
          'deviceType': Platform.isAndroid ? 'ANDROID' : 'IOS',
          'hardwareId': hardwareId,
        },
        options: Options(headers: {
          'Authorization': 'Bearer $token',
        }),
      );

      print('Registration Response: ${response.statusCode} - ${response.data}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        _deviceId = response.data['id'].toString();
        _sessionId = response.data['access_key'];
        _isPasswordSet = response.data['has_password'] ?? false;
        
        // Persist identity
        await _storage.write(key: 'host_device_id', value: _deviceId);
        await _storage.write(key: 'host_access_key', value: _sessionId);
        
        notifyListeners();
      }
    } catch (e) {
      print('Registration Error: $e');
      if (e is DioException) {
        _error = 'Network error: ${e.message} (${e.response?.statusCode})';
      } else {
        _error = 'Failed to register device: $e';
      }
      notifyListeners();
    } finally {
      _isRegistering = false;
      notifyListeners();
    }
  }

  Future<void> setHostPassword(String password) async {
    if (_deviceId == null || _authProvider.accessToken == null) {
      await registerDevice();
      if (_deviceId == null) throw Exception('Device registration failed');
    }

    try {
      final response = await _dio.post(
        '/api/devices/set-password',
        data: {
          'deviceId': _deviceId,
          'password': password,
        },
        options: Options(headers: {
          'Authorization': 'Bearer ${_authProvider.accessToken}',
        }),
      );

      if (response.statusCode != 200) {
        throw Exception('Failed to set password');
      }
      
      _isPasswordSet = true;
      notifyListeners();
    } catch (e) {
      _error = 'Failed to set password: $e';
      notifyListeners();
      rethrow;
    }
  }

  Future<void> checkAccessibilityStatus() async {
    try {
      _isAccessibilityEnabled =
          await _methodChannel.invokeMethod('isAccessibilityServiceEnabled') ?? false;
      notifyListeners();
    } catch (e) {
      print('Error checking accessibility: $e');
    }
  }

  Future<void> openAccessibilitySettings() async {
    try {
      await _methodChannel.invokeMethod('openAccessibilitySettings');
    } catch (e) {
      _error = 'Failed to open settings: $e';
      notifyListeners();
    }
  }

  Future<void> openAppSettings() async {
    try {
      await _methodChannel.invokeMethod('openAppSettings');
    } catch (e) {
      _error = 'Failed to open app settings: $e';
      notifyListeners();
    }
  }

  Future<void> checkBatteryOptimization() async {
    try {
      _hasIgnoreBatteryOptimization =
          await _methodChannel.invokeMethod('checkBatteryOptimization') ?? false;
      notifyListeners();
    } catch (e) {
      debugPrint('Error checking battery opt: $e');
    }
  }

  Future<void> requestBatteryOptimizationExemption() async {
    try {
      await _methodChannel.invokeMethod('requestBatteryOptimizationExemption');
    } catch (e) {
      _error = 'Failed to open battery settings: $e';
      notifyListeners();
    }
  }

  // ─── Signaling (always-on) ────────────────────────────────────────────────

  /// Connects the WebSocket and registers this device as a host so it
  /// appears ONLINE to the desktop — without requiring screen capture.
  Future<void> _connectSignaling() async {
    if (_isSignaling || _isConnecting) return;
    _isConnecting = true;
    _intentionalDisconnect = false;

    final token = _authProvider.accessToken;
    if (token == null) {
      _isConnecting = false;
      throw Exception('Not authenticated');
    }

    // Ensure device is registered
    if (_sessionId == null) {
      await registerDevice();
      if (_sessionId == null) {
        _isConnecting = false;
        throw Exception('Failed to register host device');
      }
    }

    try {
      const signalingURL = 'ws://159.65.84.190/api/signal';
      print('[Host] Connecting to signaling: $signalingURL');
      _socket = await WebSocket.connect(signalingURL);

      _socket!.listen(
        (message) => _handleSignalingMessage(json.decode(message)),
        onError: (err) {
          debugPrint('[Host] Signaling error: $err');
          _isSignaling = false;
          _heartbeatTimer?.cancel();
          _heartbeatTimer = null;
          final s = _socket;
          if (s != null) {
            s.close().catchError((_) {});
          }
          _socket = null;
          notifyListeners();
          if (!_intentionalDisconnect) _scheduleReconnect();
        },
        onDone: () {
          debugPrint('[Host] Signaling closed');
          _isSignaling = false;
          _heartbeatTimer?.cancel();
          _heartbeatTimer = null;
          _socket = null;
          notifyListeners();
          if (!_intentionalDisconnect) _scheduleReconnect();
        },
      );

      // Register as host
      _socket!.add(json.encode({
        'type': 'register',
        'token': token,
        'role': 'host',
        'accessKey': _sessionId,
      }));

      _isSignaling = true;
    } finally {
      _isConnecting = false;
      notifyListeners();
    }

    // Start heartbeat to keep Redis presence TTL alive (10s interval, 90s TTL)
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 10), (_) {
      if (_socket != null && _isSignaling) {
        _socket!.add(json.encode({'type': 'heartbeat'}));
      }
    });
  }

  /// Called on app launch — keeps the device visible without touching camera/mic.
  Future<void> ensureHosting() async {
    if (_isSignaling) return;
    try {
      await _methodChannel.invokeMethod('requestNotificationPermission');
      await _methodChannel.invokeMethod('startBackgroundService');
      await checkAccessibilityStatus();
      await checkBatteryOptimization();
      await _connectSignaling();
    } catch (e) {
      debugPrint('[Host] ensureHosting failed: $e');
      _scheduleReconnect();
    }
  }

  // ─── Screen capture (user-initiated) ─────────────────────────────────────

  /// Starts screen capture. Signaling stays alive regardless of outcome.
  Future<void> startHosting() async {
    if (_isHosting) return;

    _error = null;
    notifyListeners();

    try {
      // Make sure signaling is up first
      await _connectSignaling();

      await checkAccessibilityStatus();
      await _methodChannel.invokeMethod('requestNotificationPermission');

      // Android 14+ Security Fix:
      // We start the background service IMMEDIATELY before requesting the 
      // system permission popup. The service MUST be active for the system 
      // to allow the MediaProjection intent.
      print('[Host] Starting background capture service...');
      try {
        await _methodChannel.invokeMethod('startProjectionService');
      } catch (e) {
        print('[Host] Failed to start projection service: $e');
        _error = 'Background service failed to start. Please check permissions.';
        _isHosting = false;
        notifyListeners();
        return;
      }
      
      // Android 14+ requires a very generous delay (1.0s+) for the FGS to be fully 
      // ready before the system allows a MediaProjection intent.
      await Future.delayed(const Duration(milliseconds: 1000));

      final Map<String, dynamic> mediaConstraints = {
        'audio': false,
        'video': {
          'mandatory': {
            'minFrameRate': '30',
            'frameRate': '60',
          },
          'facingMode': 'environment',
          'optional': [],
        }
      };

      try {
        // Adding a small delay for FGS registration on Android 14+
        await Future.delayed(const Duration(milliseconds: 1000));
        _localStream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints);
        print('[Host] Capture active');

        _isHosting = true;
        notifyListeners();

        // If a viewer was waiting for screen capture, serve them now
        final pendingId = _pendingViewerId;
        if (pendingId != null) {
          _pendingViewerId = null;
          _initiateWebRTC(pendingId);
        }
      } catch (e) {
        print('[Host] Screen capture failed: $e');
        if (e.toString().contains('SecurityException')) {
          _error = 'Permission denied. Android requires the "Screen Sharing" notification to be active.';
        } else {
          _error = 'Screen capture failed. Tap "Start Hosting" to try again.';
        }
        _isHosting = false;
        notifyListeners();
      }
    } catch (e) {
      print('[Host] Screen capture failed: $e');
      _isHosting = false;
      notifyListeners();
    }
  }

  /// Stops the WebRTC peer connection when the viewer disconnects, 
  /// but explicitly keeps MediaProjection and _localStream alive.
  void _disconnectViewer() {
    _peerConnection?.dispose();
    _peerConnection = null;
    _pendingViewerId = null;
    notifyListeners();
  }

  /// Stops screen capture entirely. Signaling (device visibility) stays alive.
  void stopHosting() {
    _isHosting = false;

    _methodChannel.invokeMethod('stopProjectionService');

    _localStream?.getTracks().forEach((track) => track.stop());
    _localStream?.dispose();
    _localStream = null;

    _disconnectViewer();
  }

  /// Fully disconnects everything (called on logout / dispose).
  void disconnect() {
    _intentionalDisconnect = true;
    stopHosting();

    _methodChannel.invokeMethod('stopBackgroundService');

    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _reconnectAttempts = 0;

    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;

    _socket?.add(json.encode({'type': 'unregister'}));
    _socket?.close();
    _socket = null;
    _isSignaling = false;

    notifyListeners();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    final delay = Duration(
        seconds: (3 * (1 << _reconnectAttempts.clamp(0, 4))).clamp(3, 60));
    _reconnectAttempts++;
    debugPrint('[Host] Reconnecting signaling in ${delay.inSeconds}s (attempt $_reconnectAttempts)');
    _reconnectTimer = Timer(delay, () async {
      if (!_isSignaling) {
        try {
          await _connectSignaling();
          _reconnectAttempts = 0;
        } catch (_) {
          _scheduleReconnect();
        }
      }
    });
  }

  void _handleSignalingMessage(Map<String, dynamic> data) async {
    debugPrint('[Host] Received signal: ${data['type']}');

    switch (data['type']) {
      case 'ping':
        _socket?.add(json.encode({'type': 'pong'}));
        break;

      case 'registered':
        print('[Host] Successfully registered session: ${data['sessionId']}');
        break;

      case 'viewer-joined':
        final viewerId = data['viewerId'] as String;
        if (_isHandlingJoin) {
          debugPrint('[Host] Busy handling another join, skipping...');
          return;
        }

        _isHandlingJoin = true;
        // SAFETY WATCHDOG: Release lock after 15s if everything hangs
        final joinTimeout = Timer(const Duration(seconds: 15), () {
          if (_isHandlingJoin) {
            debugPrint('[Host] Join watchdog triggered! Releasing lock...');
            _isHandlingJoin = false;
          }
        });

        try {
          if (_localStream != null) {
            // Screen capture already running — connect immediately
            print('[Host] Reusing existing stream for reconnection ✓');
            
            // Force-trigger a frame refresh on the system by doing a 1px nudge
            _methodChannel.invokeMethod('dispatchSwipe', {
              'startX': 0.5,
              'startY': 0.5,
              'endX': 0.505,
              'endY': 0.505,
              'duration': 100,
            });

            await Future.delayed(const Duration(milliseconds: 1000));
            await _initiateWebRTC(viewerId);
          } else {
            // No stream yet — start capture now (user will see Android system prompt)
            print('[Host] Viewer joined but no stream — attempting capture for $viewerId');
            _pendingViewerId = viewerId;
            await startHosting();
          }
        } finally {
          _isHandlingJoin = false;
          joinTimeout.cancel();
        }
        break;
      case 'viewer-left':
        print('[Host] Viewer disconnected. Cleaning up WebRTC...');
        _disconnectViewer();
        break;

      case 'answer':
        final pc = _peerConnection;
        if (pc != null) {
          await pc.setRemoteDescription(
            RTCSessionDescription(data['sdp'], 'answer'),
          );
        }
        break;

      case 'ice-candidate':
        final dynamic rawCandidate = data['candidate'];
        if (_peerConnection != null && rawCandidate != null) {
          String candidateStr = '';
          String sdpMid = '';
          int sdpMLineIndex = 0;

          if (rawCandidate is Map) {
            candidateStr = rawCandidate['candidate']?.toString() ?? '';
            sdpMid = rawCandidate['sdpMid']?.toString() ?? '';
            sdpMLineIndex = (rawCandidate['sdpMLineIndex'] is int)
                ? rawCandidate['sdpMLineIndex']
                : int.tryParse(rawCandidate['sdpMLineIndex']?.toString() ?? '0') ?? 0;
          } else {
            candidateStr = rawCandidate.toString();
            sdpMid = data['sdpMid']?.toString() ?? '';
            final dynamic rawIndex = data['sdpMLineIndex'] ?? 0;
            sdpMLineIndex = (rawIndex is int) ? rawIndex : int.tryParse(rawIndex.toString()) ?? 0;
          }

          if (candidateStr.isNotEmpty) {
            await _peerConnection!.addCandidate(
              RTCIceCandidate(candidateStr, sdpMid, sdpMLineIndex),
            );
          }
        }
        break;
    }
  }

  Future<void> _initiateWebRTC(String viewerId) async {
    print('[Host] Initiating WebRTC for viewer: $viewerId');
    try {
      if (_peerConnection != null) {
        await _peerConnection!.dispose();
        _peerConnection = null;
      }

      final configuration = {
        'iceServers': [
          {'urls': 'stun:stun.l.google.com:19302'},
          {'urls': 'stun:stun1.l.google.com:19302'},
          {'urls': 'stun:stun2.l.google.com:19302'},
          {'urls': 'stun:stun3.l.google.com:19302'},
        ],
        'sdpSemantics': 'unified-plan',
        'iceCandidatePoolSize': 10,
      };

      _peerConnection = await createPeerConnection(configuration);

      _peerConnection!.onIceCandidate = (candidate) {
        _socket?.add(json.encode({
          'type': 'ice-candidate',
          'candidate': candidate.candidate,
          'sdpMid': candidate.sdpMid,
          'sdpMLineIndex': candidate.sdpMLineIndex ?? 0,
          'targetId': viewerId,
        }));
      };

      // Create control DataChannel
      _controlChannel = await _peerConnection!
          .createDataChannel('control', RTCDataChannelInit());
      _controlChannel!.onMessage = (data) {
        if (data.text.contains('"request-keyframe"')) {
          _forceKeyframe();
        } else {
          _handleRemoteInput(data.text);
        }
      };

      // Add screen tracks
      if (_localStream != null) {
        for (var track in _localStream!.getTracks()) {
          _peerConnection!.addTrack(track, _localStream!);
        }
      }

      final offer = await _peerConnection!.createOffer();
      // Fix: Munge SDP to prefer VP8. This resolves the 'pink/purple tint' 
      // common with H264 hardware encoders on some Android devices.
      final mungedSdp = _mungeSdpPreferCodec(offer.sdp ?? '', 'VP8');
      final mungedOffer = RTCSessionDescription(mungedSdp, offer.type);
      
      await _peerConnection!.setLocalDescription(mungedOffer);

       _socket?.add(json.encode({
         'type': 'offer',
         'sdp': mungedOffer.sdp,
         'hostType': 'android',
         'targetId': viewerId,
       }));

       // Force a "Nudge Storm" immediately upon connection to clear any black screen
       // 3 small nudges ensure the encoder wakes up even if the first is missed.
       for (int i = 0; i < 3; i++) {
         Timer(Duration(milliseconds: 500 + (i * 800)), () {
           print('[Host] ICE Connected. Nudge Storm ${i + 1}/3...');
           _forceKeyframe(intensity: 0.505 + (i * 0.001));
         });
       }
       debugPrint('[Host] WebRTC stage: complete ✓');
     } catch (e) {
       debugPrint('[Host] WebRTC initialization failed: $e');
     }
   }

  void _handleRemoteInput(String message) {
    try {
      final Map<String, dynamic> data = json.decode(message);
      final String? type = data['type'];

      if (type == 'action') {
        final String? action = data['action'];
        _methodChannel.invokeMethod('performAction', {'action': action});
        return;
      }

      if (type == 'globalAction') {
        final int? action = data['action'];
        if (action != null) {
          _methodChannel.invokeMethod('performGlobalAction', {'action': action});
        }
        return;
      }

      if (type == 'wheel') {
        final double deltaY = (data['deltaY'] as num).toDouble();
        // Positive deltaY (scroll down) = swipe UP.
        final double startX = 0.5;
        final double endX = 0.5;
        final double startY = 0.5;
        final double endY = deltaY > 0 ? 0.3 : 0.7;
        
        _methodChannel.invokeMethod('dispatchSwipe', {
          'startX': startX,
          'startY': startY,
          'endX': endX,
          'endY': endY,
          'duration': 150,
        });
        return;
      }

      final String inputType = data['type'] ?? '';
      print('[Host] Received Control: $inputType');

      if (data['x'] == null || data['y'] == null) return;
      final double x = (data['x'] as num).toDouble();
      final double y = (data['y'] as num).toDouble();

      debugPrint('[Host] Input Event: $type at ($x, $y)');

      if (type == 'mousedown') {
        _dragStartX = x;
        _dragStartY = y;
        _dragStartTime = DateTime.now();
      } else if (type == 'mousemove') {
        // Optional: Implement real-time drag if needed, but current Swipe on mouseup is standard
      } else if (type == 'mouseup') {
        if (_dragStartX != null && _dragStartTime != null) {
          final duration = DateTime.now().difference(_dragStartTime!).inMilliseconds;
          final dx = (x - _dragStartX!).abs();
          final dy = (y - _dragStartY!).abs();

          // REDUCED THRESHOLD: 2% of screen is now a swipe (Ideal for scrolling lists)
          if (dx > 0.02 || dy > 0.02) {
            print('[Host] Dispatching Swipe: ($_dragStartX, $_dragStartY) -> ($x, $y) [Duration: ${duration}ms]');
            _methodChannel.invokeMethod('dispatchSwipe', {
              'startX': _dragStartX,
              'startY': _dragStartY,
              'endX': x,
              'endY': y,
              'duration': duration.clamp(150, 1000).toInt(),
            });
          } else {
            // It's a Tap
            print('[Host] Dispatching Tap at ($x, $y)');
            _methodChannel.invokeMethod('dispatchClick', {
              'x': x,
              'y': y,
              'duration': duration.clamp(20, 200).toInt(),
            });
          }
        }
        _dragStartX = null;
        _dragStartTime = null;
      }
    } catch (e) {
      print('[Host] Control handling error: $e');
    }
  }

  double? _dragStartX, _dragStartY;
  DateTime? _dragStartTime;

  void _forceKeyframe({double intensity = 0.505}) {
    // The Track Toggle hack caused video corruption in React Native.
    // We now rely on a microscopic nudge via MethodChannel to trigger an encoder refresh safely.
    print('[Host] Force-triggering IDR keyframe via system nudge ($intensity)...');
    try {
      _methodChannel.invokeMethod('dispatchSwipe', {
        'startX': 0.5,
        'startY': 0.5,
        'endX': intensity,
        'endY': intensity,
        'duration': 50, // Faster nudge for better encoder wake-up
      });
    } catch (e) {
      debugPrint('[Host] Micro-nudge failed: $e');
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _isDisposed = true;
    disconnect();
    super.dispose();
  }

  String _mungeSdpPreferCodec(String sdp, String codec) {
    // Robust splitting: Handles both \r\n and \n
    final isCRLF = sdp.contains('\r\n');
    List<String> lines = sdp.split(RegExp(r'\r?\n'));
    
    int videoIdx = lines.indexWhere((l) => l.startsWith('m=video'));
    if (videoIdx == -1) {
      debugPrint('[Host-SDP] No video section found in SDP');
      return sdp;
    }

    // Identify payload types for VP8
    String? preferredPt;

    for (var line in lines) {
      if (line.startsWith('a=rtpmap:')) {
        final parts = line.split(':');
        if (parts.length > 1) {
          final ptAndCodec = parts[1].split(' ');
          if (ptAndCodec.length > 1) {
            final pt = ptAndCodec[0];
            final name = ptAndCodec[1].toUpperCase();
            if (name.contains(codec.toUpperCase())) {
              preferredPt = pt;
              break;
            }
          }
        }
      }
    }

    if (preferredPt != null) {
      debugPrint('[Host-SDP] Prioritizing $codec (PT: $preferredPt) for natural colors.');
      
      List<String> mLineElements = lines[videoIdx].split(' ');
      List<String> currentPayloadTypes = mLineElements.sublist(3);
      
      // Safe Reorder: Just move the preferred codec to the front. 
      // Do NOT remove others, to maintain fallback compatibility.
      if (currentPayloadTypes.contains(preferredPt)) {
        currentPayloadTypes.remove(preferredPt);
        currentPayloadTypes.insert(0, preferredPt);
        
        mLineElements = mLineElements.sublist(0, 3)..addAll(currentPayloadTypes);
        lines[videoIdx] = mLineElements.join(' ');
        
        // Find existing fmtp line for this payload type or add one to enforce high bitrate
        int fmtpIdx = lines.indexWhere((l) => l.startsWith('a=fmtp:$preferredPt '));
        if (fmtpIdx != -1) {
          lines[fmtpIdx] = '${lines[fmtpIdx]};x-google-min-bitrate=5000;x-google-max-bitrate=10000';
        } else {
          lines.insert(videoIdx + 1, 'a=fmtp:$preferredPt x-google-min-bitrate=5000;x-google-max-bitrate=10000');
        }
        
        debugPrint('[Host-SDP] Optimized configuration: ${lines[videoIdx]}');
      }
    }

    // Overwrite the global Application Specific (AS) bandwidth limit to 10 Mbps
    lines.insert(videoIdx + 1, 'b=AS:10000');

    return lines.join(isCRLF ? '\r\n' : '\n');
  }
}
