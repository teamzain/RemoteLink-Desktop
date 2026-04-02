import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/theme.dart';
import '../../providers/device_provider.dart';
import '../../providers/host_provider.dart';
import '../../widgets/snow_bottom_nav.dart';
import 'overview_screen.dart';
import 'all_devices_screen.dart';
import '../host/host_screen.dart';
import '../profile/profile_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    // Midnight Status Bar
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
    ));
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<DeviceProvider>().fetchDevices();
      context.read<HostProvider>().ensureHosting();
    });
  }

  static const List<Widget> _screens = [
    SnowOverview(),
    AllDevicesScreen(),
    HostScreen(),
    _AlertsPlaceholder(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: SnowBottomNav(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
      ),
      // --- Setup Wizard Overlay ---
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: Consumer<HostProvider>(
        builder: (context, host, child) {
          if (host.isHosting && host.isAccessibilityEnabled) return const SizedBox.shrink();
          return _SetupWizard();
        },
      ),
    );
  }
}

class _AlertsPlaceholder extends StatelessWidget {
  const _AlertsPlaceholder();

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _ScreenHeader(
            title: 'Alerts',
            subtitle: 'System notifications',
            action: Icon(LucideIcons.settings, size: 20, color: AppTheme.textMuted),
          ),
          Expanded(
            child: Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 64,
                    height: 64,
                    decoration: BoxDecoration(
                      color: AppTheme.surface,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppTheme.divider),
                    ),
                    child: const Icon(LucideIcons.bellOff, size: 26, color: AppTheme.textMuted),
                  ),
                  const SizedBox(height: 20),
                  const Text(
                    'No alerts',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'System is running normally.',
                    style: TextStyle(
                      fontSize: 13,
                      color: AppTheme.textMuted,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Shared screen header widget used by all sub-screens
class _ScreenHeader extends StatelessWidget {
  final String title;
  final String subtitle;
  final Widget? action;

  const _ScreenHeader({
    required this.title,
    required this.subtitle,
    this.action,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(28, 24, 24, 24),
      decoration: const BoxDecoration(
        color: AppTheme.surface,
        border: Border(bottom: BorderSide(color: AppTheme.divider)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.textPrimary,
                    letterSpacing: -0.5,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 5),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: AppTheme.textMuted,
                  ),
                ),
              ],
            ),
          ),
          if (action != null) ...[
            const SizedBox(width: 12),
            action!,
          ],
        ],
      ),
    );
  }
}
class _SetupWizard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final host = context.watch<HostProvider>();

    return Container(
      margin: const EdgeInsets.all(20),
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: AppTheme.surface.withOpacity(0.95),
        borderRadius: BorderRadius.circular(32),
        border: Border.all(color: AppTheme.primary.withOpacity(0.2)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.4),
            blurRadius: 40,
            offset: const Offset(0, 20),
          )
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(LucideIcons.shieldCheck, color: AppTheme.primary, size: 24),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'SyncLink Setup',
                        style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: AppTheme.textPrimary),
                      ),
                      Text(
                        'Complete these steps to go live',
                        style: TextStyle(fontSize: 12, color: AppTheme.textMuted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 32),
            
            // Step 1: Accessibility
            _SetupStep(
              title: 'Remote Control',
              subtitle: 'Enable accessibility to allow clicks',
              isActive: !host.isAccessibilityEnabled,
              isDone: host.isAccessibilityEnabled,
              onTap: () => host.openAccessibilitySettings(),
            ),
            const SizedBox(height: 16),

            // Step 2: Hosting
            _SetupStep(
              title: 'Start Publishing',
              subtitle: 'Initialize secure screen stream',
              isActive: host.isAccessibilityEnabled && !host.isHosting,
              isDone: host.isHosting,
              onTap: () => host.startHosting(),
            ),
            const SizedBox(height: 16),
            
            if (host.error != null)
              Padding(
                padding: const EdgeInsets.only(top: 16),
                child: Text(
                  host.error!,
                  style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _SetupStep extends StatelessWidget {
  final String title;
  final String subtitle;
  final bool isActive;
  final bool isDone;
  final VoidCallback onTap;

  const _SetupStep({
    required this.title,
    required this.subtitle,
    required this.isActive,
    required this.isDone,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: isDone ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 300),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDone ? AppTheme.primary.withOpacity(0.05) : (isActive ? AppTheme.primary.withOpacity(0.1) : AppTheme.surface),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isDone ? AppTheme.primary.withOpacity(0.2) : (isActive ? AppTheme.primary : AppTheme.divider),
            width: isActive ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              isDone ? Icons.check_circle : Icons.radio_button_unchecked,
              color: isDone ? AppTheme.primary : (isActive ? AppTheme.primary : AppTheme.textMuted.withOpacity(0.3)),
              size: 20,
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: isDone ? AppTheme.textPrimary : (isActive ? AppTheme.primary : AppTheme.textMuted),
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 11, color: AppTheme.textMuted.withOpacity(0.7)),
                  ),
                ],
              ),
            ),
            if (isActive)
              const Icon(LucideIcons.arrowRight, size: 16, color: AppTheme.primary),
          ],
        ),
      ),
    );
  }
}
