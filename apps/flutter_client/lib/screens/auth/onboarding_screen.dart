import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'welcome_screen.dart';

class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  final List<Map<String, String>> _steps = [
    {
      'title': 'Universal Control\nFrom Desktop',
      'subtitle': 'Take full command of your Android device from any desktop with Connect-X.',
      'image': 'assets/images/onboarding_step1.png',
    },
    {
      'title': 'Ultra-Low\nLatency Streaming',
      'subtitle': 'Experience smooth, high-fidelity remote desktop control in real-time.',
      'image': 'assets/images/onboarding_step2.png',
    },
    {
      'title': 'Private & Secure\nConnectivity',
      'subtitle': 'Your data is encrypted end-to-end between your host and controller.',
      'image': 'assets/images/onboarding_step3.png',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final isVerySmall = size.width <= 350;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: SafeArea(
        child: Stack(
          children: [
            // PageView
            PageView.builder(
              controller: _pageController,
              onPageChanged: (idx) => setState(() => _currentPage = idx),
              itemCount: _steps.length,
              itemBuilder: (context, index) {
                final step = _steps[index];
                return SingleChildScrollView(
                  child: Padding(
                    padding: EdgeInsets.symmetric(horizontal: size.width * 0.1),
                    child: Column(
                      children: [
                        SizedBox(height: size.width * 0.15), // Matches RN marginTop: '15%'
                        // Image Section with responsive sizes
                        SizedBox(
                          width: double.infinity,
                          height: size.width * 0.9,
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(33),
                            child: Image.asset(
                              step['image']!,
                              fit: BoxFit.contain, // Matches RN resizeMode="contain"
                              errorBuilder: (context, error, stackTrace) => Container(
                                color: Colors.grey[200],
                                child: const Icon(Icons.image, size: 50),
                              ),
                            ),
                          ),
                        ),
                        
                        SizedBox(height: size.width * 0.05), // RN marginTop: '5%'
                        
                        // Indicator
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: List.generate(
                            _steps.length,
                            (i) => AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              margin: const EdgeInsets.symmetric(horizontal: 4),
                              width: 12,
                              height: 12,
                              decoration: BoxDecoration(
                                color: i == _currentPage 
                                    ? const Color(0xFF141718) 
                                    : const Color(0xFF23262F).withOpacity(0.5),
                                shape: BoxShape.circle,
                              ),
                            ),
                          ),
                        ),
                        
                        SizedBox(height: size.width * 0.08), // RN marginTop: '8%'
                        
                        // Text
                        Text(
                          step['title']!,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w700,
                            fontSize: isVerySmall ? 28 : 32,
                            height: (isVerySmall ? 40 : 48) / (isVerySmall ? 28 : 32),
                            letterSpacing: -0.02 * (isVerySmall ? 28 : 32),
                            color: const Color(0xFF23262F),
                          ),
                        ),
                        const SizedBox(height: 15), // RN marginTop: 15
                        Text(
                          step['subtitle']!,
                          textAlign: TextAlign.center,
                          style: GoogleFonts.poppins(
                            fontWeight: FontWeight.w300,
                            fontSize: isVerySmall ? 14 : 16,
                            height: (isVerySmall ? 24 : 28) / (isVerySmall ? 14 : 16),
                            color: const Color(0xFF8E9295),
                          ),
                        ),
                        // Buffer space for navigator at bottom
                        const SizedBox(height: 140),
                      ],
                    ),
                  ),
                );
              },
            ),
            
            // Skip Button
            Positioned(
              top: 20,
              right: 30,
              child: GestureDetector(
                onTap: () => Navigator.pushReplacement(
                  context,
                  CupertinoPageRoute(builder: (_) => const WelcomeScreen()),
                ),
                child: Text(
                  'Skip',
                  style: GoogleFonts.poppins(
                    fontWeight: FontWeight.w600,
                    fontSize: 18,
                    color: const Color(0xFFD7D7D7),
                  ),
                ),
              ),
            ),

            // Bottom Navigator
            Positioned(
              bottom: size.height * 0.06,
              left: (size.width - 154) / 2,
              child: Container(
                width: 154,
                height: 64,
                decoration: BoxDecoration(
                  color: const Color(0xFFFCFCFD),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF0F0F0F).withOpacity(0.12),
                      blurRadius: 32,
                      offset: const Offset(0, 20),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    // Left Arrow
                    GestureDetector(
                      onTap: _currentPage > 0 
                        ? () => _pageController.previousPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut) 
                        : null,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                        child: Icon(
                          LucideIcons.arrowLeft,
                          color: _currentPage > 0 ? const Color(0xFF23262F) : const Color(0xFFB1B5C4),
                          size: 24,
                        ),
                      ),
                    ),
                    // Divider
                    Container(width: 2, height: 24, color: const Color(0xFFE6E8EC)),
                    // Right Arrow
                    GestureDetector(
                      onTap: () {
                        if (_currentPage < _steps.length - 1) {
                          _pageController.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
                        } else {
                          Navigator.pushReplacement(
                            context,
                            CupertinoPageRoute(builder: (_) => const WelcomeScreen()),
                          );
                        }
                      },
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                        child: const Icon(
                          LucideIcons.arrowRight,
                          color: Color(0xFF23262F),
                          size: 24,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

