import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:app_links/app_links.dart';
import 'dart:async';
import '../../providers/auth_provider.dart';
import 'password_screen.dart';
import 'signup_screen.dart';
import '../dashboard/dashboard_screen.dart';

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
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
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
      final accessToken = uri.queryParameters['accessToken'];
      final refreshToken = uri.queryParameters['refreshToken'];
      if (accessToken != null && mounted) {
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        final success = await authProvider.loginWithTokens(accessToken, refreshToken: refreshToken);
        if (success && mounted) {
          Navigator.pushAndRemoveUntil(
            context,
            CupertinoPageRoute(builder: (_) => const DashboardScreen()),
            (route) => false,
          );
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

  Future<void> _handleGoogleSignIn(BuildContext context) async {
    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.signInWithGoogle();
    if (success && mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        CupertinoPageRoute(builder: (_) => const DashboardScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      resizeToAvoidBottomInset: true,
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            final h = constraints.maxHeight;
            final w = constraints.maxWidth;
            return Padding(
              padding: EdgeInsets.symmetric(horizontal: w * 0.09),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(height: h * 0.04),

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

                  SizedBox(height: h * 0.06),

                  // Title
                  Text(
                    'Login',
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.w600,
                      fontSize: h * 0.048,
                      height: 1.2,
                      color: const Color(0xFF323142),
                    ),
                  ),
                  SizedBox(height: h * 0.008),
                  Text(
                    'Good to see you back!',
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.w400,
                      fontSize: h * 0.02,
                      color: const Color(0xFF8E9295),
                    ),
                  ),

                  SizedBox(height: h * 0.04),

                  // Email Input
                  _buildInputContainer(
                    child: TextField(
                      controller: _emailController,
                      keyboardType: TextInputType.emailAddress,
                      style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500),
                      decoration: _inputDecoration('Email or Phone Number', LucideIcons.mail),
                      onChanged: (_) {
                        if (authProvider.error != null) authProvider.clearError();
                      },
                    ),
                  ),

                  SizedBox(height: h * 0.022),

                  // Inline error
                  if (authProvider.error != null)
                    _buildErrorBanner(authProvider.error!),

                  SizedBox(height: authProvider.error != null ? h * 0.018 : 0),

                  // Next Button
                  _buildPrimaryButton(
                    label: 'Next',
                    isLoading: authProvider.isLoading,
                    onTap: () {
                      if (_emailController.text.trim().isNotEmpty) {
                        Navigator.push(
                          context,
                          CupertinoPageRoute(
                            builder: (_) => PasswordScreen(email: _emailController.text.trim()),
                          ),
                        );
                      } else {
                        ScaffoldMessenger.of(context).showSnackBar(
                          _buildSnackBar('Please enter your email'),
                        );
                      }
                    },
                  ),

                  SizedBox(height: h * 0.025),

                  // Sign Up link
                  Center(
                    child: GestureDetector(
                      onTap: () => Navigator.pushReplacement(
                        context,
                        CupertinoPageRoute(builder: (_) => const SignupScreen()),
                      ),
                      child: RichText(
                        text: TextSpan(
                          text: "Don't have an account? ",
                          style: GoogleFonts.poppins(
                            fontSize: 14,
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

                  SizedBox(height: h * 0.035),

                  // OR Divider
                  _buildOrDivider(),

                  SizedBox(height: h * 0.03),

                  // Google Sign-In Button
                  _buildGoogleButton(
                    isLoading: authProvider.isLoading,
                    onTap: () => _handleGoogleSignIn(context),
                  ),

                  const Spacer(),
                  SizedBox(height: h * 0.02),
                ],
              ),
            );
          },
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
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }

  InputDecoration _inputDecoration(String hint, IconData icon, {Widget? suffix}) {
    return InputDecoration(
      hintText: hint,
      hintStyle: GoogleFonts.poppins(
        color: const Color(0xFFC2C3CB),
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      prefixIcon: Icon(icon, color: const Color(0xFFC2C3CB), size: 20),
      suffixIcon: suffix,
      border: InputBorder.none,
      contentPadding: const EdgeInsets.symmetric(vertical: 20, horizontal: 20),
    );
  }

  Widget _buildErrorBanner(String message) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFFECACA)),
      ),
      child: Row(
        children: [
          const Icon(LucideIcons.circleAlert, color: Color(0xFFEF4444), size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: GoogleFonts.poppins(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: const Color(0xFFDC2626),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPrimaryButton({
    required String label,
    required bool isLoading,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: isLoading ? null : onTap,
      child: Container(
        width: double.infinity,
        height: 58,
        decoration: BoxDecoration(
          color: const Color(0xFF141718),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Center(
          child: isLoading
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                )
              : Text(
                  label,
                  style: GoogleFonts.poppins(
                    fontWeight: FontWeight.w600,
                    fontSize: 15,
                    color: Colors.white,
                  ),
                ),
        ),
      ),
    );
  }

  Widget _buildOrDivider() {
    return Row(
      children: [
        Expanded(child: Divider(color: const Color(0xFFC2C3CB).withOpacity(0.4), thickness: 1)),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14),
          child: Text(
            'OR',
            style: GoogleFonts.poppins(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: const Color(0xFFACADB9),
            ),
          ),
        ),
        Expanded(child: Divider(color: const Color(0xFFC2C3CB).withOpacity(0.4), thickness: 1)),
      ],
    );
  }

  Widget _buildGoogleButton({required bool isLoading, required VoidCallback onTap}) {
    return GestureDetector(
      onTap: isLoading ? null : onTap,
      child: Container(
        width: double.infinity,
        height: 56,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE5E7EB)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.03),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const FaIcon(FontAwesomeIcons.google, size: 18, color: Color(0xFFDB4437)),
            const SizedBox(width: 12),
            Text(
              'Continue with Google',
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.w600,
                fontSize: 14,
                color: const Color(0xFF323142),
              ),
            ),
          ],
        ),
      ),
    );
  }

  SnackBar _buildSnackBar(String message) {
    return SnackBar(
      content: Text(message, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
      backgroundColor: const Color(0xFF141718),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
    );
  }
}
