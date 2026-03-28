import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthProvider extends ChangeNotifier {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'http://192.168.2.2:3001', // Local IP for physical device
    connectTimeout: const Duration(seconds: 5),
    receiveTimeout: const Duration(seconds: 3),
  ));
  
  final _storage = const FlutterSecureStorage();
  
  String? _accessToken;
  Map<String, dynamic>? _user;
  bool _isLoading = false;

  String? get accessToken => _accessToken;
  Map<String, dynamic>? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _accessToken != null;

  AuthProvider() {
    _initialize();
  }

  Future<void> _initialize() async {
    _isLoading = true;
    notifyListeners();
    
    _accessToken = await _storage.read(key: 'accessToken');
    final userJson = await _storage.read(key: 'user');
    if (userJson != null) {
      _user = json.decode(userJson);
    }
    
    _isLoading = false;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    try {
      _isLoading = true;
      notifyListeners();

      final response = await _dio.post('/api/auth/login', data: {
        'email': email,
        'password': password,
      });

      if (response.statusCode == 200) {
        _accessToken = response.data['accessToken'];
        _user = response.data['user'];
        
        await _storage.write(key: 'accessToken', value: _accessToken);
        await _storage.write(key: 'user', value: json.encode(_user));
        
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('Login error: $e');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _accessToken = null;
    _user = null;
    await _storage.deleteAll();
    notifyListeners();
  }
}
