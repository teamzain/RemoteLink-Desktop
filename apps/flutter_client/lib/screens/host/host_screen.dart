import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../providers/host_provider.dart';
import '../../core/theme.dart';

class HostScreen extends StatefulWidget {
  const HostScreen({super.key});

  @override
  State<HostScreen> createState() => _HostScreenState();
}

class _HostScreenState extends State<HostScreen> {
  final TextEditingController _passwordController = TextEditingController();
  bool _isPasswordVisible = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final hostProvider = context.read<HostProvider>();
      hostProvider.registerDevice();
      hostProvider.checkAccessibilityStatus();
    });
  }

  @override
  void dispose() {
    _passwordController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Host Mode'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Consumer<HostProvider>(
        builder: (context, hostProvider, child) {
          return SingleChildScrollView(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                const SizedBox(height: 40),
                _buildStatusIndicator(hostProvider),
                const SizedBox(height: 32),
                if (hostProvider.sessionId != null)
                  _buildAccessKeySection(hostProvider.sessionId!),
                const SizedBox(height: 32),
                _buildControlSection(context, hostProvider),
                const SizedBox(height: 32),
                _buildSecuritySection(context, hostProvider),
                const SizedBox(height: 32),
                _buildHostControls(context, hostProvider),
                const SizedBox(height: 32),
                if (hostProvider.error != null)
                  _buildErrorSection(hostProvider.error!),
                const SizedBox(height: 40),
                _buildInfoCard(),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatusIndicator(HostProvider hostProvider) {
    final bool isHosting = hostProvider.isHosting;
    return Column(
      children: [
        Container(
          width: 120,
          height: 120,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: (isHosting ? AppTheme.primary : Colors.grey[800])!.withAlpha(30),
            border: Border.all(
              color: (isHosting ? AppTheme.primary : Colors.grey[700])!,
              width: 2,
            ),
          ),
          child: Icon(
            isHosting ? Icons.broadcast_on_personal : Icons.portable_wifi_off,
            size: 48,
            color: isHosting ? AppTheme.primary : Colors.grey[500],
          ),
        ),
        const SizedBox(height: 24),
        Text(
          isHosting ? 'Broadcasting Screen' : 'Host Mode Disabled',
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          isHosting ? 'Your screen is being shared' : 'Enable hosting to connect from other devices',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 16,
            color: Colors.white.withAlpha(150),
          ),
        ),
      ],
    );
  }

  Widget _buildAccessKeySection(String key) {
    // Format the 9-digit key into 3x3
    final formatted = '${key.substring(0, 3)} ${key.substring(3, 6)} ${key.substring(6, 9)}';
    
    return Column(
      children: [
        const Text(
          'ACCESS KEY',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w900,
            letterSpacing: 2.0,
            color: AppTheme.primary,
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
          decoration: BoxDecoration(
            color: AppTheme.paper,
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: AppTheme.divider),
          ),
          child: Text(
            formatted,
            style: const TextStyle(
              fontSize: 36,
              fontWeight: FontWeight.w900,
              letterSpacing: 4.0,
              color: Colors.white,
            ),
          ),
        ),
        const SizedBox(height: 16),
        Text(
          'Enter this code on your RemoteLink Desktop app to connect',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, color: Colors.white.withAlpha(150)),
        ),
      ],
    );
  }
  Widget _buildControlSection(BuildContext context, HostProvider hostProvider) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.paper,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.touch_app_outlined, color: AppTheme.primary, size: 20),
              SizedBox(width: 12),
              Text(
                'Remote Control',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Control Service',
                style: TextStyle(fontSize: 14, color: Colors.grey),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: hostProvider.isAccessibilityEnabled ? Colors.green.withAlpha(50) : Colors.orange.withAlpha(50),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  hostProvider.isAccessibilityEnabled ? 'ACTIVE' : 'INACTIVE',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: hostProvider.isAccessibilityEnabled ? Colors.green : Colors.orange,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (!hostProvider.isAccessibilityEnabled)
            const Text(
              'Required to control this phone from your Desktop/Web app.',
              style: TextStyle(fontSize: 12, color: Colors.white70),
            ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => hostProvider.openAccessibilitySettings(),
              style: ElevatedButton.styleFrom(
                backgroundColor: hostProvider.isAccessibilityEnabled ? Colors.white.withAlpha(10) : AppTheme.primary.withAlpha(30),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: Text(hostProvider.isAccessibilityEnabled ? 'Refresh Connection' : 'Enable Remote Control'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSecuritySection(BuildContext context, HostProvider hostProvider) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppTheme.paper,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppTheme.divider),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.lock_outline, color: AppTheme.primary, size: 20),
              SizedBox(width: 12),
              Text(
                'Security',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          const Text(
            'Access Password',
            style: TextStyle(fontSize: 14, color: Colors.grey),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _passwordController,
            obscureText: !_isPasswordVisible,
            style: const TextStyle(color: Colors.white),
            decoration: InputDecoration(
              hintText: 'Enter access password',
              hintStyle: TextStyle(color: Colors.white.withAlpha(50)),
              filled: true,
              fillColor: Colors.black.withAlpha(50),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide.none,
              ),
              suffixIcon: IconButton(
                icon: Icon(
                  _isPasswordVisible ? Icons.visibility_off : Icons.visibility,
                  color: Colors.grey,
                ),
                onPressed: () {
                  setState(() {
                    _isPasswordVisible = !_isPasswordVisible;
                  });
                },
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () async {
                if (_passwordController.text.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Password cannot be empty')),
                  );
                  return;
                }
                try {
                  await hostProvider.setHostPassword(_passwordController.text);
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Password updated successfully')),
                    );
                  }
                } catch (e) {
                  if (context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Failed to update password: $e')),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white.withAlpha(20),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('Update Password'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHostControls(BuildContext context, HostProvider hostProvider) {
    return ElevatedButton(
      onPressed: () {
        if (hostProvider.isHosting) {
          hostProvider.stopHosting();
        } else {
          hostProvider.startHosting().catchError((e) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Failed to start hosting: $e')),
              );
            }
          });
        }
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: hostProvider.isHosting ? Colors.redAccent : AppTheme.primary,
        padding: const EdgeInsets.symmetric(vertical: 20),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(hostProvider.isHosting ? Icons.stop : Icons.play_arrow),
          const SizedBox(width: 12),
          Text(
            hostProvider.isHosting ? 'STOP HOSTING' : 'START HOSTING',
            style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorSection(String error) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.red.withAlpha(20),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.red.withAlpha(50)),
      ),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.error_outline, color: Colors.red, size: 20),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  error,
                  style: const TextStyle(color: Colors.red, fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          const Text(
            'Target: http://192.168.2.2:3001',
            style: TextStyle(color: Colors.red, fontSize: 10, fontStyle: FontStyle.italic),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: AppTheme.paper,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppTheme.divider),
      ),
      child: Column(
        children: [
          const Row(
            children: [
              Icon(Icons.info_outline, color: AppTheme.primary, size: 24),
              SizedBox(width: 12),
              Text(
                'How it works',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          _buildInfoRow(Icons.security, 'Your data is encrypted end-to-end.'),
          _buildInfoRow(Icons.bolt, 'Low-latency streaming over WebRTC.'),
          _buildInfoRow(Icons.devices, 'Compatible with Desktop and Web apps.'),
        ],
      ),
    );
  }

  Widget _buildInfoRow(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12.0),
      child: Row(
        children: [
          Icon(icon, size: 16, color: Colors.white.withAlpha(100)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              text,
              style: TextStyle(
                fontSize: 14,
                color: Colors.white.withAlpha(150),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
