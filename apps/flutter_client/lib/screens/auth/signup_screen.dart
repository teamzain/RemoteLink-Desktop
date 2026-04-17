import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../providers/auth_provider.dart';
import 'login_screen.dart';
import '../dashboard/dashboard_screen.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _codeController = TextEditingController();

  bool _obscurePassword = true;
  // Step 1 = fill details, Step 2 = enter verification code
  bool _awaitingCode = false;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _handleSendCode(BuildContext context) async {
    final email = _emailController.text.trim();
    final password = _passwordController.text;

    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(_buildSnackBar('Please fill in email and password'));
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.requestVerification(email);
    if (success && mounted) {
      setState(() => _awaitingCode = true);
    }
  }

  Future<void> _handleRegister(BuildContext context) async {
    final code = _codeController.text.trim();
    if (code.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(_buildSnackBar('Please enter the verification code'));
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.register(
      _emailController.text.trim(),
      _passwordController.text,
      code,
      name: _nameController.text.trim(),
    );

    if (success && mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        CupertinoPageRoute(builder: (_) => const DashboardScreen()),
        (route) => false,
      );
    }
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
                    onTap: () {
                      if (_awaitingCode) {
                        setState(() {
                          _awaitingCode = false;
                          _codeController.clear();
                          authProvider.clearError();
                        });
                      } else {
                        Navigator.pop(context);
                      }
                    },
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

                  SizedBox(height: h * 0.05),

                  // Title
                  Text(
                    _awaitingCode ? 'Verify\nEmail' : 'Create your\nAccount',
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.w600,
                      fontSize: h * 0.048,
                      height: 1.2,
                      color: const Color(0xFF323142),
                    ),
                  ),
                  SizedBox(height: h * 0.008),
                  Text(
                    _awaitingCode
                        ? 'Enter the 6-digit code sent to ${_emailController.text.trim()}'
                        : 'Join the Connect-X network today.',
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.w400,
                      fontSize: h * 0.018,
                      color: const Color(0xFF8E9295),
                    ),
                  ),

                  SizedBox(height: h * 0.035),

                  // Step 1: name / email / password
                  if (!_awaitingCode) ...[
                    _buildInputContainer(
                      child: TextField(
                        controller: _nameController,
                        style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500),
                        decoration: _inputDecoration('Full Name (optional)', LucideIcons.user),
                      ),
                    ),
                    SizedBox(height: h * 0.018),
                    _buildInputContainer(
                      child: TextField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500),
                        decoration: _inputDecoration('Email Address', LucideIcons.mail),
                        onChanged: (_) {
                          if (authProvider.error != null) authProvider.clearError();
                        },
                      ),
                    ),
                    SizedBox(height: h * 0.018),
                    _buildInputContainer(
                      child: TextField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500),
                        decoration: _inputDecoration(
                          'Password',
                          LucideIcons.lock,
                          suffix: GestureDetector(
                            onTap: () => setState(() => _obscurePassword = !_obscurePassword),
                            child: Icon(
                              _obscurePassword ? LucideIcons.eyeOff : LucideIcons.eye,
                              color: const Color(0xFFC2C3CB),
                              size: 20,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],

                  // Step 2: verification code
                  if (_awaitingCode) ...[
                    _buildInputContainer(
                      child: TextField(
                        controller: _codeController,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        style: GoogleFonts.poppins(
                          fontSize: 22,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 8,
                          color: const Color(0xFF323142),
                        ),
                        decoration: _inputDecoration('_ _ _ _ _ _', LucideIcons.keyRound).copyWith(
                          counterText: '',
                        ),
                        onChanged: (_) {
                          if (authProvider.error != null) authProvider.clearError();
                        },
                      ),
                    ),
                    SizedBox(height: h * 0.014),
                    Center(
                      child: GestureDetector(
                        onTap: () => _handleSendCode(context),
                        child: Text(
                          'Resend Code',
                          style: GoogleFonts.poppins(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: const Color(0xFF141718),
                            decoration: TextDecoration.underline,
                          ),
                        ),
                      ),
                    ),
                  ],

                  SizedBox(height: h * 0.022),

                  // Inline error
                  if (authProvider.error != null) _buildErrorBanner(authProvider.error!),
                  if (authProvider.error != null) SizedBox(height: h * 0.016),

                  // Primary button
                  _buildPrimaryButton(
                    label: _awaitingCode ? 'Create Account' : 'Send Verification Code',
                    isLoading: authProvider.isLoading,
                    onTap: () => _awaitingCode ? _handleRegister(context) : _handleSendCode(context),
                  ),

                  SizedBox(height: h * 0.025),

                  // Sign In link
                  Center(
                    child: GestureDetector(
                      onTap: () => Navigator.pushReplacement(
                        context,
                        CupertinoPageRoute(builder: (_) => const LoginScreen()),
                      ),
                      child: RichText(
                        text: TextSpan(
                          text: 'Already have an account? ',
                          style: GoogleFonts.poppins(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: const Color(0xFFACADB9),
                          ),
                          children: [
                            TextSpan(
                              text: 'Sign In',
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

                  if (!_awaitingCode) ...[
                    SizedBox(height: h * 0.03),
                    _buildOrDivider(),
                    SizedBox(height: h * 0.025),
                    _buildGoogleButton(
                      isLoading: authProvider.isLoading,
                      onTap: () => _handleGoogleSignIn(context),
                    ),
                  ],

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
                    fontSize: 14,
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
