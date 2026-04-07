import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class RecoveryStatusDialog extends StatelessWidget {
  const RecoveryStatusDialog({super.key});

  static void show(BuildContext context) {
    showDialog(
      context: context,
      barrierColor: const Color(0xFF0E0E0E).withOpacity(0.78),
      builder: (_) => const RecoveryStatusDialog(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.symmetric(horizontal: 14),
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.topCenter,
        children: [
          // Main Container
          Container(
            width: 347,
            height: 225,
            margin: const EdgeInsets.only(top: 40),
            padding: const EdgeInsets.fromLTRB(20, 60, 20, 20),
            decoration: BoxDecoration(
              color: const Color(0xFFF8F8F8),
              borderRadius: BorderRadius.circular(19),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  'You reached out maximum amount of attempts. Please, try later.',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.raleway(
                    fontWeight: FontWeight.w500,
                    fontSize: 18,
                    height: 1.44,
                    color: const Color(0xFF202020),
                    letterSpacing: -0.18,
                  ),
                ),
                const SizedBox(height: 32),
                
                // Okay Button
                GestureDetector(
                  onTap: () => Navigator.pop(context),
                  child: Container(
                    height: 50,
                    width: 201,
                    decoration: BoxDecoration(
                      color: const Color(0xFF202020),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Center(
                      child: Text(
                        'Okay',
                        style: GoogleFonts.nunitoSans(
                          fontWeight: FontWeight.w300,
                          fontSize: 22,
                          color: const Color(0xFFF3F3F3),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Exclamation Icon Circle
          Positioned(
            top: 0,
            child: Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.16),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: Center(
                child: Container(
                  width: 52,
                  height: 52,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFFEBEB),
                    shape: BoxShape.circle,
                  ),
                  child: Center(
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: const BoxDecoration(
                        color: Color(0xFFF1AEAE),
                        shape: BoxShape.circle,
                      ),
                      child: const Center(
                        child: Text(
                          '!',
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
