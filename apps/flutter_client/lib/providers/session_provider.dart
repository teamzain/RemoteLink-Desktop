import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'auth_provider.dart';

class SessionProvider extends ChangeNotifier {
  AuthProvider _authProvider;
  
  WebSocket? _socket;
  RTCPeerConnection? _peerConnection;
  MediaStream? _remoteStream;
  RTCDataChannel? _controlChannel;
  
  bool _isConnected = false;
  bool _isConnecting = false;
  bool _isJoined = false;
  String? _error;
  String? _currentSessionId;
  final List<dynamic> _activeSessions = [];
  final List<RTCIceCandidate> _earlyIceCandidates = [];
  bool _isRemoteDescriptionSet = false;
  
  Timer? _offerTimer;
  int _offerRetries = 0;
  
  bool get isConnected => _isConnected;
  bool get isConnecting => _isConnecting;
  String? get error => _error;
  MediaStream? get remoteStream => _remoteStream;
  List<dynamic> get activeSessions => _activeSessions;
  
  SessionProvider(this._authProvider);

  bool _isDisposed = false;

  void updateAuth(AuthProvider auth) {
    _authProvider = auth;
    // No specific auto-connect for sessions needed yet, but we update the token instance
  }

  @override
  void notifyListeners() {
    if (_isDisposed) return;
    super.notifyListeners();
  }

  Future<void> connectToSession(String sessionId) async {
    if (_isConnecting) return;
    
    _isConnecting = true;
    _error = null;
    _currentSessionId = sessionId;
    notifyListeners();

    try {
      final authToken = _authProvider.accessToken;
      if (authToken == null) throw Exception('Not authenticated');

      const serverIP = '159.65.84.190';

      // 1. Exchange user authToken for a short-lived remote-access token
      final httpClient = HttpClient();
      final request = await httpClient.postUrl(Uri.parse('http://$serverIP/api/devices/verify-access'));
      request.headers.add('Authorization', 'Bearer $authToken');
      request.headers.add('Content-Type', 'application/json');
      request.write(json.encode({'accessKey': sessionId}));
      
      final response = await request.close();
      final responseBody = await response.transform(utf8.decoder).join();
      if (response.statusCode != 200) {
        throw Exception('Failed to unlock device: $responseBody');
      }
      
      final remoteTokenData = json.decode(responseBody);
      final remoteAccessToken = remoteTokenData['token'];
      if (remoteAccessToken == null) throw Exception('No remote access token returned');

      // 2. Connect to signaling server
      _socket = await WebSocket.connect('ws://$serverIP/api/signal');
      
      _socket!.listen(
        (message) => _handleSignalingMessage(json.decode(message)),
        onError: (err) {
          _error = 'Signaling error: $err';
          disconnect();
        },
        onDone: () {
          if (_isConnected || _isConnecting) {
            _error = 'Signaling connection closed';
            disconnect();
          }
        },
      );

      // Join session as viewer
      _socket!.add(json.encode({
        'type': 'join',
        'sessionId': sessionId,
        'token': remoteAccessToken,
      }));

    } catch (e) {
      _error = e.toString();
      _isConnecting = false;
      notifyListeners();
      rethrow;
    }
  }

  void disconnect() {
    _isConnected = false;
    _isConnecting = false;
    _isJoined = false;
    _currentSessionId = null;
    _isRemoteDescriptionSet = false;
    _earlyIceCandidates.clear();
    
    _offerTimer?.cancel();
    _offerTimer = null;
    
    notifyListeners();
    
    _socket?.close();
    _socket = null;
    
    _remoteStream?.getTracks().forEach((track) => track.stop());
    _remoteStream?.dispose();
    _remoteStream = null;
    
    _peerConnection?.dispose();
    _peerConnection = null;
    
    _controlChannel?.close();
    _controlChannel = null;
    
    notifyListeners();
  }

  void _handleSignalingMessage(Map<String, dynamic> data) async {
    debugPrint('[Viewer] Received signal: ${data['type']}');
    
    switch (data['type']) {
      case 'joined':
        if (data['success'] == false) {
          _error = data['error'] ?? 'Failed to join session';
          disconnect();
        } else {
          if (_isJoined) return;
          debugPrint('[Viewer] Joined session successfully');
          _isJoined = true;
          _startOfferRequests();
        }
        break;
        
      case 'offer':
        _handleOffer(data['sdp']);
        break;
        
      case 'ice-candidate':
        final dynamic rawCandidate = data['candidate'];
        if (rawCandidate != null) {
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
            final candidate = RTCIceCandidate(candidateStr, sdpMid, sdpMLineIndex);
            if (_peerConnection != null && _isRemoteDescriptionSet) {
              await _peerConnection!.addCandidate(candidate);
            } else {
              _earlyIceCandidates.add(candidate);
            }
          }
        }
        break;
    }
  }

  Future<void> _handleOffer(String sdp) async {
    try {
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
        debugPrint('[Viewer] local ice-candidate: ${candidate.candidate?.substring(0, 30)}...');
        _socket?.add(json.encode({
          'type': 'ice-candidate',
          'candidate': candidate.candidate,
          'sdpMid': candidate.sdpMid,
          'sdpMLineIndex': candidate.sdpMLineIndex,
          'targetId': _currentSessionId,
        }));
      };

      _peerConnection!.onConnectionState = (state) {
        debugPrint('[Viewer] Connection State: $state');
        if (state == RTCPeerConnectionState.RTCPeerConnectionStateConnected) {
          _isConnected = true;
          _isConnecting = false;
          notifyListeners();
        } else if (state == RTCPeerConnectionState.RTCPeerConnectionStateFailed || 
                   state == RTCPeerConnectionState.RTCPeerConnectionStateDisconnected) {
          _error = 'WebRTC connection failed';
          disconnect();
        }
      };

      _peerConnection!.onTrack = (event) async {
        debugPrint('[Viewer] WebRTC: Track received! Type: ${event.track.kind}, ID: ${event.track.id}');
        if (event.track.kind == 'video') {
          if (event.streams.isNotEmpty) {
            _remoteStream = event.streams[0];
            debugPrint('[Viewer] Remote stream updated');
          } else {
            _remoteStream ??= await createLocalMediaStream('remote_stream');
            _remoteStream!.addTrack(event.track);
          }
          notifyListeners();
        }
      };

      _peerConnection!.onDataChannel = (channel) {
        debugPrint('[Viewer] Data channel received: ${channel.label}');
        if (channel.label == 'control') {
          _controlChannel = channel;
          _controlChannel!.onDataChannelState = (state) {
            debugPrint('[Viewer] Control Channel State: $state');
            if (state == RTCDataChannelState.RTCDataChannelOpen) {
               // Request keyframe upon opening
               _controlChannel!.send(RTCDataChannelMessage(json.encode({'type': 'request-keyframe'})));
            }
          };
        }
      };

      await _peerConnection!.setRemoteDescription(RTCSessionDescription(sdp, 'offer'));
      _isRemoteDescriptionSet = true;
      
      for (var c in _earlyIceCandidates) {
        await _peerConnection!.addCandidate(c);
      }
      _earlyIceCandidates.clear();
      
      final answer = await _peerConnection!.createAnswer();
      await _peerConnection!.setLocalDescription(answer);
      
      _socket?.add(json.encode({
        'type': 'answer',
        'sdp': answer.sdp,
        'targetId': _currentSessionId,
      }));
      
    } catch (e) {
      debugPrint('[Viewer] Offer handling failed: $e');
      _error = 'WebRTC handshake failed: $e';
      disconnect();
    }
  }

  void sendInputEvent(Map<String, dynamic> event) {
    if (_controlChannel != null && _controlChannel!.state == RTCDataChannelState.RTCDataChannelOpen) {
      _controlChannel!.send(RTCDataChannelMessage(json.encode(event)));
    }
  }

  @override
  void dispose() {
    _isDisposed = true;
    disconnect();
    super.dispose();
  }
        
  void _startOfferRequests() {
    _offerTimer?.cancel();
    _offerRetries = 0;

    _sendRequestOffer();

    // Retry every 500ms (down from 2s) so we grab the first available host offer quickly.
    // Allow up to 30 retries (15s total window) before giving up.
    _offerTimer = Timer.periodic(const Duration(milliseconds: 500), (timer) {
      if (_isRemoteDescriptionSet || _peerConnection != null) {
        timer.cancel();
        return;
      }

      _offerRetries++;
      debugPrint('[Viewer] retry request-offer ($_offerRetries)...');
      _sendRequestOffer();

      if (_offerRetries > 30) {
        debugPrint('[Viewer] Host not responding after 30 retries. Target offline?');
        _error = 'Host not responding to signal';
        notifyListeners();
        timer.cancel();
      }
    });
  }

  void _sendRequestOffer() {
    if (_socket != null && _currentSessionId != null) {
      _socket!.add(json.encode({
        'type': 'request-offer',
        'targetId': _currentSessionId,
      }));
    }
  }
}
