import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../providers/device_provider.dart';
import '../../core/theme.dart';
import '../../widgets/snow_widgets.dart';
import '../session/session_viewer_screen.dart';

class AllDevicesScreen extends StatefulWidget {
  const AllDevicesScreen({super.key});

  @override
  State<AllDevicesScreen> createState() => _AllDevicesScreenState();
}

class _AllDevicesScreenState extends State<AllDevicesScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final deviceProvider = Provider.of<DeviceProvider>(context);
    final devices = deviceProvider.devices.where((d) {
      if (_query.isEmpty) return true;
      return d.name.toLowerCase().contains(_query.toLowerCase());
    }).toList();
    final onlineCount = deviceProvider.devices.where((d) => d.isOnline).length;

    return Container(
      color: AppTheme.background,
      child: SafeArea(
        child: Column(
          children: [
            // ── Header ────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.fromLTRB(28, 24, 24, 24),
              decoration: BoxDecoration(
                color: AppTheme.surface,
                border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.05))),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                   Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'Fleet Manager',
                              style: TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w900,
                                color: AppTheme.textPrimary,
                                letterSpacing: -0.5,
                                height: 1,
                              ),
                            ),
                            const SizedBox(height: 5),
                            Text(
                              '${deviceProvider.devices.length} nodes registered · $onlineCount online',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w500,
                                color: AppTheme.textMuted,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => deviceProvider.fetchDevices(),
                        icon: Icon(LucideIcons.refreshCw, size: 18, color: Colors.white.withOpacity(0.2)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  TextField(
                    controller: _searchController,
                    onChanged: (v) => setState(() => _query = v),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppTheme.textPrimary,
                    ),
                    decoration: InputDecoration(
                      filled: true,
                      fillColor: AppTheme.background,
                      hintText: 'Search fleet...',
                      hintStyle: const TextStyle(color: AppTheme.textMuted),
                      prefixIcon: const Icon(LucideIcons.search, size: 16, color: AppTheme.textMuted),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: const BorderSide(color: AppTheme.divider),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide(color: AppTheme.accent.withOpacity(0.5)),
                      ),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                ],
              ),
            ),

            // ── Device list ────────────────────────────────────────
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => deviceProvider.fetchDevices(),
                color: AppTheme.accent,
                backgroundColor: AppTheme.surface,
                child: deviceProvider.isLoading && deviceProvider.devices.isEmpty
                    ? const Center(child: CircularProgressIndicator(color: AppTheme.accent, strokeWidth: 2))
                    : devices.isEmpty
                        ? _buildEmptyState()
                        : ListView.builder(
                            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                            physics: const BouncingScrollPhysics(),
                            itemCount: devices.length,
                            itemBuilder: (context, index) {
                              return _buildDeviceCard(context, devices[index]);
                            },
                          ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 72,
            height: 72,
            decoration: BoxDecoration(
              color: AppTheme.surface,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(color: AppTheme.divider),
            ),
            child: const Icon(LucideIcons.monitorOff, size: 28, color: AppTheme.divider),
          ),
          const SizedBox(height: 24),
          const Text(
            'Fleet Empty',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.textPrimary),
          ),
          const SizedBox(height: 8),
          const Text(
            'Ensure your host machines are active.',
            style: TextStyle(fontSize: 13, color: AppTheme.textMuted, fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 24),
          SnowCompactButton(
            label: 'Scan Again',
            onPressed: () => Provider.of<DeviceProvider>(context, listen: false).fetchDevices(),
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceCard(BuildContext context, dynamic device) {
    final bool isOnline = device.isOnline;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      child: SnowCard(
        padding: const EdgeInsets.all(20),
        child: Row(
          children: [
            // OS icon
            Container(
              width: 50,
              height: 50,
              decoration: BoxDecoration(
                color: isOnline ? AppTheme.accent.withOpacity(0.05) : AppTheme.background,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: isOnline ? AppTheme.accent.withOpacity(0.2) : AppTheme.divider),
              ),
              child: Icon(
                _osIcon(device.osType),
                color: isOnline ? AppTheme.accent : AppTheme.textMuted,
                size: 24,
              ),
            ),
            const SizedBox(width: 16),
            // Info
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    device.name,
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w800,
                      color: isOnline ? AppTheme.textPrimary : AppTheme.textSecondary,
                      letterSpacing: -0.2,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isOnline ? AppTheme.success : AppTheme.divider,
                          boxShadow: [
                            if (isOnline)
                              BoxShadow(color: AppTheme.success.withOpacity(0.5), blurRadius: 6),
                          ],
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        isOnline ? 'Active' : 'Offline',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: isOnline ? AppTheme.success : AppTheme.textMuted,
                        ),
                      ),
                      if (device.osType != null) ...[
                        const Text('  ·  ', style: TextStyle(color: AppTheme.divider, fontSize: 12)),
                        Text(
                          device.osType,
                          style: const TextStyle(
                            fontSize: 12,
                            color: AppTheme.textMuted,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            // Action
            if (isOnline)
              SnowCompactButton(
                label: 'Connect',
                onPressed: () => Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (_) => SessionViewerScreen(
                      deviceId: device.accessKey,
                      deviceName: device.name,
                    ),
                  ),
                ),
              )
            else
              const Icon(LucideIcons.chevronRight, size: 16, color: AppTheme.divider),
          ],
        ),
      ),
    );
  }

  IconData _osIcon(String? osType) {
    if (osType == null) return LucideIcons.monitor;
    final os = osType.toLowerCase();
    if (os.contains('win')) return LucideIcons.monitor;
    if (os.contains('mac') || os.contains('ios')) return LucideIcons.smartphone;
    if (os.contains('android')) return LucideIcons.smartphone;
    if (os.contains('linux')) return LucideIcons.terminal;
    return LucideIcons.monitor;
  }
}
