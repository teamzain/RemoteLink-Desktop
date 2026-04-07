import 'package:flutter/material.dart';
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
      'title': 'Unlock the Power\nOf Future AI',
      'subtitle': 'Chat with the smartest AI Future Experience power of AI with us',
      'image': 'assets/images/onboarding_step1.png',
    },
    {
      'title': 'Chat With Your\nFavourite Ai',
      'subtitle': 'Chat with the smartest AI Future Experience power of AI with us',
      'image': 'assets/images/onboarding_step2.png',
    },
    {
      'title': 'Boost Your Mind\nPower with Ai',
      'subtitle': 'Chat with the smartest AI Future Experience power of AI with us',
      'image': 'assets/images/onboarding_step3.png',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

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
                return Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: Column(
                    children: [
                      const SizedBox(height: 60),
                      // Image Section with Blur
                      Stack(
                        alignment: Alignment.center,
                        children: [
                          Container(
                            width: 320,
                            height: 380,
                            margin: const EdgeInsets.only(top: 40),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.5),
                              borderRadius: BorderRadius.circular(35),
                            ),
                          ),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(33),
                            child: Image.asset(
                              step['image']!,
                              width: 310,
                              height: 400,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) => Container(
                                width: 310,
                                height: 400,
                                color: Colors.grey[200],
                                child: const Icon(Icons.image, size: 50),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 60),
                      // Indicator
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(
                          _steps.length,
                          (i) => Container(
                            margin: const EdgeInsets.symmetric(horizontal: 4),
                            width: 18,
                            height: 18,
                            decoration: BoxDecoration(
                              color: i == _currentPage 
                                  ? const Color(0xFF141718) 
                                  : const Color(0xFF23262F).withOpacity(0.5),
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 30),
                      // Text
                      Text(
                        step['title']!,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(
                          fontWeight: FontWeight.w700,
                          fontSize: 34,
                          height: 1.5,
                          letterSpacing: -0.02,
                          color: const Color(0xFF23262F),
                        ),
                      ),
                      const SizedBox(height: 15),
                      Text(
                        step['subtitle']!,
                        textAlign: TextAlign.center,
                        style: GoogleFonts.poppins(
                          fontWeight: FontWeight.w300,
                          fontSize: 16.3,
                          height: 1.78,
                          color: const Color(0xFF8E9295),
                        ),
                      ),
                    ],
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
                  MaterialPageRoute(builder: (_) => const WelcomeScreen()),
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
              bottom: 32,
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
                      offset: const Offset(0, 40),
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
                      child: Icon(
                        LucideIcons.arrowLeft,
                        color: _currentPage > 0 ? const Color(0xFF23262F) : const Color(0xFFB1B5C4),
                      ),
                    ),
                    const SizedBox(width: 24),
                    // Divider
                    Container(width: 2, height: 24, color: const Color(0xFFE6E8EC)),
                    const SizedBox(width: 24),
                    // Right Arrow
                    GestureDetector(
                      onTap: () {
                        if (_currentPage < _steps.length - 1) {
                          _pageController.nextPage(duration: const Duration(milliseconds: 300), curve: Curves.easeInOut);
                        } else {
                          Navigator.pushReplacement(
                            context,
                            MaterialPageRoute(builder: (_) => const WelcomeScreen()),
                          );
                        }
                      },
                      child: const Icon(
                        LucideIcons.arrowRight,
                        color: Color(0xFF23262F),
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
