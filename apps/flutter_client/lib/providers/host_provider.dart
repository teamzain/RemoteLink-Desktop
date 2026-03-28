import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:dio/dio.dart';
import 'auth_provider.dart';

class HostProvider extends ChangeNotifier {
  static const _controlChannelName = 'com.example.remotelink/control';
  final _methodChannel = const MethodChannel(_controlChannelName);

  final AuthProvider _authProvider;
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'http://192.168.2.2:3001',
    connectTimeout: const Duration(seconds: 5),
  ));

  WebSocket? _socket;
  RTCPeerConnection? _peerConnection;
  MediaStream? _localStream;
  RTCDataChannel? _controlChannel;
  
  String? _deviceId;
  String? _sessionId;
  bool _isHosting = false;
  String? _error;
  bool _isRegistering = false;
  bool _isAccessibilityEnabled = false;
  
  String? get sessionId => _sessionId;
  bool get isHosting => _isHosting;
  String? get error => _error;
  bool get isRegistering => _isRegistering;
  bool get isAccessibilityEnabled => _isAccessibilityEnabled;
  
  HostProvider(this._authProvider);

  Future<void> registerDevice() async {
    final token = _authProvider.accessToken;
    if (token == null) {
      _error = 'User not authenticated. Please log in.';
      notifyListeners();
      return;
    }
    
    try {
      _isRegistering = true;
      _error = null;
      notifyListeners();
      
      print('--- Registering Device to http://192.168.2.2:3001 ---');
      final response = await _dio.post(
        '/api/devices/register',
        data: {
          'name': 'Android Device',
          'deviceType': 'ANDROID',
        },
        options: Options(headers: {
          'Authorization': 'Bearer $token',
        }),
      );

      print('Registration Response: ${response.statusCode} - ${response.data}');

      if (response.statusCode == 200 || response.statusCode == 201) {
        _deviceId = response.data['id'].toString();
        _sessionId = response.data['access_key'];
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
      _isAccessibilityEnabled = await _methodChannel.invokeMethod('isAccessibilityServiceEnabled') ?? false;
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

  Future<void> startHosting() async {
    if (_isHosting) return;
    
    _error = null;
    notifyListeners();

    try {
      await checkAccessibilityStatus();
      
      // Request notification permission for Android 13+
      // This is critical for the Foreground Service requirement on Android 14
      await _methodChannel.invokeMethod('requestNotificationPermission');
      
      final token = _authProvider.accessToken;
      if (token == null) throw Exception('Not authenticated');

      // Ensure device is registered to have a consistent sessionId (accessKey)
      if (_sessionId == null) {
        await registerDevice();
        if (_sessionId == null) throw Exception('Failed to register host device');
      }

      // Connect to signaling server
      _socket = await WebSocket.connect('ws://192.168.2.2:3002');
      
      _socket!.listen(
        (message) => _handleSignalingMessage(json.decode(message)),
        onError: (err) {
          _error = 'Signaling error: $err';
          stopHosting();
        },
        onDone: () {
          if (_isHosting) {
            _error = 'Signaling connection closed';
            stopHosting();
          }
        },
      );

      // Register as host with our assigned sessionId
      _socket!.add(json.encode({
        'type': 'register',
        'token': token,
        'role': 'host',
        'accessKey': _sessionId,
      }));

      // Capture screen up front
      final Map<String, dynamic> mediaConstraints = {
        'audio': false,
        'video': {
          'width': 1280,
          'height': 720,
          'frameRate': 20,
        }
      };

      try {
        print('DEBUG: Starting Projection Service...');
        await _methodChannel.invokeMethod('startProjectionService');
        
        await Future.delayed(const Duration(seconds: 2));
        
        print('DEBUG: Calling getDisplayMedia...');
        _localStream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints);
        print('DEBUG: Screen capture successful');
      } catch (e) {
        print('DEBUG: Screen capture failed: $e');
        _error = 'Screen capture failed: $e';
        stopHosting();
        return;
      }

      _isHosting = true;
      notifyListeners();
      
    } catch (e) {
      _error = e.toString();
      _isHosting = false;
      notifyListeners();
      rethrow;
    }
  }

  void stopHosting() {
    _isHosting = false;
    _sessionId = null;
    
    _socket?.close();
    _socket = null;
    
    // Stop the Foreground Service
    _methodChannel.invokeMethod('stopProjectionService');
    
    _localStream?.getTracks().forEach((track) => track.stop());
    _localStream?.dispose();
    _localStream = null;
    
    _peerConnection?.dispose();
    _peerConnection = null;
    
    notifyListeners();
  }

  void _handleSignalingMessage(Map<String, dynamic> data) async {
    debugPrint('[Host] Received signal: ${data['type']}');
    
    switch (data['type']) {
      case 'registered':
        _sessionId = data['sessionId'];
        notifyListeners();
        break;
        
      case 'viewer-joined':
        _initiateWebRTC(data['viewerId']);
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
          
          print('DEBUG: Adding ICE candidate: mid=$sdpMid, index=$sdpMLineIndex');
          
          if (candidateStr.isNotEmpty) {
            await _peerConnection!.addCandidate(
              RTCIceCandidate(candidateStr, sdpMid, sdpMLineIndex),
            );
            print('DEBUG: Candidate added successfully');
          }
        }
        break;
    }
  }

  Future<void> _initiateWebRTC(String viewerId) async {
    print('DEBUG: Initiating WebRTC for viewer: $viewerId');
    try {
      // Clean up previous connection if any
      if (_peerConnection != null) {
        print('DEBUG: Disposing old peer connection');
        await _peerConnection!.dispose();
        _peerConnection = null;
      }
      
      final configuration = {
        'iceServers': [
          {'urls': 'stun:stun.l.google.com:19302'},
        ]
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

      // Create 'control' DataChannel (host is the offerer)
      RTCDataChannelInit dataChannelDict = RTCDataChannelInit();
      dataChannelDict.id = 0;
      dataChannelDict.negotiated = false;
      
      _controlChannel = await _peerConnection!.createDataChannel('control', dataChannelDict);
      _controlChannel!.onDataChannelState = (state) {
        print('DEBUG: Control Channel State: $state');
      };
      _controlChannel!.onMessage = (data) {
        try {
          if (data.text.contains('"request-keyframe"')) {
            print('DEBUG: Received keyframe request. Resetting video track...');
            _forceKeyframe();
          } else {
            _handleRemoteInput(data.text);
          }
        } catch (e) {
          print('DEBUG: DataChannel message error: $e');
        }
      };

      // Support for receiving data channels if needed
      _peerConnection!.onDataChannel = (channel) {
        if (channel.label == 'control') {
          print('DEBUG: Inbound control channel received');
          _controlChannel = channel;
          _controlChannel!.onMessage = (data) {
             if (data.text.contains('"request-keyframe"')) _forceKeyframe();
             else _handleRemoteInput(data.text);
          };
        }
      };

      // Ensure local stream is healthy
      bool streamHealthy = _localStream != null;
      if (streamHealthy) {
        final tracks = _localStream!.getTracks();
        if (tracks.isEmpty || tracks.any((t) => t.enabled == false)) {
          streamHealthy = false;
        }
      }

      if (!streamHealthy && _isHosting) {
        print('DEBUG: Local stream unhealthy or missing. Re-capturing...');
        await _refreshCapture();
      }

      // Use existing or refreshed local stream
      if (_localStream != null) {
        for (var track in _localStream!.getTracks()) {
          _peerConnection!.addTrack(track, _localStream!);
        }
      } else {
        debugPrint('Local stream is null, cannot add tracks');
      }

      // Create offer
      final offer = await _peerConnection!.createOffer();
      await _peerConnection!.setLocalDescription(offer);
      
      _socket?.add(json.encode({
        'type': 'offer',
        'sdp': offer.sdp,
        'hostType': 'android',
        'targetId': viewerId,
      }));
      
    } catch (e) {
      debugPrint('WebRTC initialization failed: $e');
    }
  }

  double? _dragStartX;
  double? _dragStartY;
  DateTime? _dragStartTime;

  void _handleRemoteInput(String message) {
    try {
      final Map<String, dynamic> data = json.decode(message);
      final String? type = data['type'];
      
      if (type == 'action') {
        final String? action = data['action'];
        print('DEBUG: Received remote action: $action');
        if (action == 'volume_up' || action == 'volume_down' || action == 'volume_mute' || action == 'reboot' || action == 'shutdown') {
           _methodChannel.invokeMethod('performAction', {'action': action});
        }
        return;
      }

      if (data['x'] == null || data['y'] == null) return;
      final double x = (data['x'] as num).toDouble();
      final double y = (data['y'] as num).toDouble();

      if (type == 'mousedown') {
        _dragStartX = x;
        _dragStartY = y;
        _dragStartTime = DateTime.now();
      } 
      else if (type == 'mouseup') {
        if (_dragStartX != null && _dragStartY != null && _dragStartTime != null) {
          final duration = DateTime.now().difference(_dragStartTime!).inMilliseconds;
          final dx = (x - _dragStartX!).abs();
          final dy = (y - _dragStartY!).abs();

          // If moved more than 2% of screen or held longer than 300ms, it's a swipe/drag
          if (dx > 0.02 || dy > 0.02 || duration > 300) {
            _methodChannel.invokeMethod('dispatchSwipe', {
              'startX': _dragStartX,
              'startY': _dragStartY,
              'endX': x,
              'endY': y,
              'duration': duration.clamp(200, 1000),
            });
          } else {
            // It's a simple click
            _methodChannel.invokeMethod('dispatchClick', {
              'x': _dragStartX,
              'y': _dragStartY,
            });
          }
        }
        _dragStartX = null;
        _dragStartY = null;
        _dragStartTime = null;
      }
    } catch (e) {
      debugPrint('[Host] Remote Input Error: $e');
    }
  }

  Future<void> _refreshCapture() async {
    print('DEBUG: Refreshing screen capture...');
    _localStream?.getTracks().forEach((track) => track.stop());
    _localStream?.dispose();
    
    final Map<String, dynamic> mediaConstraints = {
      'audio': false,
      'video': {
        'width': 1280,
        'height': 720,
        'frameRate': 20,
      }
    };
    
    try {
      _localStream = await navigator.mediaDevices.getDisplayMedia(mediaConstraints);
      print('DEBUG: Screen re-capture successful');
    } catch (e) {
      print('DEBUG: Screen re-capture failed: $e');
    }
  }

  void _forceKeyframe() {
    if (_localStream != null) {
      for (var track in _localStream!.getVideoTracks()) {
        if (track.enabled) {
          track.enabled = false;
          Timer(const Duration(milliseconds: 50), () {
            track.enabled = true;
            print('DEBUG: Video track re-enabled to force keyframe');
          });
        }
      }
    }
  }

  @override
  void dispose() {
    stopHosting();
    super.dispose();
  }
}
