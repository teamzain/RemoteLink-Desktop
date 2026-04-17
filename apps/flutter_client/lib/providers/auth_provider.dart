import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';

class AuthProvider extends ChangeNotifier {
  final Dio _dio = Dio(BaseOptions(
    baseUrl: 'http://159.65.84.190',
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));

  final _storage = const FlutterSecureStorage();

  // NOTE: Replace with your actual Google OAuth Web Client ID from Google Cloud Console.
  // Android also requires google-services.json in android/app/ and SHA-1 fingerprint configured.
  final _googleSignIn = GoogleSignIn(
    scopes: ['email', 'profile'],
  );

  String? _accessToken;
  String? _refreshToken;
  Map<String, dynamic>? _user;
  bool _isLoading = false;
  String? _error;

  String? get accessToken => _accessToken;
  String? get refreshToken => _refreshToken;
  Map<String, dynamic>? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _accessToken != null;
  String? get error => _error;

  AuthProvider() {
    _initialize();
  }

  Future<void> _initialize() async {
    _isLoading = true;
    notifyListeners();

    _accessToken = await _storage.read(key: 'accessToken');
    _refreshToken = await _storage.read(key: 'refreshToken');
    final userJson = await _storage.read(key: 'user');
    if (userJson != null) {
      _user = json.decode(userJson);
    }

    _isLoading = false;
    notifyListeners();
  }

  void clearError() {
    _error = null;
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      final response = await _dio.post('/api/auth/login', data: {
        'email': email,
        'password': password,
      });

      if (response.statusCode == 200) {
        await _saveSession(response.data);
        return true;
      }
      return false;
    } on DioException catch (e) {
      _error = e.response?.data?['error'] ?? 'Login failed. Please try again.';
      return false;
    } catch (e) {
      _error = 'Login failed. Please try again.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> requestVerification(String email) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      await _dio.post('/api/auth/request-verification', data: {'email': email});
      return true;
    } on DioException catch (e) {
      _error = e.response?.data?['error'] ?? 'Failed to send verification code.';
      return false;
    } catch (e) {
      _error = 'Failed to send verification code.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> register(
    String email,
    String password,
    String verificationCode, {
    String? name,
  }) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      final response = await _dio.post('/api/auth/register', data: {
        'email': email,
        'password': password,
        'verificationCode': verificationCode,
        if (name != null && name.isNotEmpty) 'name': name,
      });

      if (response.statusCode == 200) {
        await _saveSession(response.data);
        return true;
      }
      return false;
    } on DioException catch (e) {
      _error = e.response?.data?['error'] ?? 'Registration failed. Please try again.';
      return false;
    } catch (e) {
      _error = 'Registration failed. Please try again.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> signInWithGoogle() async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      final account = await _googleSignIn.signIn();
      if (account == null) {
        // User cancelled
        _isLoading = false;
        notifyListeners();
        return false;
      }

      final auth = await account.authentication;
      final idToken = auth.idToken;
      if (idToken == null) {
        _error = 'Failed to get Google credentials.';
        return false;
      }

      final response = await _dio.post('/api/auth/google', data: {'idToken': idToken});

      if (response.statusCode == 200) {
        await _saveSession(response.data);
        return true;
      }
      return false;
    } on DioException catch (e) {
      _error = e.response?.data?['error'] ?? 'Google sign-in failed. Please try again.';
      return false;
    } catch (e) {
      _error = 'Google sign-in failed. Please try again.';
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> loginWithTokens(String token, {String? refreshToken}) async {
    try {
      _isLoading = true;
      _error = null;
      notifyListeners();

      final response = await _dio.get(
        '/api/auth/me',
        options: Options(headers: {'Authorization': 'Bearer $token'}),
      );

      if (response.statusCode == 200) {
        _accessToken = token;
        _refreshToken = refreshToken;
        _user = response.data;

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
      return false;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> logout() async {
    _accessToken = null;
    _refreshToken = null;
    _user = null;
    _error = null;
    try {
      await _googleSignIn.signOut();
    } catch (_) {}
    await _storage.deleteAll();
    notifyListeners();
  }

  Future<void> _saveSession(Map<String, dynamic> data) async {
    _accessToken = data['accessToken'];
    _refreshToken = data['refreshToken'];
    _user = data['user'];

    await _storage.write(key: 'accessToken', value: _accessToken);
    await _storage.write(key: 'refreshToken', value: _refreshToken);
    await _storage.write(key: 'user', value: json.encode(_user));
  }
}
