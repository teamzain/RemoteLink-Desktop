import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../providers/host_provider.dart';
import '../../core/theme.dart';
import '../../widgets/snow_widgets.dart';

class HostScreen extends StatefulWidget {
  const HostScreen({super.key});

  @override
  State<HostScreen> createState() => _HostScreenState();
}

class _HostScreenState extends State<HostScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<HostProvider>().checkAccessibilityStatus();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<HostProvider>(
      builder: (context, hostProvider, _) {
        final isLive = hostProvider.isHosting;
        final isOnline = hostProvider.isSignaling;
        return Container(
          color: AppTheme.background,
          child: SafeArea(
            child: Column(
              children: [
                // ── Cinematic Hero ────────────────────────────────
                _buildHero(hostProvider, isLive, isOnline),

                // ── Dashboard Stats ───────────────────────────────
                Expanded(
                  child: SingleChildScrollView(
                    physics: const BouncingScrollPhysics(),
                    child: Column(
                      children: [
                        _buildIdentitySection(context, hostProvider),
                        const Padding(
                          padding: EdgeInsets.symmetric(horizontal: 28),
                          child: Divider(height: 1),
                        ),
                        _buildStatsSection(hostProvider),
                        if (hostProvider.error != null) ...[
                          const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 28),
                            child: Divider(height: 1),
                          ),
                          _buildErrorRow(hostProvider.error!),
                        ],
                        const SizedBox(height: 100),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildHero(HostProvider host, bool isLive, bool isOnline) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(28, 24, 28, 32),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border(bottom: BorderSide(color: AppTheme.divider)),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            isLive ? AppTheme.accent.withOpacity(0.08) : AppTheme.surface,
            AppTheme.surface,
          ],
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
           Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: isLive ? AppTheme.success.withOpacity(0.1) : AppTheme.surfaceAccent,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: isLive ? AppTheme.success.withOpacity(0.2) : AppTheme.divider),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                     Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: isLive ? AppTheme.success : AppTheme.textMuted,
                        shape: BoxShape.circle,
                        boxShadow: [
                          if (isLive) BoxShadow(color: AppTheme.success.withOpacity(0.5), blurRadius: 6),
                        ],
                      ),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      isLive ? 'BROADCASTING' : 'STANDBY',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w900,
                        color: isLive ? AppTheme.success : AppTheme.textMuted,
                        letterSpacing: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
              if (isLive)
                IconButton(
                  onPressed: host.stopHosting,
                  icon: const Icon(LucideIcons.power, size: 18, color: Colors.redAccent),
                ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            isLive ? 'Screen Sharing\nis Active' : 'Ready to Start\nBroadcasting',
            style: const TextStyle(
              fontSize: 32,
              fontWeight: FontWeight.w900,
              color: AppTheme.textPrimary,
              height: 1.1,
              letterSpacing: -1,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            isLive 
              ? 'Your device is visible and reachable from your dashboard.' 
              : 'Turn on broadcasting to make this device accessible remotely.',
            style: const TextStyle(
              fontSize: 14,
              color: AppTheme.textSecondary,
              fontWeight: FontWeight.w500,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 32),
          if (!isLive)
            SnowButton(
              label: 'Initialize Host',
              onPressed: host.startHosting,
              icon: const Icon(LucideIcons.zap, size: 18, color: Colors.white),
            ),
          if (!host.isAccessibilityEnabled && !isLive) ...[
            const SizedBox(height: 12),
            SnowButton(
              label: 'Grant Permissions',
              isSecondary: true,
              onPressed: host.openAccessibilitySettings,
              icon: const Icon(LucideIcons.shieldCheck, size: 18, color: Colors.white),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildIdentitySection(BuildContext context, HostProvider host) {
    final key = host.sessionId ?? '— — —';
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 24, 28, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'BROADCAST IDENTITY',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.white24,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 20),
          _infoRow('Host ID', key, canCopy: true, context: context),
          const SizedBox(height: 20),
          _infoRow('Signal Status', host.isSignaling ? 'Connected' : 'Offline', valueColor: host.isSignaling ? AppTheme.success : null),
          const SizedBox(height: 20),
          _infoRow('Security', 'P2P Encrypted'),
        ],
      ),
    );
  }

  Widget _buildStatsSection(HostProvider host) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 24, 28, 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'LIVE TELEMETRY',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.white24,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 20),
          _infoRow('Session Uptime', host.isHosting ? '—' : '00:00:00'),
          const SizedBox(height: 20),
          _infoRow('Bandwidth', host.isHosting ? 'Calculating...' : 'Paused'),
          const SizedBox(height: 20),
          _infoRow(
            'Link Quality',
            host.isHosting ? 'Optimized' : 'Standby',
            valueColor: host.isHosting ? AppTheme.success : null,
          ),
        ],
      ),
    );
  }

  Widget _infoRow(
    String label,
    String value, {
    bool canCopy = false,
    Color? valueColor,
    BuildContext? context,
  }) {
    return Row(
      children: [
        Expanded(
          child: Text(
            label,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: AppTheme.textSecondary,
            ),
          ),
        ),
        Text(
          value,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            color: valueColor ?? AppTheme.textPrimary,
            fontFamily: canCopy ? 'monospace' : null,
            letterSpacing: canCopy ? 1.5 : 0,
          ),
        ),
        if (canCopy && context != null) ...[
          const SizedBox(width: 12),
          GestureDetector(
            onTap: () {
              Clipboard.setData(ClipboardData(text: value));
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text('ID copied to clipboard'),
                  backgroundColor: AppTheme.surface,
                  behavior: SnackBarBehavior.floating,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  margin: const EdgeInsets.all(16),
                ),
              );
            },
            child: const Icon(LucideIcons.copy, size: 14, color: AppTheme.textMuted),
          ),
        ],
      ],
    );
  }

  Widget _buildErrorRow(String error) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 16, 28, 16),
      child: Row(
        children: [
          const Icon(LucideIcons.triangleAlert, size: 16, color: Colors.redAccent),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              error,
              style: const TextStyle(
                fontSize: 13,
                color: Colors.redAccent,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
