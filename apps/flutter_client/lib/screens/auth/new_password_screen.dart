import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../widgets/bubbles_background.dart';

class NewPasswordScreen extends StatefulWidget {
  final String email;
  const NewPasswordScreen({super.key, required this.email});

  @override
  State<NewPasswordScreen> createState() => _NewPasswordScreenState();
}

class _NewPasswordScreenState extends State<NewPasswordScreen> {
  final _passwordController = TextEditingController();
  final _repeatController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: Colors.white,
      body: BubblesBackground(
        child: SafeArea(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Column(
              children: [
                SizedBox(height: size.height * 0.08),
                // Profile Image
                Center(
                  child: Container(
                    width: 106,
                    height: 106,
                    padding: const EdgeInsets.all(5),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 5,
                        ),
                      ],
                    ),
                    child: ClipOval(
                      child: Image.network(
                        'https://i.pravatar.cc/150?u=${widget.email}',
                        fit: BoxFit.cover,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                
                // Title: Setup New Password
                Text(
                  'Setup New Password',
                  style: GoogleFonts.raleway(
                    fontWeight: FontWeight.w700,
                    fontSize: 21,
                    color: const Color(0xFF202020),
                    letterSpacing: -0.21,
                  ),
                ),
                const SizedBox(height: 12),
                
                // Subtitle
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Text(
                    'Please, setup a new password for your account',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.nunitoSans(
                      fontWeight: FontWeight.w300,
                      fontSize: 19,
                      height: 1.42,
                      color: Colors.black,
                    ),
                  ),
                ),
                SizedBox(height: size.height * 0.04),

                // Password Fields
                _buildField('New Password', _passwordController),
                const SizedBox(height: 10),
                _buildField('Repeat Password', _repeatController),

                SizedBox(height: size.height * 0.15),

                // Save Button
                GestureDetector(
                  onTap: () {
                    Navigator.pop(context);
                  },
                  child: Container(
                    height: 61,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: const Color(0xFF004CFF),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Center(
                      child: Text(
                        'Save',
                        style: GoogleFonts.nunitoSans(
                          fontWeight: FontWeight.w300,
                          fontSize: 22,
                          color: const Color(0xFFF3F3F3),
                        ),
                      ),
                    ),
                  ),
                ),

                const SizedBox(height: 24),
                
                // Cancel
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text(
                    'Cancel',
                    style: GoogleFonts.nunitoSans(
                      fontWeight: FontWeight.w300,
                      fontSize: 15,
                      color: const Color(0xFF202020).withOpacity(0.9),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildField(String hint, TextEditingController controller) {
    return Container(
      height: 50,
      decoration: BoxDecoration(
        color: const Color(0xFFF8F8F8),
        borderRadius: BorderRadius.circular(9),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20),
      child: Center(
        child: TextField(
          controller: controller,
          obscureText: true,
          textAlign: TextAlign.center,
          style: GoogleFonts.raleway(
            fontWeight: FontWeight.w500,
            fontSize: 17,
            color: const Color(0xFF202020),
          ),
          decoration: InputDecoration(
            hintText: hint,
            border: InputBorder.none,
            hintStyle: GoogleFonts.raleway(
              fontWeight: FontWeight.w500,
              fontSize: 17,
              color: const Color(0xFFDCDCDC),
            ),
          ),
        ),
      ),
    );
  }
}
