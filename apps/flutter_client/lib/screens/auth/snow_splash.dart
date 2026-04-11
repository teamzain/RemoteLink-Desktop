import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';

import 'dart:async';
import 'onboarding_screen.dart';

class SnowSplash extends StatefulWidget {
  const SnowSplash({super.key});

  @override
  State<SnowSplash> createState() => _SnowSplashState();
}

class _SnowSplashState extends State<SnowSplash> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  late Animation<double> _textOpacity;
  late Animation<Offset> _textOffset;
  
  late Animation<double> _logoOpacity;
  late Animation<double> _logoScale;
  late Animation<Offset> _logoOffset;

  late Animation<double> _versionOpacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    );

    // Text "Connect-X" fades in and slides up from 0 to 1200ms
    _textOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.0, 0.33, curve: Curves.easeIn)),
    );
    _textOffset = Tween<Offset>(begin: const Offset(0, 5), end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.0, 0.5, curve: Curves.easeOutExpo)),
    );

    // Version text fades in around 500ms
    _versionOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.2, 0.53, curve: Curves.easeIn)),
    );

    // Logo disappears, scales down, and slides slightly up starting at 1300ms (to 1700ms)
    // 1300ms / 2400ms = 0.54 to 0.70
    _logoOpacity = Tween<double>(begin: 1.0, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.54, 0.70, curve: Curves.easeIn)),
    );
    _logoScale = Tween<double>(begin: 1.0, end: 0.8).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.54, 0.70, curve: Curves.linear)),
    );
    // Relative offset, will slide slightly up
    _logoOffset = Tween<Offset>(begin: Offset.zero, end: const Offset(0, -0.2)).animate(
      CurvedAnimation(parent: _controller, curve: const Interval(0.54, 0.70, curve: Curves.linear)),
    );

    _controller.forward();

    Timer(const Duration(milliseconds: 2400), () {
      if (mounted) {
        // Just notify parent that we are done if we had a callback, 
        // but since main.dart uses Consumer, it will swap us out 
        // as soon as AuthProvider set isLoading = false.
        // We don't need to push manually here if main.dart is reactive.
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
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // --- Animated Logo ---
                    FadeTransition(
                      opacity: _logoOpacity,
                      child: SlideTransition(
                        position: _logoOffset,
                        child: ScaleTransition(
                          scale: _logoScale,
                          child: const SizedBox(
                            width: 120,
                            height: 143,
                            child: Center(
                              child: Icon(
                                LucideIcons.link,
                                size: 100,
                                color: Color(0xFF141718),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Text slides up into where the logo was
                    Transform.translate(
                      offset: const Offset(0, -20),
                      child: FadeTransition(
                        opacity: _textOpacity,
                        child: SlideTransition(
                          position: _textOffset,
                          child: Text(
                            'Connect-X',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.poppins(
                              fontWeight: FontWeight.w500,
                              fontSize: 35,
                              height: 24 / 35,
                              letterSpacing: -0.02 * 35,
                              color: const Color(0xFF000000),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            // --- Version Footer ---
            Padding(
              padding: const EdgeInsets.only(bottom: 20),
              child: FadeTransition(
                opacity: _versionOpacity,
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
      ),
    );
  }

}
