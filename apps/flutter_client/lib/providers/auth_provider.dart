import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class AuthProvider extends ChangeNotifier {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'http://159.65.84.190', // Production IP (via Caddy on port 80)
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

  String? _refreshToken;
  String? get refreshToken => _refreshToken;

  Future<void> _initialize() async {
    _isLoading = true;
    notifyListeners();

    _accessToken  = await _storage.read(key: 'accessToken');
    _refreshToken = await _storage.read(key: 'refreshToken');
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
        _accessToken  = response.data['accessToken'];
        _refreshToken = response.data['refreshToken'];
        _user         = response.data['user'];

        await _storage.write(key: 'accessToken',  value: _accessToken);
        await _storage.write(key: 'refreshToken', value: _refreshToken);
        await _storage.write(key: 'user',         value: json.encode(_user));

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

  Future<bool> loginWithTokens(String token, {String? refreshToken}) async {
    try {
      _isLoading = true;
      notifyListeners();

      final response = await _dio.get(
        '/api/auth/me',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode == 200) {
        _accessToken  = token;
        _refreshToken = refreshToken;
        _user         = response.data;

        await _storage.write(key: 'accessToken', value: _accessToken);
        if (refreshToken != null) {
          await _storage.write(key: 'refreshToken', value: refreshToken);
        }
        await _storage.write(key: 'user', value: json.encode(_user));

        return true;
      }
      return false;
    } catch (e) {
      debugPrint('loginWithTokens error: $e');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> updateUser(String name, String email) async {
    try {
      _isLoading = true;
      notifyListeners();

      if (_user != null) {
        _user!['name'] = name;
        _user!['email'] = email;
        await _storage.write(key: 'user', value: json.encode(_user));
        return true;
      }
      return false;
    } catch (e) {
      debugPrint('updateUser error: $e');
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _accessToken  = null;
    _refreshToken = null;
    _user         = null;
    await _storage.deleteAll();
    notifyListeners();
  }
}
