import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../providers/session_provider.dart';
import '../../core/theme.dart';
import '../../widgets/snow_widgets.dart';

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
  final RTCVideoRenderer _remoteRenderer = RTCVideoRenderer();
  final GlobalKey _videoKey = GlobalKey();

  bool _showControls = true;
  bool _showKeyboard = false;
  Timer? _hideTimer;
  Offset? _cursorPos; // Remote cursor position

  final TextEditingController _keyboardController = TextEditingController();
  final FocusNode _keyboardFocus = FocusNode();

  // Gesture tracking
  DateTime _lastMoveTime = DateTime.now();
  static const _throttleMs = 16;

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
    _initRenderer();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SessionProvider>().connectToSession(widget.deviceId);
    });
    _scheduleHideControls();
  }

  Future<void> _initRenderer() async {
    await _remoteRenderer.initialize();
  }

  void _scheduleHideControls() {
    _hideTimer?.cancel();
    _hideTimer = Timer(const Duration(seconds: 4), () {
      if (mounted && !_showKeyboard) setState(() => _showControls = false);
    });
  }

  void _toggleControls() {
    setState(() => _showControls = !_showControls);
    if (_showControls) _scheduleHideControls();
  }

  @override
  void dispose() {
    _hideTimer?.cancel();
    SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
    SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    _remoteRenderer.dispose();
    _keyboardController.dispose();
    _keyboardFocus.dispose();
    super.dispose();
  }

  // ------- coordinate normalization with letterbox correction -------

  Offset? _normalize(Offset localPos) {
    final ctx = _videoKey.currentContext;
    if (ctx == null) return null;

    final box = ctx.findRenderObject() as RenderBox;
    final containerW = box.size.width;
    final containerH = box.size.height;

    final videoW = _remoteRenderer.videoWidth.toDouble();
    final videoH = _remoteRenderer.videoHeight.toDouble();

    double offsetX = 0, offsetY = 0;
    double actualW = containerW, actualH = containerH;

    if (videoW > 0 && videoH > 0) {
      final cRatio = containerW / containerH;
      final vRatio = videoW / videoH;
      if (cRatio > vRatio) {
        actualH = containerH;
        actualW = containerH * vRatio;
        offsetX = (containerW - actualW) / 2;
      } else {
        actualW = containerW;
        actualH = containerW / vRatio;
        offsetY = (containerH - actualH) / 2;
      }
    }

    final x = ((localPos.dx - offsetX) / actualW).clamp(0.0, 1.0);
    final y = ((localPos.dy - offsetY) / actualH).clamp(0.0, 1.0);
    return Offset(x, y);
  }

  // ------- input senders -------

  void _sendMove(SessionProvider session, Offset pos) {
    final now = DateTime.now();
    if (now.difference(_lastMoveTime).inMilliseconds < _throttleMs) return;
    _lastMoveTime = now;
    final c = _normalize(pos);
    if (c != null) {
      setState(() => _cursorPos = pos);
      session.sendInputEvent({'type': 'mousemove', 'x': c.dx, 'y': c.dy, 'button': 0});
    }
  }

  void _sendButton(SessionProvider session, Offset pos, String type, int button) {
    final c = _normalize(pos);
    if (c != null) session.sendInputEvent({'type': type, 'x': c.dx, 'y': c.dy, 'button': button});
  }

  void _sendClick(SessionProvider session, Offset pos, int button) {
    setState(() => _cursorPos = pos);
    _sendButton(session, pos, 'mousedown', button);
    Future.delayed(const Duration(milliseconds: 50),
        () => _sendButton(session, pos, 'mouseup', button));
  }

  // ------- build -------

  @override
  Widget build(BuildContext context) {
    return Consumer<SessionProvider>(
      builder: (context, session, _) {
        if (session.remoteStream != null && 
            _remoteRenderer.srcObject != session.remoteStream) {
          debugPrint('[Viewer] Attaching remote stream to renderer (ID: ${session.remoteStream!.id})');
          _remoteRenderer.srcObject = session.remoteStream;
        }

        return Scaffold(
          resizeToAvoidBottomInset: false,
          backgroundColor: Colors.black,
          body: Stack(
            children: [
              // ── Video layer ──
              _buildVideoLayer(session),
              // ── Touch/gesture input ──
              if (session.isConnected) _buildInputLayer(session),
              // ── Remote Software Cursor ──
              if (_cursorPos != null && session.isConnected)
                Positioned(
                  left: _cursorPos!.dx - 4,
                  top: _cursorPos!.dy - 4,
                  child: IgnorePointer(
                    child: Container(
                      width: 8, height: 8,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(color: Colors.black.withOpacity(0.5), blurRadius: 4, spreadRadius: 1),
                          BoxShadow(color: AppTheme.accent.withOpacity(0.5), blurRadius: 10),
                        ],
                      ),
                    ),
                  ),
                ),
              // ── Top controls overlay ──
              Positioned(
                top: 0, left: 0, right: 0,
                child: AnimatedOpacity(
                  opacity: _showControls ? 1.0 : 0.0,
                  duration: const Duration(milliseconds: 200),
                  child: IgnorePointer(
                    ignoring: !_showControls,
                    child: _buildTopBar(context, session),
                  ),
                ),
              ),
              // ── Virtual keyboard ──
              if (_showKeyboard) _buildKeyboardPanel(session),
              // ── Status pill (visible when controls hidden) ──
              if (!_showControls && !_showKeyboard)
                _buildStatusPill(session),
            ],
          ),
        );
      },
    );
  }

  // ------- layers -------

  Widget _buildVideoLayer(SessionProvider session) {
    if (!session.isConnected || session.remoteStream == null) {
      return _buildConnecting(session);
    }
    return Positioned.fill(
      child: InteractiveViewer(
        maxScale: 5.0,
        minScale: 1.0,
        panEnabled: true,
        scaleEnabled: true,
        child: RTCVideoView(
          key: _videoKey,
          _remoteRenderer,
          objectFit: RTCVideoViewObjectFit.RTCVideoViewObjectFitContain,
          placeholderBuilder: (_) => const ColoredBox(color: Colors.black),
        ),
      ),
    );
  }

  Widget _buildConnecting(SessionProvider session) {
    return Container(
      color: AppTheme.background,
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (session.error != null) ...[
              Container(
                margin: const EdgeInsets.symmetric(horizontal: 40),
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(
                  color: Colors.red.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(24),
                  border: Border.all(color: Colors.red.withOpacity(0.1)),
                ),
                child: Column(children: [
                   Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.red.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(LucideIcons.circleAlert, color: Colors.redAccent, size: 24),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    session.error!.toUpperCase(),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                        color: Colors.redAccent, fontSize: 11,
                        fontWeight: FontWeight.w900, letterSpacing: 1),
                  ),
                ]),
              ),
              const SizedBox(height: 32),
              SnowCompactButton(
                label: 'RETRY CONNECTION',
                onPressed: () => session.connectToSession(widget.deviceId),
              ),
            ] else ...[
              // Orbital Cinematic Loader
              SizedBox(
                width: 100, height: 100,
                child: Stack(alignment: Alignment.center, children: [
                  Container(width: 100, height: 100,
                      decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withOpacity(0.03)))),
                  Container(width: 70, height: 70,
                      decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white.withOpacity(0.05)))),
                  const SizedBox(
                    width: 32, height: 32,
                    child: CircularProgressIndicator(
                        color: AppTheme.accent, strokeWidth: 3),
                  ),
                ]),
              ),
              const SizedBox(height: 32),
              Text(
                'ESTABLISHING ENCRYPTED LINK',
                style: TextStyle(
                    color: Colors.white.withOpacity(0.2),
                    fontSize: 10, fontWeight: FontWeight.w900, letterSpacing: 3),
              ),
              const SizedBox(height: 8),
              Text(
                widget.deviceName.toUpperCase(),
                style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14, fontWeight: FontWeight.w900, letterSpacing: 1),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildInputLayer(SessionProvider session) {
    return Positioned.fill(
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        // single tap → left click; also toggles controls
        onTapUp: (d) {
          _toggleControls();
          _sendClick(session, d.localPosition, 0);
        },
        // long press → right click
        onLongPressStart: (d) {
          HapticFeedback.mediumImpact();
          _sendClick(session, d.localPosition, 2);
        },
        // scale handles both 1-finger drag and 2-finger scroll
        onScaleUpdate: (d) {
          if (d.pointerCount >= 2) {
            // 2-finger → vertical scroll
            final dy = -d.focalPointDelta.dy * 3.0;
            if (dy.abs() > 0.3) {
              session.sendInputEvent(
                  {'type': 'wheel', 'deltaX': 0.0, 'deltaY': dy});
            }
          } else {
            // 1-finger → mouse move
            _sendMove(session, d.localFocalPoint);
          }
        },
      ),
    );
  }

  // ------- top bar -------

  Widget _buildTopBar(BuildContext context, SessionProvider session) {
    return Positioned(
      top: 12, left: 16, right: 16,
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            // Minimal back button
            _iconBtn(LucideIcons.chevronLeft, () {
              session.disconnect();
              Navigator.pop(context);
            }),
            const Spacer(),
            // Glass Capsule
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              decoration: BoxDecoration(
                color: AppTheme.surface.withOpacity(0.8),
                borderRadius: BorderRadius.circular(30),
                border: Border.all(color: Colors.white.withOpacity(0.05)),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.4), blurRadius: 20, offset: const Offset(0, 8))
                ],
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 8, height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: session.isConnected ? AppTheme.success : AppTheme.warning,
                      boxShadow: [
                        if (session.isConnected) BoxShadow(color: AppTheme.success.withOpacity(0.5), blurRadius: 6),
                      ],
                    ),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    widget.deviceName.toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white, fontSize: 11, fontWeight: FontWeight.w900, letterSpacing: 1.5
                    ),
                  ),
                  const SizedBox(width: 20),
                  _iconBtnInner(LucideIcons.keyboard, () => setState(() {
                    _showKeyboard = !_showKeyboard;
                    if (_showKeyboard) {
                      _hideTimer?.cancel();
                      WidgetsBinding.instance.addPostFrameCallback((_) => _keyboardFocus.requestFocus());
                    } else {
                      _scheduleHideControls();
                    }
                  }), active: _showKeyboard),
                  const SizedBox(width: 12),
                  _iconBtnInner(LucideIcons.refreshCw, () => session.sendInputEvent({'type': 'request-keyframe'})),
                ],
              ),
            ),
            const Spacer(),
            // Tools
            _iconBtn(LucideIcons.ellipsis, () {}),
          ],
        ),
      ),
    );
  }

  Widget _iconBtnInner(IconData icon, VoidCallback onTap, {bool active = false}) {
    return GestureDetector(
      onTap: onTap,
      child: Icon(icon, 
          size: 18, 
          color: active ? AppTheme.accent : Colors.white.withOpacity(0.3)),
    );
  }

  Widget _iconBtn(IconData icon, VoidCallback onTap, {bool active = false}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 44, height: 44,
        decoration: BoxDecoration(
          color: AppTheme.surface.withOpacity(0.6),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: active ? AppTheme.accent.withOpacity(0.3) : Colors.white.withOpacity(0.05),
          ),
        ),
        child: Icon(icon,
            size: 18,
            color: active ? AppTheme.accent : Colors.white.withOpacity(0.5)),
      ),
    );
  }

  Widget _shortcutBtn(String label, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 7),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.08),
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: Colors.white.withOpacity(0.1)),
        ),
        child: Text(label,
            style: const TextStyle(
                color: Colors.white, fontSize: 9,
                fontWeight: FontWeight.w900, letterSpacing: 0.5)),
      ),
    );
  }

  Widget _pillBtn(String label, IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFF6366F1),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: Colors.white),
          const SizedBox(width: 8),
          Text(label,
              style: const TextStyle(
                  color: Colors.white, fontWeight: FontWeight.w900,
                  fontSize: 12, letterSpacing: 0.5)),
        ]),
      ),
    );
  }

  // ------- keyboard panel -------

  Widget _buildKeyboardPanel(SessionProvider session) {
    return Positioned(
      bottom: 0, left: 0, right: 0,
      child: Container(
        color: AppTheme.bottomNavBackground,
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05))),
        ),
        child: SafeArea(
          top: false,
          child: Row(children: [
            Expanded(
              child: TextField(
                controller: _keyboardController,
                focusNode: _keyboardFocus,
                autofocus: true,
                style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w600),
                decoration: InputDecoration(
                  hintText: 'Inject keystrokes...',
                  hintStyle: TextStyle(color: Colors.white.withOpacity(0.2)),
                  filled: true,
                  fillColor: Colors.white.withOpacity(0.03),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: Colors.white.withOpacity(0.05)),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: BorderSide(color: AppTheme.accent.withOpacity(0.5)),
                  ),
                ),
                onChanged: (text) {
                  if (text.isEmpty) return;
                  session.sendInputEvent({'type': 'typeText', 'text': text});
                  _keyboardController.clear();
                },
                onSubmitted: (text) {
                  if (text.isNotEmpty) {
                    session.sendInputEvent({'type': 'typeText', 'text': text});
                    _keyboardController.clear();
                  }
                },
                textInputAction: TextInputAction.send,
              ),
            ),
            const SizedBox(width: 12),
            _iconBtn(LucideIcons.x, () {
              setState(() => _showKeyboard = false);
              _keyboardFocus.unfocus();
              _scheduleHideControls();
            }),
          ]),
        ),
      ),
    );
  }

  // ------- status pill -------

  Widget _buildStatusPill(SessionProvider session) {
    return Positioned(
      bottom: 20, left: 0, right: 0,
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.6),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withOpacity(0.05)),
          ),
          child: Row(mainAxisSize: MainAxisSize.min, children: [
            Container(
              width: 6, height: 6,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: session.isConnected ? AppTheme.success : AppTheme.warning,
                boxShadow: [
                  if (session.isConnected) BoxShadow(color: AppTheme.success.withOpacity(0.5), blurRadius: 4),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Text(
              session.isConnected
                  ? 'DTLS-SRTP ENCRYPTED LINK'
                  : 'SYNCHRONIZING...',
              style: TextStyle(
                  color: Colors.white.withOpacity(0.3),
                  fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 1.5),
            ),
          ]),
        ),
      ),
    );
  }
}
