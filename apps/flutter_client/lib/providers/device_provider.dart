import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'auth_provider.dart';

import '../models/device_model.dart';

class DeviceProvider extends ChangeNotifier {
  final AuthProvider _authProvider;
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'http://192.168.2.2:3001',
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 3),
  ));

  List<DeviceModel> _devices = [];
  bool _isLoading = false;

  List<DeviceModel> get devices => _devices;
  bool get isLoading => _isLoading;

  DeviceProvider(this._authProvider) {
    if (_authProvider.isAuthenticated) {
      fetchDevices();
    }
  }

  Future<void> fetchDevices() async {
    if (!_authProvider.isAuthenticated) return;

    try {
      _isLoading = true;
      notifyListeners();

      final response = await _dio.get(
        '/api/devices',
        options: Options(headers: {
          'Authorization': 'Bearer ${_authProvider.accessToken}',
        }),
      );

      if (response.statusCode == 200) {
        _devices = (response.data as List).map((d) => DeviceModel.fromJson(d)).toList();
      }
    } catch (e) {
      debugPrint('Fetch devices error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
