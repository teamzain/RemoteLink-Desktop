import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';
import '../../providers/host_provider.dart';
import '../auth/welcome_screen.dart';
import 'package:flutter/cupertino.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  String _editName = '';
  String _editEmail = '';
  bool _isBiometricEnabled = true;

  @override
  void initState() {
    super.initState();
    final auth = context.read<AuthProvider>();
    _editName = auth.user?['name'] ?? '';
    _editEmail = auth.user?['email'] ?? '';
  }

  void _handleUpdateProfile() async {
    final auth = context.read<AuthProvider>();
    await auth.updateUser(_editName, _editEmail);
    if (mounted) {
      Navigator.pop(context); // Close modal
    }
  }

  void _showModal(BuildContext context, String modalId) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return StatefulBuilder( // allows internal state to update for toggles
          builder: (BuildContext context, StateSetter setModalState) {
            return Padding(
              padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32),
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.1),
                      offset: const Offset(0, -10),
                      blurRadius: 20,
                    )
                  ],
                ),
                padding: const EdgeInsets.only(bottom: 40),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Modal Header
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      child: Column(
                        children: [
                          Container(
                            width: 40,
                            height: 4,
                            decoration: BoxDecoration(
                              color: const Color(0xFFE6E8EC),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: IconButton(
                              icon: const Icon(LucideIcons.x, size: 20, color: Color(0xFF8E9295)),
                              onPressed: () => Navigator.pop(context),
                              padding: const EdgeInsets.only(right: 20),
                            ),
                          ),
                        ],
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 28),
                      child: _buildModalContent(modalId, setModalState),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildModalContent(String modalId, StateSetter setModalState) {
    switch (modalId) {
      case 'personal':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Personal Information',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF141718), letterSpacing: -0.5),
            ),
            const SizedBox(height: 4),
            const Text(
              'Update your identity and data profile',
              style: TextStyle(fontSize: 13, color: Color(0xFF8E9295)),
            ),
            const SizedBox(height: 24),
            
            _buildInputGroup('FULL NAME', 'Enter full name', _editName, (val) => setModalState(() => _editName = val)),
            const SizedBox(height: 20),
            _buildInputGroup('EMAIL ADDRESS', 'Enter email', _editEmail, (val) => setModalState(() => _editEmail = val), isEmail: true),
            
            const SizedBox(height: 28),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: _handleUpdateProfile,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF141718),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                child: const Text('Save Changes', style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        );

      case 'security':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Security & PIN',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF141718), letterSpacing: -0.5),
            ),
            const SizedBox(height: 4),
            const Text(
              'Manage your access control preferences',
              style: TextStyle(fontSize: 13, color: Color(0xFF8E9295)),
            ),
            const SizedBox(height: 24),
            
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Biometric Unlock', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: Color(0xFF141718))),
                    SizedBox(height: 2),
                    Text('Use FaceID or Fingerprint', style: TextStyle(fontSize: 12, color: Color(0xFF8E9295))),
                  ],
                ),
                Switch(
                  value: _isBiometricEnabled,
                  onChanged: (val) => setModalState(() => _isBiometricEnabled = val),
                  activeColor: Colors.white,
                  activeTrackColor: const Color(0xFF141718),
                  inactiveThumbColor: Colors.white,
                  inactiveTrackColor: const Color(0xFFE6E8EC),
                ),
              ],
            ),
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Divider(color: Color(0x0D000000), height: 1),
            ),
            OutlinedButton.icon(
              onPressed: () {},
              icon: const Icon(LucideIcons.shield, size: 16, color: Color(0xFF141718)),
              label: const Text('Change Session PIN', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF141718))),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                side: const BorderSide(color: Color(0xFF141718)),
                minimumSize: const Size.fromHeight(50),
              ),
            ),
          ],
        );

      case 'subscription':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Subscription Plan',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF141718), letterSpacing: -0.5),
            ),
            const SizedBox(height: 24),
            
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFF7F8FA),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0x08000000)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Connect-X Pro', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w900, color: Color(0xFF141718), letterSpacing: 0.5)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(color: const Color(0x1A4CAF50), borderRadius: BorderRadius.circular(6)),
                        child: const Text('ACTIVE', style: TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFF4CAF50))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text('\$12.99 / MONTH', style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900, color: Color(0xFF141718))),
                  const SizedBox(height: 4),
                  const Text('Next billing on May 15, 2026', style: TextStyle(fontSize: 12, color: Color(0xFF8E9295))),
                  const SizedBox(height: 16),
                  
                  _buildPlanFeature('Unlimited Remote Sessions'),
                  const SizedBox(height: 8),
                  _buildPlanFeature('Ultra-Low Latency Engine'),
                  const SizedBox(height: 8),
                  _buildPlanFeature('Encrypted Control Data'),
                ],
              ),
            ),
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0x0D141718),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  elevation: 0,
                ),
                child: const Text('Upgrade Workspace', style: TextStyle(color: Color(0xFF141718), fontSize: 14, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        );

      case 'billing':
        final invoices = [
          {'date': 'Apr 15, 2026', 'amount': '\$12.99', 'id': '#INV-0294'},
          {'date': 'Mar 15, 2026', 'amount': '\$12.99', 'id': '#INV-0241'},
          {'date': 'Feb 15, 2026', 'amount': '\$12.99', 'id': '#INV-0198'},
        ];
        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Billing History',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.w900, color: Color(0xFF141718), letterSpacing: -0.5),
            ),
            const SizedBox(height: 4),
            const Text(
              'Recent invoices and statements',
              style: TextStyle(fontSize: 13, color: Color(0xFF8E9295)),
            ),
            const SizedBox(height: 24),
            
            SizedBox(
              height: 240,
              child: ListView.separated(
                itemCount: invoices.length,
                separatorBuilder: (context, index) => const Divider(color: Color(0x0D000000), height: 1),
                itemBuilder: (context, index) {
                  final inv = invoices[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(inv['id']!, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: Color(0xFF141718))),
                            const SizedBox(height: 2),
                            Text(inv['date']!, style: const TextStyle(fontSize: 11, color: Color(0xFF8E9295))),
                          ],
                        ),
                        Text(inv['amount']!, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFF141718))),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        );

      case 'about':
        return Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: const Color(0xFF141718),
                borderRadius: BorderRadius.circular(20),
              ),
              child: const Icon(LucideIcons.smartphone, size: 32, color: Colors.white),
            ),
            const SizedBox(height: 16),
            const Text('Connect-X Desktop', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: Color(0xFF141718))),
            const SizedBox(height: 4),
            const Text('Version 2.4.0 (Stable)', style: TextStyle(fontSize: 12, color: Color(0xFF8E9295))),
            const SizedBox(height: 20),
            
            const Text(
              'A professional-grade remote control infrastructure for Android and Windows environments. Built with security and performance as core pillars.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Color(0xFF8E9295), height: 1.5),
            ),
            
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 20),
              child: Divider(color: Color(0x0D000000), height: 1),
            ),
            const Text('© 2026 TechVision Connect-X. All rights reserved.', style: TextStyle(fontSize: 10, color: Color(0xFF8E9295), fontWeight: FontWeight.w500)),
          ],
        );

      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildInputGroup(String label, String hint, String value, Function(String) onChanged, {bool isEmail = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: Color(0xFF8E9295), letterSpacing: 1)),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: value,
          onChanged: onChanged,
          keyboardType: isEmail ? TextInputType.emailAddress : TextInputType.text,
          style: const TextStyle(fontSize: 15, color: Color(0xFF141718), fontWeight: FontWeight.w600),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: const TextStyle(color: Color(0xFF8E9295)),
            filled: true,
            fillColor: const Color(0xFFF7F8FA),
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0x08000000))),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0x08000000))),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0x08000000))),
          ),
        ),
      ],
    );
  }

  Widget _buildPlanFeature(String text) {
    return Row(
      children: [
        const Icon(Icons.check_circle, size: 12, color: Color(0xFF4CAF50)),
        const SizedBox(width: 8),
        Text(text, style: const TextStyle(fontSize: 12, color: Color(0xFF141718), fontWeight: FontWeight.w500)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthProvider>();
    final user = auth.user;

    return Container(
      color: AppTheme.background,
      child: SafeArea(
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _buildUserBlock(user)),
            
            SliverToBoxAdapter(
              child: _buildSection('ACCOUNT & SECURITY', [
                _RowItem(id: 'personal', icon: LucideIcons.user, label: 'Personal Information', hint: 'Identity & data profiles'),
                _RowItem(id: 'security', icon: LucideIcons.shield, label: 'Security & PIN', hint: 'Biometrics & access control'),
              ]),
            ),

            SliverToBoxAdapter(
              child: _buildSection('BILLING & WORKSPACE', [
                _RowItem(id: 'subscription', icon: LucideIcons.creditCard, label: 'Subscription Plan', hint: 'Manage your plan', badge: 'Premium'),
                _RowItem(id: 'billing', icon: LucideIcons.landmark, label: 'Billing History', hint: 'Invoices & statements'),
              ]),
            ),

            SliverToBoxAdapter(
              child: _buildSection('SYSTEM & SUPPORT', [
                _RowItem(icon: LucideIcons.bookOpen, label: 'Documentation', hint: 'API & integration guides', action: () => launchUrl(Uri.parse('https://docs.Connect-X.app'))),
                _RowItem(icon: LucideIcons.lifeBuoy, label: 'Support Hub', hint: 'Direct assistance', action: () => launchUrl(Uri.parse('mailto:support@Connect-X.app'))),
                _RowItem(id: 'about', icon: LucideIcons.info, label: 'About RemoteLink', hint: 'Version 2.4.0 — Stable'),
              ]),
            ),

            SliverToBoxAdapter(child: _buildSignOut(context)),
            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }

  Widget _buildUserBlock(dynamic user) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 32, 28, 24),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: AppTheme.surface,
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppTheme.divider),
        ),
        child: Row(
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: const Color(0xFF141718),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: const Color(0xFF141718).withOpacity(0.15), blurRadius: 10, offset: const Offset(0, 12)),
                ],
              ),
              child: const Center(child: Icon(LucideIcons.user, color: Colors.white, size: 28)),
            ),
            const SizedBox(width: 20),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user?['name'] ?? 'Connect-X Pro',
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w900, color: AppTheme.textPrimary, letterSpacing: -0.3),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user?['email'] ?? 'not signed in',
                    style: const TextStyle(fontSize: 13, color: AppTheme.textMuted, fontWeight: FontWeight.w500),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () {},
              icon: const Icon(LucideIcons.settings, size: 18, color: AppTheme.textMuted),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(String title, List<_RowItem> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(28, 24, 28, 16),
          child: Text(
            title,
            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w900, color: AppTheme.textMuted, letterSpacing: 2),
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 28),
          decoration: BoxDecoration(
            color: AppTheme.surface,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: AppTheme.divider),
          ),
          child: Column(
            children: items.asMap().entries.map((entry) {
              final isLast = entry.key == items.length - 1;
              return Column(
                children: [
                  _buildListRow(entry.value),
                  if (!isLast) const Padding(padding: EdgeInsets.only(left: 60), child: Divider(height: 1, color: Color(0x0D000000))),
                ],
              );
            }).toList(),
          ),
        ),
      ],
    );
  }

  Widget _buildListRow(_RowItem item) {
    return InkWell(
      onTap: () {
        if (item.action != null) {
          item.action!();
        } else if (item.id != null) {
          _showModal(context, item.id!);
        }
      },
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(color: const Color(0xFFF7F8FA), borderRadius: BorderRadius.circular(12)),
              child: Icon(item.icon, size: 16, color: const Color(0xFF8E9295)),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(item.label, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppTheme.textPrimary)),
                  if (item.hint != null) ...[
                    const SizedBox(height: 2),
                    Text(item.hint!, style: const TextStyle(fontSize: 11, color: AppTheme.textMuted, fontWeight: FontWeight.w500)),
                  ],
                ],
              ),
            ),
            if (item.badge != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0x0D141718),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: const Color(0x1A141718)),
                ),
                child: Text(item.badge!, style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, color: Color(0xFF141718), letterSpacing: 1)),
              ),
              const SizedBox(width: 12),
            ],
            const Icon(LucideIcons.chevronRight, size: 14, color: Color(0xFFE6E8EC)),
          ],
        ),
      ),
    );
  }

  Widget _buildSignOut(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 32, 28, 0),
      child: InkWell(
        onTap: () async {
          context.read<HostProvider>().disconnect();
          await context.read<AuthProvider>().logout();
          if (context.mounted) {
            Navigator.pushAndRemoveUntil(
              context,
              CupertinoPageRoute(builder: (_) => const WelcomeScreen()),
              (route) => false,
            );
          }
        },
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
          decoration: BoxDecoration(
            color: const Color(0x0DF44336),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0x1AF44336)),
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.logOut, size: 18, color: Color(0xFFF44336)),
              SizedBox(width: 12),
              Text('Terminate Session', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w800, color: Color(0xFFF44336), letterSpacing: 0.5)),
            ],
          ),
        ),
      ),
    );
  }
}

class _RowItem {
  final String? id;
  final IconData icon;
  final String label;
  final String? hint;
  final String? badge;
  final VoidCallback? action;

  const _RowItem({
    this.id,
    required this.icon,
    required this.label,
    this.hint,
    this.badge,
    this.action,
  });
}
