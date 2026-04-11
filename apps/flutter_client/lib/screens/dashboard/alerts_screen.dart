import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../core/theme.dart';
import '../../providers/notification_provider.dart';

class AlertsScreen extends StatelessWidget {
  const AlertsScreen({super.key});

  Widget _getIcon(String type) {
    switch (type) {
      case 'SECURITY':
        return const Icon(LucideIcons.shield, size: 18, color: Colors.red);
      case 'SYSTEM':
        return const Icon(LucideIcons.zap, size: 18, color: Colors.blue);
      case 'BILLING':
        return const Icon(LucideIcons.creditCard, size: 18, color: Colors.orange);
      default:
        return const Icon(LucideIcons.bellOff, size: 18, color: AppTheme.textMuted);
    }
  }

  Color _getStatusColor(String type) {
    switch (type) {
      case 'SECURITY':
        return Colors.red.withOpacity(0.1);
      case 'SYSTEM':
        return Colors.blue.withOpacity(0.1);
      case 'BILLING':
        return Colors.orange.withOpacity(0.1);
      default:
        return AppTheme.textMuted.withOpacity(0.1);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = context.watch<NotificationProvider>();
    final notifications = store.notifications;

    return SafeArea(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Container(
            padding: const EdgeInsets.fromLTRB(28, 24, 24, 24),
            decoration: const BoxDecoration(
              color: AppTheme.surface,
              border: Border(bottom: BorderSide(color: AppTheme.divider)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Alerts',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.w900,
                          color: AppTheme.textPrimary,
                          letterSpacing: -0.5,
                          height: 1,
                        ),
                      ),
                      SizedBox(height: 5),
                      Text(
                        'System notifications & security',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                          color: AppTheme.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                if (notifications.isNotEmpty)
                  IconButton(
                    icon: const Icon(LucideIcons.trash2, size: 18, color: AppTheme.textMuted),
                    onPressed: store.clearAll,
                    style: IconButton.styleFrom(
                      backgroundColor: AppTheme.background,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
              ],
            ),
          ),
          
          Expanded(
            child: notifications.isEmpty
                ? _buildEmptyState()
                : ListView.builder(
                    padding: const EdgeInsets.all(24),
                    itemCount: notifications.length,
                    itemBuilder: (context, index) {
                      final notif = notifications[index];
                      return GestureDetector(
                        onTap: () => store.markAsRead(notif.id),
                        child: Container(
                          margin: const EdgeInsets.only(bottom: 16),
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppTheme.surface,
                            borderRadius: BorderRadius.circular(24),
                            border: Border.all(
                              color: notif.isRead 
                                  ? AppTheme.divider 
                                  : AppTheme.textMuted.withOpacity(0.2),
                            ),
                            boxShadow: notif.isRead ? null : [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.05),
                                offset: const Offset(0, 4),
                                blurRadius: 10,
                              )
                            ],
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: _getStatusColor(notif.type),
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: Center(child: _getIcon(notif.type)),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Expanded(
                                          child: Text(
                                            notif.title,
                                            style: const TextStyle(
                                              fontSize: 15,
                                              fontWeight: FontWeight.w800,
                                              color: AppTheme.textPrimary,
                                            ),
                                          ),
                                        ),
                                        Text(
                                          notif.timestamp,
                                          style: const TextStyle(
                                            fontSize: 11,
                                            fontWeight: FontWeight.w500,
                                            color: AppTheme.textMuted,
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      notif.message,
                                      style: const TextStyle(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w500,
                                        color: AppTheme.textMuted,
                                        height: 1.3,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              if (!notif.isRead) ...[
                                const SizedBox(width: 8),
                                Container(
                                  margin: const EdgeInsets.only(top: 6),
                                  width: 8,
                                  height: 8,
                                  decoration: const BoxDecoration(
                                    color: Colors.blue,
                                    shape: BoxShape.circle,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 64,
            height: 64,
            margin: const EdgeInsets.only(bottom: 20),
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: AppTheme.divider),
            ),
            child: const Icon(LucideIcons.bellOff, size: 26, color: AppTheme.textMuted),
          ),
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
            'Connect-X is running normally.',
            style: TextStyle(
              fontSize: 13,
              color: AppTheme.textMuted,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 100),
        ],
      ),
    );
  }
}
