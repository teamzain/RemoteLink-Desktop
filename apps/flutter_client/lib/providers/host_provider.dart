import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:device_info_plus/device_info_plus.dart';
import 'auth_provider.dart';

class HostProvider extends ChangeNotifier {
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
  bool _isHosting = false;       // screen capture is active
  bool _isSignaling = false;     // websocket is connected
  String? _error;
  bool _isRegistering = false;
  bool _isAccessibilityEnabled = false;
  Timer? _reconnectTimer;
  int _reconnectAttempts = 0;
  Timer? _heartbeatTimer;

  // Pending viewer ID waiting for screen capture
  String? _pendingViewerId;

  String? get sessionId => _sessionId;
  bool get isHosting => _isHosting;
  bool get isSignaling => _isSignaling;
  String? get error => _error;
  bool get isRegistering => _isRegistering;
  bool get isAccessibilityEnabled => _isAccessibilityEnabled;

  HostProvider(this._authProvider);

  void updateAuth(AuthProvider auth) {
    _authProvider = auth;
    if (_authProvider.isAuthenticated) {
      ensureHosting();
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

  // ─── Signaling (always-on) ────────────────────────────────────────────────

  /// Connects the WebSocket and registers this device as a host so it
  /// appears ONLINE to the desktop — without requiring screen capture.
  Future<void> _connectSignaling() async {
    if (_isSignaling) return;

    final token = _authProvider.accessToken;
    if (token == null) throw Exception('Not authenticated');

    // Ensure device is registered
    if (_sessionId == null) {
      await registerDevice();
      if (_sessionId == null) throw Exception('Failed to register host device');
    }

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
        notifyListeners();
        _scheduleReconnect();
      },
      onDone: () {
        debugPrint('[Host] Signaling closed');
        _isSignaling = false;
        _heartbeatTimer?.cancel();
        _heartbeatTimer = null;
        notifyListeners();
        _scheduleReconnect();
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
    notifyListeners();

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
      await _methodChannel.invokeMethod('startProjectionService');
      
      // Short delay to ensure the system recognizes the FGS is up
      await Future.delayed(const Duration(milliseconds: 200));

      final Map<String, dynamic> mediaConstraints = {
        'audio': false,
        'video': {
          'mandatory': {
            'minWidth': '1280',
            'minHeight': '720',
            'minFrameRate': '20',
          },
          'facingMode': 'user',
          'optional': [],
        }
      };

      print('[Host] Requesting permission popup...');
      _localStream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints);
      print('[Host] Capture active');

      _isHosting = true;
      notifyListeners();

      // If a viewer was waiting for screen capture, serve them now
      if (_pendingViewerId != null) {
        final id = _pendingViewerId!;
        _pendingViewerId = null;
        _initiateWebRTC(id);
      }
    } catch (e) {
      print('[Host] Screen capture failed: $e');
      _error = 'Screen capture failed. Tap "Start Hosting" to try again.';
      _isHosting = false;
      // ← Intentionally NOT calling stopHosting() — signaling stays alive
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
    stopHosting();

    _methodChannel.invokeMethod('stopBackgroundService');

    _reconnectTimer?.cancel();
    _reconnectTimer = null;
    _reconnectAttempts = 0;

    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;

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
        if (_localStream != null) {
          // Screen capture already running — connect immediately
          _initiateWebRTC(viewerId);
        } else {
          // No stream yet — start capture now (user will see Android system prompt)
          print('[Host] Viewer joined but no stream — attempting capture for $viewerId');
          _pendingViewerId = viewerId;
          try {
            await startHosting();
          } catch (_) {
            _pendingViewerId = null;
          }
        }
        break;
      case 'viewer-left':
        print('[Host] Viewer disconnected. Cleaning up WebRTC...');
        _disconnectViewer();
        break;

      case 'answer':
        if (_peerConnection != null) {
          await _peerConnection!.setRemoteDescription(
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
      await _peerConnection!.setLocalDescription(offer);

      _socket?.add(json.encode({
        'type': 'offer',
        'sdp': offer.sdp,
        'hostType': 'android',
        'targetId': viewerId,
      }));
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

      if (data['x'] == null || data['y'] == null) return;
      final double x = (data['x'] as num).toDouble();
      final double y = (data['y'] as num).toDouble();

      if (type == 'mousedown') {
        _dragStartX = x;
        _dragStartY = y;
        _dragStartTime = DateTime.now();
      } else if (type == 'mouseup') {
        if (_dragStartX != null && _dragStartTime != null) {
          final duration =
              DateTime.now().difference(_dragStartTime!).inMilliseconds;
          final dx = (x - _dragStartX!).abs();
          final dy = (y - _dragStartY!).abs();

          if (dx > 0.02 || dy > 0.02) {
            // It's a swipe
            _methodChannel.invokeMethod('dispatchSwipe', {
              'startX': _dragStartX,
              'startY': _dragStartY,
              'endX': x,
              'endY': y,
              'duration': duration.clamp(200, 1000),
            });
          } else if (duration > 600) {
            // It's a long press
            _methodChannel.invokeMethod('dispatchClick', {
              'x': _dragStartX,
              'y': _dragStartY,
              'duration': 1000, // 1 second hold
            });
          } else {
            // It's a normal tap (fast)
            _methodChannel.invokeMethod('dispatchClick', {
              'x': _dragStartX,
              'y': _dragStartY,
              'duration': 50, // very short burst
            });
          }
        }
        _dragStartX = null;
        _dragStartTime = null;
      }
    } catch (e) {}
  }

  double? _dragStartX, _dragStartY;
  DateTime? _dragStartTime;

  void _forceKeyframe() {
    // Toggling enabled briefly forces the encoder to emit a fresh IDR frame.
    // We keep the off-window to 1 frame (16ms at 60fps) to minimize visible glitch.
    if (_localStream != null) {
      for (final track in _localStream!.getVideoTracks()) {
        track.enabled = false;
        Timer(const Duration(milliseconds: 16), () => track.enabled = true);
      }
    }
  }

  @override
  void dispose() {
    _isDisposed = true;
    disconnect();
    super.dispose();
  }
}
