import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../core/theme.dart';
import '../providers/auth_provider.dart';

class SnowInput extends StatelessWidget {
  final String label;
  final String hint;
  final bool isPassword;
  final TextEditingController controller;
  final Widget? suffixIcon;
  final bool isPurity;
  final ValueChanged<String>? onChanged;

  const SnowInput({
    super.key,
    required this.label,
    required this.hint,
    required this.controller,
    this.isPassword = false,
    this.suffixIcon,
    this.isPurity = false,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4.0, bottom: 10.0),
          child: Text(
            label.toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: AppTheme.textMuted,
              letterSpacing: 1.5,
            ),
          ),
        ),
        TextField(
          controller: controller,
          obscureText: isPassword,
          onChanged: onChanged,
          style: TextStyle(
            color: AppTheme.textPrimary,
            fontWeight: isPurity ? FontWeight.bold : FontWeight.w600,
            fontSize: isPurity ? 24 : 15,
            fontFamily: isPurity ? 'monospace' : null,
            letterSpacing: isPurity ? 6 : null,
          ),
          textAlign: isPurity ? TextAlign.center : TextAlign.start,
          decoration: InputDecoration(
            filled: true,
            fillColor: AppTheme.surfaceAccent,
            hintText: hint,
            hintStyle: const TextStyle(
              color: AppTheme.textMuted,
              fontWeight: FontWeight.w500,
              fontSize: 14,
              letterSpacing: 0,
            ),
            suffixIcon: suffixIcon,
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(20),
              borderSide: const BorderSide(color: AppTheme.divider),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(20),
              borderSide: const BorderSide(color: AppTheme.accent, width: 1.5),
            ),
            contentPadding: EdgeInsets.symmetric(
              horizontal: 20,
              vertical: isPurity ? 22 : 18,
            ),
          ),
        ),
      ],
    );
  }
}

class SnowDrawer extends StatelessWidget {
  final String currentView;
  final Function(String) onNavigate;

  const SnowDrawer({
    super.key,
    required this.currentView,
    required this.onNavigate,
  });

  @override
  Widget build(BuildContext context) {
    return Drawer(
      backgroundColor: AppTheme.background,
      width: MediaQuery.of(context).size.width * 0.85,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.zero),
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppTheme.accent.withOpacity(0.05),
              AppTheme.background,
            ],
          ),
        ),
        child: Column(
          children: [
            _buildHeader(context),
            const Divider(color: Colors.white10, height: 1),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
                children: [
                  _buildSectionHeader('Remote Hub'),
                  _buildNavItem(LucideIcons.layoutDashboard, 'Dashboard', 'dashboard'),
                  _buildNavItem(LucideIcons.radio, 'Active Hosting', 'host'),
                  _buildNavItem(LucideIcons.monitor, 'Fleet Manager', 'devices'),
                  
                  const SizedBox(height: 40),
                  _buildSectionHeader('System Settings'),
                  _buildNavItem(LucideIcons.user, 'My Profile', 'profile'),
                  _buildNavItem(LucideIcons.settings, 'Configuration', 'settings'),
                  _buildNavItem(LucideIcons.bookOpen, 'API Guide', 'documentation'),
                  
                  const SizedBox(height: 40),
                  _buildSectionHeader('Legal & Billing'),
                  _buildNavItem(LucideIcons.creditCard, 'Subscription Plan', 'billing'),
                  _buildNavItem(LucideIcons.lifeBuoy, 'Priority Support', 'support'),
                ],
              ),
            ),
            _buildFooter(context),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(28, 64, 28, 28),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: AppTheme.accent,
              borderRadius: BorderRadius.circular(15),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.accent.withOpacity(0.2),
                  blurRadius: 15,
                  offset: const Offset(0, 5),
                ),
              ],
            ),
            child: const Center(
              child: Icon(LucideIcons.zap, color: Colors.white, size: 28),
            ),
          ),
          const SizedBox(width: 16),
          const Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'RemoteLink',
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                  letterSpacing: -1,
                ),
              ),
              Text(
                'v1.4.2 Enterprise',
                style: TextStyle(
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                  color: Colors.white38,
                  letterSpacing: 1,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 12),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w900,
          color: Colors.white.withOpacity(0.2),
          letterSpacing: 2,
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String title, String viewId) {
    final isActive = currentView == viewId;

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      child: Material(
        color: isActive ? AppTheme.accent.withOpacity(0.12) : Colors.transparent,
        borderRadius: BorderRadius.circular(16),
        child: InkWell(
          onTap: () => onNavigate(viewId),
          borderRadius: BorderRadius.circular(16),
          child: Container(
            height: 54,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              border: isActive ? Border.all(color: AppTheme.accent.withOpacity(0.2)) : null,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 20,
                  color: isActive ? AppTheme.accent : Colors.white38,
                ),
                const SizedBox(width: 16),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 15,
                    fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                    color: isActive ? Colors.white : Colors.white70,
                  ),
                ),
                if (isActive) ...[
                  const Spacer(),
                  Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: AppTheme.accent,
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFooter(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: Colors.white10)),
      ),
      child: Material(
        color: Colors.white.withOpacity(0.04),
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          onTap: () {
            context.read<AuthProvider>().logout();
          },
          borderRadius: BorderRadius.circular(20),
          child: Container(
            height: 56,
            padding: const EdgeInsets.symmetric(horizontal: 20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.logOut, size: 16, color: Colors.redAccent.withOpacity(0.8)),
                const SizedBox(width: 10),
                Text(
                  'TERMINATE SESSION',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Colors.redAccent.withOpacity(0.8),
                    letterSpacing: 1.5,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
