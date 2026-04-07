import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'login_screen.dart';
import 'signup_screen.dart';

class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: Stack(
        children: [
          // Top Logo Section
          Positioned(
            top: 137,
            left: 0,
            right: 0,
            child: Center(
              child: SizedBox(
                width: 154,
                height: 185,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    _buildLogoPart(
                      width: 127.23,
                      height: 99.42,
                      offset: const Offset(0, 42.13),
                    ),
                    _buildLogoPart(
                      width: 127.23,
                      height: 99.42,
                      offset: const Offset(7.58, 0),
                      rotation: 114.49 * (3.14159 / 180),
                    ),
                    _buildLogoPart(
                      width: 127.23,
                      height: 99.42,
                      offset: const Offset(4.21, 24.43),
                      rotation: -120.07 * (3.14159 / 180),
                    ),
                  ],
                ),
              ),
            ),
          ),

          // Welcome Text
          Positioned(
            top: 351,
            left: 18,
            right: 18,
            child: Text(
              'Welcome to\nRemoteX',
              textAlign: TextAlign.center,
              style: GoogleFonts.urbanist(
                fontWeight: FontWeight.w700,
                fontSize: 40,
                height: 1.6,
                color: const Color(0xFF212121),
              ),
            ),
          ),

          // Action Buttons
          Positioned(
            top: 542,
            left: 25,
            right: 25,
            child: Column(
              children: [
                // Login Button
                _buildActionButton(
                  context,
                  label: 'Login',
                  color: const Color(0xFF141718),
                  textColor: Colors.white,
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const LoginScreen()),
                  ),
                ),
                const SizedBox(height: 23),
                // Signup Button
                _buildActionButton(
                  context,
                  label: 'Sign up',
                  color: const Color(0xFFE3E3E3),
                  textColor: const Color(0xFFB1B1B1),
                  onTap: () => Navigator.push(
                    context,
                    MaterialPageRoute(builder: (_) => const SignupScreen()),
                  ),
                ),
              ],
            ),
          ),

          // Social Login Section
          Positioned(
            bottom: 60,
            left: 0,
            right: 0,
            child: Column(
              children: [
                Text(
                  'Continue With Accounts',
                  style: GoogleFonts.poppins(
                    fontWeight: FontWeight.w500,
                    fontSize: 16,
                    color: const Color(0xFFACADB9),
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
                        icon: LucideIcons.mail,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: _buildSocialButton(
                        label: 'FACEBOOK',
                        color: const Color(0xFF4267B2).withOpacity(0.25),
                        textColor: const Color(0xFF4267B2),
                        icon: LucideIcons.facebook,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogoPart({
    required double width,
    required double height,
    required Offset offset,
    double rotation = 0,
  }) {
    return Transform.translate(
      offset: offset,
      child: Transform.rotate(
        angle: rotation,
        child: Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: const Color(0xFF141718),
            borderRadius: BorderRadius.circular(16),
          ),
        ),
      ),
    );
  }

  Widget _buildActionButton(
    BuildContext context, {
    required String label,
    required Color color,
    required Color textColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        height: 61,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(95),
          boxShadow: color == const Color(0xFF141718)
              ? [
                  BoxShadow(
                    color: const Color(0xFF17CE92).withOpacity(0.25),
                    blurRadius: 24,
                    offset: const Offset(4, 8),
                  )
                ]
              : null,
        ),
        child: Center(
          child: Text(
            label,
            style: GoogleFonts.urbanist(
              fontWeight: FontWeight.w700,
              fontSize: 18,
              letterSpacing: 0.2,
              color: textColor,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSocialButton({
    required String label,
    required Color color,
    required Color textColor,
    required IconData icon,
  }) {
    return Container(
      width: 165,
      height: 57,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, size: 18, color: textColor),
          const SizedBox(width: 8),
          Text(
            label,
            style: GoogleFonts.poppins(
              fontWeight: FontWeight.w600,
              fontSize: 14,
              letterSpacing: 1.5,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }
}
