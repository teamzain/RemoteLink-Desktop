import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../widgets/bubbles_background.dart';
import '../../providers/host_provider.dart';
import '../dashboard/dashboard_screen.dart';

class ReadyScreen extends StatefulWidget {
  const ReadyScreen({super.key});

  @override
  State<ReadyScreen> createState() => _ReadyScreenState();
}

class _ReadyScreenState extends State<ReadyScreen> {
  int _currentStep = 0; // 0: Remote Control, 1: Ready? (Start Publishing)

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;
    final host = context.watch<HostProvider>();

    // Auto-advance if accessibility is enabled and we are on step 0
    if (host.isAccessibilityEnabled && _currentStep == 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) setState(() => _currentStep = 1);
      });
    }

    final isStepOne = _currentStep == 0;

    return Scaffold(
      backgroundColor: Colors.white,
      body: BubblesBackground(
        child: SafeArea(
          child: Column(
            children: [
              const Spacer(flex: 2),
              
              // Main Card
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 500),
                transitionBuilder: (Widget child, Animation<double> animation) {
                  return FadeTransition(
                    opacity: animation,
                    child: SlideTransition(
                      position: Tween<Offset>(
                        begin: const Offset(0.1, 0),
                        end: Offset.zero,
                      ).animate(animation),
                      child: child,
                    ),
                  );
                },
                child: Container(
                  key: ValueKey<int>(_currentStep),
                  margin: const EdgeInsets.symmetric(horizontal: 25),
                  padding: const EdgeInsets.all(2),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(30),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.16),
                        blurRadius: 37,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // Illustration Section
                      isStepOne 
                        ? Container(
                            height: size.height * 0.38,
                            width: double.infinity,
                            decoration: const BoxDecoration(
                              color: Color(0xFFF7F8FA),
                              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
                            ),
                            child: Center(
                              child: Icon(
                                LucideIcons.link, 
                                size: 100, 
                                color: Color(0xFF141718),
                              ),
                            ),
                          )
                        : ClipRRect(
                            borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
                            child: Image.asset(
                              'assets/images/ready_card_illustration.png',
                              height: size.height * 0.38,
                              width: double.infinity,
                              fit: BoxFit.cover,
                              errorBuilder: (context, error, stackTrace) => Container(
                                height: size.height * 0.38,
                                color: const Color(0xFFF2F5FE),
                                child: const Icon(Icons.rocket_launch, size: 80, color: Color(0xFF004CFF)),
                              ),
                            ),
                          ),
                      
                      const SizedBox(height: 32),
                      
                      // Headline
                      Text(
                        isStepOne ? 'Remote Control' : 'Ready?',
                        style: GoogleFonts.raleway(
                          fontWeight: FontWeight.w700,
                          fontSize: 28,
                          color: const Color(0xFF202020),
                          letterSpacing: -0.28,
                        ),
                      ),
                      
                      const SizedBox(height: 12),
                      
                      // Description
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 40),
                        child: Text(
                          isStepOne 
                              ? 'Enable accessibility to allow clicks\nand gestures from your desktop.'
                              : 'Initialize secure screen stream\nto go live on the mesh network.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.nunitoSans(
                            fontWeight: FontWeight.w300,
                            fontSize: 19,
                            height: 1.42,
                            color: Colors.black,
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 48),
                      
                      // Action Button
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 40),
                        child: GestureDetector(
                          onTap: () async {
                            if (isStepOne) {
                              await host.openAccessibilitySettings();
                            } else {
                              await host.startHosting();
                              if (mounted && host.isHosting) {
                                Navigator.pushAndRemoveUntil(
                                  context,
                                  CupertinoPageRoute(builder: (_) => const DashboardScreen()),
                                  (route) => false,
                                );
                              }
                            }
                          },
                          child: Container(
                            height: 61,
                            decoration: BoxDecoration(
                              color: const Color(0xFF004CFF),
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: Center(
                              child: Text(
                                isStepOne ? "Enable Control" : "Let's Start",
                                style: GoogleFonts.nunitoSans(
                                  fontWeight: FontWeight.w300,
                                  fontSize: 22,
                                  color: const Color(0xFFF3F3F3),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                      
                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ),
              
              const Spacer(flex: 1),
              
              // Dots Pagination Indicator
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _buildDot(const Color(0xFFC7D6FB)),
                  const SizedBox(width: 20),
                  _buildDot(isStepOne ? const Color(0xFF004CFF) : const Color(0xFFC7D6FB)),
                  const SizedBox(width: 20),
                  _buildDot(const Color(0xFFC7D6FB)),
                  const SizedBox(width: 20),
                  _buildDot(!isStepOne ? const Color(0xFF004CFF) : const Color(0xFFC7D6FB)),
                ],
              ),
              
              const SizedBox(height: 48),
              
              // Home Bar
              Container(
                width: 134,
                height: 5,
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(34),
                ),
              ),
              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDot(Color color) {
    return Container(
      width: 20,
      height: 20,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.16),
            blurRadius: 30,
          ),
        ],
      ),
    );
  }
}

