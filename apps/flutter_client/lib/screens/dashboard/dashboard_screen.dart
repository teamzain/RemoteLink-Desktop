import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../providers/device_provider.dart';
import '../../core/theme.dart';
import '../session/session_viewer_screen.dart';
import '../host/host_screen.dart';
import '../../providers/auth_provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final deviceProvider = Provider.of<DeviceProvider>(context);

    return Scaffold(
      appBar: AppBar(
        title: const Text('My Devices', style: TextStyle(fontWeight: FontWeight.w900)),
        centerTitle: false,
        actions: [
          IconButton(
            icon: const Icon(Icons.broadcast_on_personal, color: AppTheme.primary),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const HostScreen()),
              );
            },
            tooltip: 'Enter Host Mode',
          ),
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => context.read<AuthProvider>().logout(),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () => deviceProvider.fetchDevices(),
        child: deviceProvider.isLoading && deviceProvider.devices.isEmpty
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: TextField(
                    decoration: InputDecoration(
                      hintText: 'Search devices...',
                      prefixIcon: const Icon(Icons.search),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                  ),
                ),
                Expanded(
                  child: deviceProvider.devices.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.devices_other, size: 64, color: AppTheme.textSecondary),
                            const SizedBox(height: 16),
                            Text('No devices found', style: Theme.of(context).textTheme.bodyLarge),
                          ],
                        ),
                      )
                    : ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: deviceProvider.devices.length,
                        separatorBuilder: (context, index) => const SizedBox(height: 16),
                        itemBuilder: (context, index) {
                          final device = deviceProvider.devices[index];
                          final bool isOnline = device.isOnline;
                          
                          return Card(
                            child: ListTile(
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              leading: Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: AppTheme.primary.withAlpha(26), // 0.1 * 255
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Icon(
                                  _getDeviceIcon(device.osType),
                                  color: AppTheme.primary,
                                  size: 20,
                                ),
                              ),
                              title: Text(
                                device.name,
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              subtitle: Row(
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    decoration: BoxDecoration(
                                      shape: BoxShape.circle,
                                      color: isOnline ? Colors.green : Colors.grey,
                                    ),
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    isOnline ? 'Online' : 'Offline',
                                    style: TextStyle(
                                      color: isOnline ? Colors.green : AppTheme.textSecondary,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                              trailing: ElevatedButton(
                                onPressed: isOnline ? () {
                                  Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (context) => SessionViewerScreen(
                                        deviceId: device.accessKey,
                                        deviceName: device.name,
                                      ),
                                    ),
                                  );
                                } : null,
                                style: ElevatedButton.styleFrom(
                                  minimumSize: const Size(80, 36),
                                  padding: const EdgeInsets.symmetric(horizontal: 12),
                                ),
                                child: const Text('Connect', style: TextStyle(fontSize: 12)),
                              ),
                            ),
                          );
                        },
                      ),
                ),
              ],
            ),
      ),
    );
  }

  IconData _getDeviceIcon(String? osType) {
    if (osType == null) return Icons.computer;
    switch (osType.toLowerCase()) {
      case 'windows': return FontAwesomeIcons.windows;
      case 'macos': return FontAwesomeIcons.apple;
      case 'linux': return FontAwesomeIcons.linux;
      case 'android': return FontAwesomeIcons.android;
      case 'ios': return Icons.phone_iphone;
      default: return Icons.computer;
    }
  }
}
