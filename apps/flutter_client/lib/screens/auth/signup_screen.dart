import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'login_screen.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  bool _obscurePassword = true;

  @override
  Widget build(BuildContext context) {
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
                'Create your\nAccount',
                style: GoogleFonts.poppins(
                  fontWeight: FontWeight.w600,
                  fontSize: 38,
                  height: 1.25,
                  color: const Color(0xFF323142),
                ),
              ),
              const SizedBox(height: 40),
              // Full Name Input
              _buildInputContainer(
                child: TextField(
                  controller: _nameController,
                  decoration: _inputDecoration('Full Name', LucideIcons.user),
                ),
              ),
              const SizedBox(height: 20),
              // Email Input
              _buildInputContainer(
                child: TextField(
                  controller: _emailController,
                  decoration: _inputDecoration('Enter Your Email', LucideIcons.mail),
                ),
              ),
              const SizedBox(height: 20),
              // Password Input
              _buildInputContainer(
                child: TextField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
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
              const SizedBox(height: 35),
              // Register Button
              GestureDetector(
                onTap: () {
                  // Registration logic placeholder
                },
                child: Container(
                  width: double.infinity,
                  height: 65,
                  decoration: BoxDecoration(
                    color: const Color(0xFF141718),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Center(
                    child: Text(
                      'Register',
                      style: GoogleFonts.poppins(
                        fontWeight: FontWeight.w500,
                        fontSize: 16,
                        color: const Color(0xFFF3F5F6),
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 30),
              // Sign In Link
              Center(
                child: GestureDetector(
                  onTap: () => Navigator.pushReplacement(
                    context,
                    CupertinoPageRoute(builder: (_) => const LoginScreen()),
                  ),
                  child: RichText(
                    text: TextSpan(
                      text: 'Already Have An Account? ',
                      style: GoogleFonts.poppins(
                        fontSize: 16,
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
              const SizedBox(height: 30),
              // Social Divider
              Divider(color: const Color(0xFFC2C3CB).withOpacity(0.3), thickness: 1),
              const SizedBox(height: 30),
              // Social Login
              Text(
                'Continue With Accounts',
                textAlign: TextAlign.center,
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
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: _buildSocialButton(
                      label: 'FACEBOOK',
                      color: const Color(0xFF4267B2).withOpacity(0.25),
                      textColor: const Color(0xFF4267B2),
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
      contentPadding: const EdgeInsets.symmetric(vertical: 22, horizontal: 20),
    );
  }

  Widget _buildSocialButton({
    required String label,
    required Color color,
    required Color textColor,
  }) {
    return Container(
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
    );
  }
}

