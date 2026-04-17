import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../providers/auth_provider.dart';
import '../dashboard/dashboard_screen.dart';

class PasswordScreen extends StatefulWidget {
  final String email;
  const PasswordScreen({super.key, required this.email});

  @override
  State<PasswordScreen> createState() => _PasswordScreenState();
}

class _PasswordScreenState extends State<PasswordScreen> {
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  String get _displayName {
    final part = widget.email.split('@').first;
    if (part.isEmpty) return 'Guest';
    return part[0].toUpperCase() + part.substring(1);
  }

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
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login(BuildContext context) async {
    final password = _passwordController.text;
    if (password.isEmpty) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(widget.email, password);

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

                  // Dynamic greeting
                  Text(
                    'Hello,\n$_displayName!',
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.w700,
                      fontSize: h * 0.052,
                      height: 1.2,
                      color: const Color(0xFF323142),
                    ),
                  ),
                  SizedBox(height: h * 0.008),
                  Text(
                    'Enter your password to continue.',
                    style: GoogleFonts.poppins(
                      fontWeight: FontWeight.w400,
                      fontSize: h * 0.018,
                      color: const Color(0xFF8E9295),
                    ),
                  ),

                  SizedBox(height: h * 0.04),

                  // Password Input
                  _buildInputContainer(
                    child: TextField(
                      controller: _passwordController,
                      obscureText: _obscurePassword,
                      style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500),
                      onSubmitted: (_) => _login(context),
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
                      onChanged: (_) {
                        if (authProvider.error != null) authProvider.clearError();
                      },
                    ),
                  ),

                  SizedBox(height: h * 0.022),

                  // Inline error
                  if (authProvider.error != null) _buildErrorBanner(authProvider.error!),
                  if (authProvider.error != null) SizedBox(height: h * 0.018),

                  // Login Button
                  _buildPrimaryButton(
                    label: 'Login',
                    isLoading: authProvider.isLoading,
                    onTap: () => _login(context),
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
}
