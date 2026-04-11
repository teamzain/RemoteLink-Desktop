import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
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
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: IntrinsicHeight(
                  child: Column(
                    children: [
                      const SizedBox(height: 80),
                      // Top Logo Section
                      const Center(
                        child: SizedBox(
                          width: 154,
                          height: 185,
                          child: Center(
                            child: Icon(
                              LucideIcons.link,
                              size: 140,
                              color: Color(0xFF141718),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 40),
                      // Welcome Text
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Text(
                          'Welcome to\nConnect-X',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.urbanist(
                            fontWeight: FontWeight.w800,
                            fontSize: 40,
                            height: 1.4,
                            letterSpacing: -1,
                            color: const Color(0xFF212121),
                          ),
                        ),
                      ),
                      const SizedBox(height: 80),
                      // Action Buttons
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 25),
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
                                CupertinoPageRoute(builder: (_) => const LoginScreen()),
                              ),
                            ),
                            const SizedBox(height: 20),
                            // Signup Button
                            _buildActionButton(
                              context,
                              label: 'Sign up',
                              color: const Color(0xFFE3E3E3),
                              textColor: const Color(0xFFB1B1B1),
                              onTap: () => Navigator.push(
                                context,
                                CupertinoPageRoute(builder: (_) => const SignupScreen()),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Spacer(),
                      const SizedBox(height: 80),
                    ],
                  ),
                ),
              ),
            );
          },
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

