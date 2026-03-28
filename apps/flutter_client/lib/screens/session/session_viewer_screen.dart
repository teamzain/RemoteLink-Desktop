import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import '../../core/theme.dart';

class SessionViewerScreen extends StatefulWidget {
  final String deviceId;
  final String deviceName;

  const SessionViewerScreen({
    super.key,
    required this.deviceId,
    required this.deviceName,
  });

  @override
  State<SessionViewerScreen> createState() => _SessionViewerScreenState();
}

class _SessionViewerScreenState extends State<SessionViewerScreen> {
  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  final RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();
  final bool _isConnected = false;

  @override
  void initState() {
    super.initState();
    _initRenderers();
  }

  Future<void> _initRenderers() async {
    await _localRenderer.initialize();
    await _remoteRenderer.initialize();
  }

  @override
  void dispose() {
    _localRenderer.dispose();
    _remoteRenderer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: Text(widget.deviceName),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: Stack(
        children: [
          // Remote Video Stream
          Center(
            child: _isConnected
                ? RTCVideoView(_remoteRenderer, objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain)
                : Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const CircularProgressIndicator(),
                      const SizedBox(height: 24),
                      Text(
                        'Connecting to ${widget.deviceName}...',
                        style: const TextStyle(color: Colors.white70),
                      ),
                    ],
                  ),
          ),
          
          // Controls Overlay
          Positioned(
            bottom: 32,
            left: 0,
            right: 0,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _buildControlButton(
                  icon: Icons.keyboard_hide,
                  onPressed: () {},
                ),
                const SizedBox(width: 24),
                _buildControlButton(
                  icon: Icons.call_end,
                  color: Colors.redAccent,
                  onPressed: () => Navigator.pop(context),
                ),
                const SizedBox(width: 24),
                _buildControlButton(
                  icon: Icons.settings,
                  onPressed: () {},
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildControlButton({
    required IconData icon,
    required VoidCallback onPressed,
    Color color = AppTheme.paper,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: color.withAlpha(204), // 0.8 * 255
        shape: BoxShape.circle,
        border: Border.all(color: Colors.white10),
      ),
      child: IconButton(
        icon: Icon(icon, color: Colors.white),
        onPressed: onPressed,
        padding: const EdgeInsets.all(16),
      ),
    );
  }
}
