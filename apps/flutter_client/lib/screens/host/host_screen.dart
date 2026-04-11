import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import '../../providers/host_provider.dart';

class HostScreen extends StatefulWidget {
  const HostScreen({super.key});

  @override
  State<HostScreen> createState() => _HostScreenState();
}

class _HostScreenState extends State<HostScreen> {
  bool _isStarting = false;
  bool _isSettingPassword = false;
  final TextEditingController _passwordController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final host = context.read<HostProvider>();
      host.checkAccessibilityStatus();
      host.checkBatteryOptimization();
    });
  }
  
  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  void _handleStartHosting(HostProvider host) async {
    if (_isStarting) return;
    setState(() => _isStarting = true);
    try {
      await host.startHosting();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Host Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isStarting = false);
    }
  }

  void _handleSetPassword(HostProvider host) async {
    final password = _passwordController.text.trim();
    if (password.isEmpty || _isSettingPassword) return;
    
    setState(() => _isSettingPassword = true);
    try {
      await host.setHostPassword(password);
      _passwordController.clear();
      if (mounted) {
        FocusScope.of(context).unfocus();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Security PIN set successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('PIN Error: $e')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSettingPassword = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<HostProvider>(
      builder: (context, host, _) {
        final isLive = host.isHosting;

        if (isLive) {
          return _buildLiveState(context, host);
        }

        return _buildSetupState(context, host);
      },
    );
  }

  Widget _buildLiveState(BuildContext context, HostProvider host) {
    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              color: Colors.white,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.circle, size: 8, color: Colors.green),
                          SizedBox(width: 8),
                          Text('LIVE', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 12)),
                        ],
                      ),
                      IconButton(
                        onPressed: host.disconnect,
                        icon: const Icon(Icons.power_settings_new, color: Colors.red),
                      ),
                    ],
                  ),
                  const Text('Broadcasting', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
                  const Text('Your screen is shared.', style: TextStyle(color: Colors.grey)),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.all(24),
                children: [
                  _infoRow('Host ID', host.sessionId ?? '— — —', canCopy: true),
                  if (host.error != null) ...[
                    const SizedBox(height: 20),
                    Text(host.error ?? '', style: const TextStyle(color: Colors.red, fontSize: 13, fontWeight: FontWeight.bold)),
                  ]
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSetupState(BuildContext context, HostProvider host) {
    final step1Done = host.isAccessibilityEnabled;
    final step2Done = host.isPasswordSet;

    return Scaffold(
      backgroundColor: const Color(0xFFF7F8FA),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.all(24),
          children: [
            const Text('Host Setup', style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900)),
            const SizedBox(height: 24),

            // STEP 1 - PERMISSIONS
            _card(
              done: step1Done,
              title: 'Step 1: Permissions',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(child: _permissionItem('Accessibility', step1Done, host.openAccessibilitySettings)),
                      if (!step1Done) TextButton(
                        onPressed: () => _showRestrictedHelp(context, host),
                        child: const Text('Blocked?', style: TextStyle(color: Colors.blue, fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                  _permissionItem('Battery Optimization', host.hasIgnoreBatteryOptimization, host.requestBatteryOptimizationExemption),
                  if (step1Done) ...[
                    const Divider(height: 32),
                    _infoRow('Host ID', host.sessionId ?? 'Registering...', canCopy: true),
                  ]
                ],
              ),
            ),
            const SizedBox(height: 16),

            // STEP 2 - SECURITY
            _card(
              done: step2Done,
              title: 'Step 2: Security PIN',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Enter a 4-digit PIN for remote access.', style: TextStyle(fontSize: 13, color: Colors.grey)),
                  const SizedBox(height: 16),
                  // VERTICAL LAYOUT TO PREVENT INFINITE WIDTH ERRORS
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      hintText: '4-digit PIN',
                      border: OutlineInputBorder(),
                      contentPadding: EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    ),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: (host.sessionId == null || _isSettingPassword) ? null : () => _handleSetPassword(host),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: _isSettingPassword 
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                      : const Text('Set Security PIN'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // STEP 3 - START
            _card(
              done: false,
              title: 'Step 3: Start',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text('Start your host session.', style: TextStyle(fontSize: 13, color: Colors.grey)),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: (step1Done && step2Done && !_isStarting) ? () => _handleStartHosting(host) : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.black,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: _isStarting 
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Text('Start Hosting', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
            if (host.error != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                color: Colors.red.withOpacity(0.1),
                child: Text(host.error ?? '', style: const TextStyle(color: Colors.red, fontSize: 13, fontWeight: FontWeight.bold)),
              ),
            ]
          ],
        ),
      ),
    );
  }

  Widget _card({required bool done, required String title, required Widget child}) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: done ? Colors.green.withOpacity(0.3) : const Color(0xFFE6E8EC)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(done ? Icons.check_circle : Icons.radio_button_unchecked, color: done ? Colors.green : Colors.grey),
              const SizedBox(width: 8),
              Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 16),
          child,
        ],
      ),
    );
  }

  Widget _permissionItem(String label, bool granted, VoidCallback onEnable) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
          granted 
            ? const Icon(Icons.check, size: 20, color: Colors.green)
            : TextButton(onPressed: onEnable, child: const Text('Enable')),
        ],
      ),
    );
  }

  Widget _infoRow(String label, String value, {bool canCopy = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(value, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 15, fontFamily: 'monospace')),
            if (canCopy) 
              IconButton(onPressed: () => Clipboard.setData(ClipboardData(text: value)), icon: const Icon(Icons.copy, size: 16, color: Colors.grey)),
          ],
        ),
      ],
    );
  }

  void _showRestrictedHelp(BuildContext context, HostProvider host) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        title: Row(
          children: [
            Icon(LucideIcons.shieldAlert, color: Colors.orange),
            const SizedBox(width: 12),
            const Text('Restricted Setting?', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 18)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Android 13+ restricts some permissions for sideloaded apps. This is a security feature that cannot be automated. To enable "Use Remotely", please follow these steps:',
              style: TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 16),
            _helpStep(1, 'Tap "Unlock Now" below to open App Info.'),
            _helpStep(2, 'Tap the "Three Dots" (⋮) in the top right.'),
            _helpStep(3, 'Select "Allow restricted settings" and confirm.'),
            _helpStep(4, 'Return to this app and enable Accessibility.'),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              host.openAppSettings();
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.black, foregroundColor: Colors.white),
            child: const Text('Unlock Now'),
          ),
        ],
      ),
    );
  }

  Widget _helpStep(int num, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('$num. ', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.black)),
          Expanded(child: Text(text, style: const TextStyle(color: Colors.black87, fontSize: 12))),
        ],
      ),
    );
  }
}
