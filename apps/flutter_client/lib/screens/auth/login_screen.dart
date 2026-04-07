import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:app_links/app_links.dart';
import 'package:url_launcher/url_launcher.dart';
import 'dart:async';
import '../../providers/auth_provider.dart';
import 'password_screen.dart';
import 'signup_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailController = TextEditingController();
  
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
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 35),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 45),
              // Back Button
              GestureDetector(
                onTap: () => Navigator.pop(context),
                child: Container(
                  width: 45,
                  height: 45,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFD3D1D8).withOpacity(0.3),
                        blurRadius: 24,
                        offset: const Offset(6, 12),
                      ),
                    ],
                  ),
                  child: const Icon(LucideIcons.chevronLeft, color: Colors.black),
                ),
              ),
              const SizedBox(height: 70),
              // Title
              Text(
                'Login',
                style: GoogleFonts.poppins(
                  fontWeight: FontWeight.w600,
                  fontSize: 38,
                  height: 1.25,
                  color: const Color(0xFF323142),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Good to see you back!',
                style: GoogleFonts.poppins(
                  fontWeight: FontWeight.w400,
                  fontSize: 16,
                  color: const Color(0xFF8E9295),
                ),
              ),
              const SizedBox(height: 40),
              // Email Input
              _buildInputContainer(
                child: TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: _inputDecoration('Email or Phone Number', LucideIcons.mail),
                ),
              ),
              const SizedBox(height: 40),
              // Next Button
              GestureDetector(
                onTap: () {
                  if (_emailController.text.isNotEmpty) {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => PasswordScreen(email: _emailController.text),
                      ),
                    );
                  } else {
                    _showError('Identification required');
                  }
                },
                child: Container(
                  width: double.infinity,
                  height: 65,
                  decoration: BoxDecoration(
                    color: const Color(0xFF141718),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Center(
                    child: authProvider.isLoading 
                      ? const CircularProgressIndicator(color: Colors.white)
                      : Text(
                          'Next',
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w500,
                            fontSize: 16,
                            color: const Color(0xFFF3F5FB),
                          ),
                        ),
                  ),
                ),
              ),
              const SizedBox(height: 30),
              // Sign Up Link
              Center(
                child: GestureDetector(
                  onTap: () => Navigator.pushReplacement(
                    context,
                    MaterialPageRoute(builder: (_) => const SignupScreen()),
                  ),
                  child: RichText(
                    text: TextSpan(
                      text: "Don't have an account? ",
                      style: GoogleFonts.poppins(
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                        color: const Color(0xFFACADB9),
                      ),
                      children: [
                        TextSpan(
                          text: 'Sign Up',
                          style: GoogleFonts.poppins(
                            color: const Color(0xFF323142),
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 30),
              // Social Divider
              Divider(color: const Color(0xFFC2C3CB).withOpacity(0.3), thickness: 1),
              const SizedBox(height: 30),
              // Social Login
              Center(
                child: Text(
                  'Continue With Accounts',
                  style: GoogleFonts.poppins(
                    fontWeight: FontWeight.w500,
                    fontSize: 16,
                    color: const Color(0xFFACADB9),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Expanded(
                    child: _buildSocialButton(
                      label: 'GOOGLE',
                      color: const Color(0xFFD44638).withOpacity(0.25),
                      textColor: const Color(0xFFD44638),
                      onTap: () async {
                        final url = Uri.parse('http://159.65.84.190/api/auth/oauth/google?platform=mobile');
                        if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
                          _showError('Could not launch browser');
                        }
                      },
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: _buildSocialButton(
                      label: 'FACEBOOK',
                      color: const Color(0xFF4267B2).withOpacity(0.25),
                      textColor: const Color(0xFF4267B2),
                      onTap: () {},
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInputContainer({required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(13),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.03),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }

  InputDecoration _inputDecoration(String hint, IconData icon) {
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.poppins(
        color: const Color(0xFFC2C3CB),
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      prefixIcon: Icon(icon, color: const Color(0xFFC2C3CB), size: 20),
      border: InputBorder.none,
      contentPadding: const EdgeInsets.symmetric(vertical: 22, horizontal: 20),
    );
  }

  Widget _buildSocialButton({
    required String label,
    required Color color,
    required Color textColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 154,
        height: 57,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Center(
          child: Text(
            label,
            style: GoogleFonts.poppins(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              letterSpacing: 2.5,
              color: textColor,
            ),
          ),
        ),
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
        backgroundColor: const Color(0xFF141718),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
      ),
    );
  }
}
