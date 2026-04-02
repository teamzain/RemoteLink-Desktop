import 'package:flutter/material.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../core/theme.dart';
import '../../providers/auth_provider.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

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
            // ── User block ────────────────────────────────────────
            SliverToBoxAdapter(
              child: _buildUserBlock(user),
            ),

            // ── Account & Security ────────────────────────────────
            SliverToBoxAdapter(
              child: _buildSection('ACCOUNT & SECURITY', [
                _RowItem(icon: LucideIcons.user, label: 'Personal Information', hint: 'Identity & data profiles'),
                _RowItem(icon: LucideIcons.shield, label: 'Security & PIN', hint: 'Biometrics & access control'),
              ]),
            ),

            // ── Billing ───────────────────────────────────────────
            SliverToBoxAdapter(
              child: _buildSection('BILLING & WORKSPACE', [
                _RowItem(
                  icon: LucideIcons.creditCard,
                  label: 'Subscription Plan',
                  hint: 'Manage your plan',
                  badge: 'Premium',
                ),
                _RowItem(icon: LucideIcons.landmark, label: 'Billing History', hint: 'Invoices & statements'),
              ]),
            ),

            // ── System & Support ──────────────────────────────────
            SliverToBoxAdapter(
              child: _buildSection('SYSTEM & SUPPORT', [
                _RowItem(icon: LucideIcons.bookOpen, label: 'Documentation', hint: 'API & integration guides'),
                _RowItem(icon: LucideIcons.lifeBuoy, label: 'Support Hub', hint: 'Direct assistance'),
                _RowItem(icon: LucideIcons.info, label: 'About RemoteLink', hint: 'Version 2.4.0 — Stable'),
              ]),
            ),

            // ── Sign out ──────────────────────────────────────────
            SliverToBoxAdapter(
              child: _buildSignOut(context),
            ),

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
            // Avatar
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [AppTheme.accent, AppTheme.accent.withOpacity(0.5)],
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(color: AppTheme.accent.withOpacity(0.3), blurRadius: 12),
                ],
              ),
              child: const Center(
                child: Icon(LucideIcons.user, color: Colors.white, size: 28),
              ),
            ),
            const SizedBox(width: 20),
            // Name & email
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user?['name'] ?? 'RemoteLink Pro',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                      color: AppTheme.textPrimary,
                      letterSpacing: -0.3,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    user?['email'] ?? 'not signed in',
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.textMuted,
                      fontWeight: FontWeight.w500,
                    ),
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
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: AppTheme.textMuted,
              letterSpacing: 2,
            ),
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
                  if (!isLast)
                    const Padding(
                      padding: EdgeInsets.only(left: 60),
                      child: Divider(height: 1),
                    ),
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
      onTap: () {},
      borderRadius: BorderRadius.circular(20),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: AppTheme.surfaceAccent,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(item.icon, size: 16, color: AppTheme.textMuted),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    item.label,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppTheme.textPrimary,
                    ),
                  ),
                  if (item.hint != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      item.hint!,
                      style: const TextStyle(
                        fontSize: 11,
                        color: AppTheme.textMuted,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (item.badge != null) ...[
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.accent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppTheme.accent.withOpacity(0.2)),
                ),
                child: Text(
                  item.badge!,
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.accent,
                    letterSpacing: 1,
                  ),
                ),
              ),
              const SizedBox(width: 12),
            ],
            const Icon(LucideIcons.chevronRight, size: 14, color: AppTheme.divider),
          ],
        ),
      ),
    );
  }

  Widget _buildSignOut(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 32, 28, 0),
      child: InkWell(
        onTap: () => context.read<AuthProvider>().logout(),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
          decoration: BoxDecoration(
            color: Colors.red.withOpacity(0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.red.withOpacity(0.1)),
          ),
          child: const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(LucideIcons.logOut, size: 18, color: Colors.redAccent),
              SizedBox(width: 12),
              Text(
                'Terminate Session',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: Colors.redAccent,
                  letterSpacing: 0.5,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _RowItem {
  final IconData icon;
  final String label;
  final String? hint;
  final String? badge;

  const _RowItem({
    required this.icon,
    required this.label,
    this.hint,
    this.badge,
  });
}
