import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'auth_provider.dart';
import '../models/device_model.dart';

class DeviceProvider extends ChangeNotifier {
  AuthProvider _authProvider;
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'http://159.65.84.190',
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 3),
  ));

  WebSocketChannel? _socket;
  List<DeviceModel> _devices = [];
  bool _isLoading = false;

  List<DeviceModel> get devices => _devices;
  bool get isLoading => _isLoading;

  DeviceProvider(this._authProvider) {
    if (_authProvider.isAuthenticated) {
      fetchDevices();
    }
  }

  bool _isDisposed = false;

  void updateAuth(AuthProvider auth) {
    _authProvider = auth;
    if (_authProvider.isAuthenticated) {
      fetchDevices();
    }
  }

  @override
  void notifyListeners() {
    if (_isDisposed) return;
    super.notifyListeners();
  }

  Future<void> fetchDevices() async {
    if (!_authProvider.isAuthenticated) return;

    try {
      _isLoading = true;
      notifyListeners();

      final response = await _dio.get(
        '/api/devices/mine',
        options: Options(headers: {
          'Authorization': 'Bearer ${_authProvider.accessToken}',
        }),
      );

      if (response.statusCode == 200) {
        _devices = (response.data as List).map((d) => DeviceModel.fromJson(d)).toList();
        _subscribeToPresence();
      }
    } catch (e) {
      debugPrint('Fetch devices error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  bool _isConnecting = false;
  bool _isManuallyClosing = false;
  Timer? _retryTimer;

  void _subscribeToPresence() async {
    if (_isConnecting) return;
    _isConnecting = true; // Set synchronously to block parallel calls
    
    _retryTimer?.cancel();
    _isManuallyClosing = true;
    await _socket?.sink.close();
    _isManuallyClosing = false;
    
    final keys = _devices.map((d) => d.accessKey).toList();
    if (keys.isEmpty) {
      _isConnecting = false;
      return;
    }

    try {
      final wsUrl = 'ws://159.65.84.190/api/signal';
      debugPrint('[DeviceProvider] Connecting to presence: $wsUrl');
      _socket = WebSocketChannel.connect(Uri.parse(wsUrl));

      _socket!.sink.add(json.encode({
        'type': 'subscribe-presence',
        'accessKeys': keys,
      }));

      _socket!.stream.listen(
        (message) {
          try {
            final data = json.decode(message);
            if (data['type'] == 'presence-update') {
              final sessionId = data['sessionId'];
              final status = data['status'];
              
              final index = _devices.indexWhere((d) => d.accessKey == sessionId);
              if (index != -1) {
                final old = _devices[index];
                _devices[index] = DeviceModel(
                  id: old.id,
                  name: old.name,
                  accessKey: old.accessKey,
                  osType: old.osType,
                  isOnline: status == 'online',
                  lastSeen: old.lastSeen,
                );
                notifyListeners();
              }
            } else if (data['type'] == 'ping') {
              _socket?.sink.add(json.encode({'type': 'pong'}));
            }
          } catch (e) {
            debugPrint('[DeviceProvider] Message error: $e');
          }
        },
        onDone: () {
          _isConnecting = false;
          if (!_isManuallyClosing) {
            debugPrint('[DeviceProvider] Connection lost. Retrying in 5s...');
            _retryTimer = Timer(const Duration(seconds: 5), _subscribeToPresence);
          }
        },
        onError: (err) {
          _isConnecting = false;
          debugPrint('[DeviceProvider] Connection error: $err');
        },
      );
    } catch (e) {
      _isConnecting = false;
      debugPrint('[DeviceProvider] Sync failed: $e');
      _retryTimer = Timer(const Duration(seconds: 5), _subscribeToPresence);
    }
  }

  @override
  void dispose() {
    _isDisposed = true;
    _retryTimer?.cancel();
    _socket?.sink.close();
    super.dispose();
  }
}
