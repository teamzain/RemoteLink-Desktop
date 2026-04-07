import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

import 'dart:async';
import 'onboarding_screen.dart';

class SnowSplash extends StatefulWidget {
  const SnowSplash({super.key});

  @override
  State<SnowSplash> createState() => _SnowSplashState();
}

class _SnowSplashState extends State<SnowSplash> with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _logoOpacity;
  late Animation<Offset> _textOffset;
  late Animation<double> _textOpacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    );

    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 0.4, curve: Curves.easeIn),
      ),
    );

    _textOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.4, 0.7, curve: Curves.easeIn),
      ),
    );

    _textOffset = Tween<Offset>(begin: const Offset(0, 2), end: Offset.zero).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.4, 0.8, curve: Curves.easeOutBack),
      ),
    );

    _controller.forward();

    Timer(const Duration(milliseconds: 3000), () {
      if (mounted) {
        Navigator.pushReplacement(
          context,
          PageRouteBuilder(
            pageBuilder: (context, animation, secondaryAnimation) => const OnboardingScreen(),
            transitionsBuilder: (context, animation, secondaryAnimation, child) {
              return FadeTransition(opacity: animation, child: child);
            },
            transitionDuration: const Duration(milliseconds: 800),
          ),
        );
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: Stack(
        children: [
          // Logo Section (at 388px from top)
          Positioned(
            top: 388,
            left: 0,
            right: 0,
            child: FadeTransition(
              opacity: _logoOpacity,
              child: Center(
                child: SizedBox(
                  width: 120,
                  height: 143,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      _buildLogoPart(width: 98.33, height: 76.84, offset: const Offset(0, 32)),
                      _buildLogoPart(
                        width: 98.33,
                        height: 76.84,
                        offset: const Offset(6, 0),
                        rotation: 114.49 * (3.14159 / 180),
                      ),
                      _buildLogoPart(
                        width: 98.33,
                        height: 76.84,
                        offset: const Offset(3, 18),
                        rotation: -120.07 * (3.14159 / 180),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // Branding Text: RemoteX (at 801px from top) - Slides from bottom
          Positioned(
            top: 801,
            left: 0,
            right: 0,
            child: FadeTransition(
              opacity: _textOpacity,
              child: SlideTransition(
                position: _textOffset,
                child: Text(
                  'RemoteX',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.poppins(
                    fontWeight: FontWeight.w500,
                    fontSize: 35,
                    height: 24 / 35,
                    letterSpacing: -0.02 * 35,
                    color: Colors.black,
                  ),
                ),
              ),
            ),
          ),

          // Version Footer
          Positioned(
            top: 833,
            left: 0,
            right: 0,
            child: FadeTransition(
              opacity: _textOpacity,
              child: Text(
                'Version 1.0',
                textAlign: TextAlign.center,
                style: GoogleFonts.poppins(
                  fontWeight: FontWeight.w300,
                  fontSize: 16,
                  height: 24 / 16,
                  letterSpacing: -0.02 * 16,
                  color: const Color(0xFF757171),
                ),
              ),
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
            borderRadius: BorderRadius.circular(12.373),
          ),
        ),
      ),
    );
  }
}
