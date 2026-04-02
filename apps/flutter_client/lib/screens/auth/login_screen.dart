import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:app_links/app_links.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:async';
import '../../providers/auth_provider.dart';
import '../../core/theme.dart';
import '../../widgets/snow_widgets.dart';
import '../../widgets/snow_navigation.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _isPasswordVisible = false;

  late AppLinks _appLinks;
  StreamSubscription<Uri>? _linkSubscription;

  @override
  void initState() {
    super.initState();
    _initAppLinks();
  }

  Future<void> _initAppLinks() async {
    _appLinks = AppLinks();
    _linkSubscription = _appLinks.uriLinkStream.listen((uri) {
      _handleDeepLink(uri);
    });
  }

  void _handleDeepLink(Uri uri) async {
    if (uri.scheme == 'remotelink' && uri.host == 'auth' && uri.path == '/callback') {
      final accessToken  = uri.queryParameters['accessToken'];
      final refreshToken = uri.queryParameters['refreshToken'];
      if (accessToken != null) {
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        final success = await authProvider.loginWithTokens(
          accessToken,
          refreshToken: refreshToken,
        );
        if (!success && mounted) {
          _showError('Google Authentication failed');
        }
      }
    }
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: AppTheme.background,
      body: Stack(
        children: [
          // Premium Ambient Glows
          Positioned(
            top: -100,
            left: -50,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.accent.withOpacity(0.08),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -50,
            right: -50,
            child: Container(
              width: 250,
              height: 250,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(
                  colors: [
                    AppTheme.accent.withOpacity(0.04),
                    Colors.transparent,
                  ],
                ),
              ),
            ),
          ),
          SafeArea(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 32),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    const SizedBox(height: 60),

                    // Brand Logo with Glow
                    Center(
                      child: Container(
                        width: 84,
                        height: 84,
                        decoration: BoxDecoration(
                          color: AppTheme.accent,
                          borderRadius: BorderRadius.circular(26),
                          boxShadow: [
                            BoxShadow(
                              color: AppTheme.accent.withOpacity(0.2),
                              blurRadius: 30,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: const Center(
                          child: Icon(LucideIcons.zap, color: Colors.white, size: 40),
                        ),
                      ),
                    ),

                    const SizedBox(height: 28),

                    const Text(
                      'RemoteLink',
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                        color: AppTheme.textPrimary,
                        letterSpacing: -1.5,
                      ),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'SECURE P2P ACCESS',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.textMuted,
                        letterSpacing: 3,
                      ),
                    ),

                    const SizedBox(height: 56),

                    // Inputs Section
                    SnowInput(
                      label: 'Identity / Email',
                      hint: 'Enter your account email',
                      controller: _emailController,
                      suffixIcon: const Icon(LucideIcons.user, size: 16, color: AppTheme.textMuted),
                    ),

                    const SizedBox(height: 20),

                    SnowInput(
                      label: 'Secret / Password',
                      hint: 'Enter your password',
                      controller: _passwordController,
                      isPassword: !_isPasswordVisible,
                      suffixIcon: IconButton(
                        icon: Icon(
                          _isPasswordVisible ? LucideIcons.eye : LucideIcons.eyeOff,
                          size: 16,
                          color: AppTheme.textMuted,
                        ),
                        onPressed: () => setState(() => _isPasswordVisible = !_isPasswordVisible),
                      ),
                    ),

                    const SizedBox(height: 12),

                    Align(
                      alignment: Alignment.centerRight,
                      child: TextButton(
                        onPressed: () {},
                        child: Text(
                          'Recovery Access?',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppTheme.accent.withOpacity(0.8),
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 32),

                    SnowButton(
                      label: 'Establish Session',
                      isLoading: authProvider.isLoading,
                      onPressed: () async {
                        if (_emailController.text.isEmpty || _passwordController.text.isEmpty) {
                          _showError('Identification required');
                          return;
                        }
                        final success = await authProvider.login(
                          _emailController.text,
                          _passwordController.text,
                        );
                        if (!success && context.mounted) {
                          _showError('Authentication failed');
                        }
                      },
                    ),

                    const SizedBox(height: 24),

                    // Divider with OR
                    Row(
                      children: [
                        Expanded(child: Divider(color: Colors.white.withOpacity(0.05))),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: const Text(
                            'OR CONTINUE WITH',
                            style: TextStyle(
                              color: AppTheme.textMuted,
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 1,
                            ),
                          ),
                        ),
                        Expanded(child: Divider(color: Colors.white.withOpacity(0.05))),
                      ],
                    ),

                    const SizedBox(height: 24),

                    // Google OAuth
                    Material(
                      color: Colors.white.withOpacity(0.03),
                      borderRadius: BorderRadius.circular(20),
                      child: InkWell(
                        onTap: () async {
                          final url = Uri.parse('http://159.65.84.190/api/auth/oauth/google?platform=mobile');
                          if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
                            _showError('Could not launch browser');
                          }
                        },
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          height: 56,
                          width: double.infinity,
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.white.withOpacity(0.05)),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: const [
                              Icon(LucideIcons.globe, size: 18, color: AppTheme.textPrimary),
                              SizedBox(width: 12),
                              Text(
                                'Google Account',
                                style: TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w700,
                                  color: AppTheme.textPrimary,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),

                    const SizedBox(height: 48),

                    GestureDetector(
                      onTap: () {},
                      child: RichText(
                        text: const TextSpan(
                          style: TextStyle(fontSize: 13, color: AppTheme.textMuted),
                          children: [
                            TextSpan(text: 'New Explorer? '),
                            TextSpan(
                              text: 'Initialize Account',
                              style: TextStyle(color: AppTheme.accent, fontWeight: FontWeight.w900),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
        ),
        backgroundColor: const Color(0xFF1C1C1C),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }
}
