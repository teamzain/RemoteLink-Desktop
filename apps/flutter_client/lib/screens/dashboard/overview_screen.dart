import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';
import 'package:lucide_icons_flutter/lucide_icons.dart';
import 'package:provider/provider.dart';
import '../../providers/device_provider.dart';
import '../../providers/session_provider.dart';
import '../../providers/host_provider.dart';
import '../../core/theme.dart';
import '../../widgets/snow_widgets.dart';

class SnowOverview extends StatelessWidget {
  const SnowOverview({super.key});

  @override
  Widget build(BuildContext context) {
    final deviceProvider = Provider.of<DeviceProvider>(context);
    final sessionProvider = Provider.of<SessionProvider>(context);
    final hostProvider = Provider.of<HostProvider>(context);

    final total = deviceProvider.devices.length;
    final online = deviceProvider.devices.where((d) => d.isOnline).length;
    final active = sessionProvider.activeSessions.length;
    final isLive = hostProvider.isHosting;

    return Container(
      color: AppTheme.background,
      child: SafeArea(
        child: CustomScrollView(
          physics: const BouncingScrollPhysics(),
          slivers: [
            // ── Header ──────────────────────────────────────────────
            SliverToBoxAdapter(
              child: _buildHeader(context, isLive),
            ),

            // ── Metric chips ─────────────────────────────────────────
            SliverToBoxAdapter(
              child: _buildMetricsRow(total, online, active),
            ),

            // ── Throughput chart ─────────────────────────────────────
            SliverToBoxAdapter(
              child: _buildThroughputSection(),
            ),

            // ── Fleet distribution ───────────────────────────────────
            SliverToBoxAdapter(
              child: _buildFleetRow(context, deviceProvider.devices),
            ),

            // ── Recent activity ──────────────────────────────────────
            SliverToBoxAdapter(
              child: _buildActivity(),
            ),

            const SliverToBoxAdapter(child: SizedBox(height: 100)),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, bool isLive) {
    return Container(
      padding: const EdgeInsets.fromLTRB(28, 24, 24, 24),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        border: Border(bottom: BorderSide(color: Colors.white.withOpacity(0.05))),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'System Overview',
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
                  isLive ? 'Broadcasting secure link' : 'P2P network standby',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: isLive ? AppTheme.success : AppTheme.textMuted,
                  ),
                ),
              ],
            ),
          ),
          if (isLive)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppTheme.success.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: AppTheme.success.withOpacity(0.2)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                   Container(
                    width: 6,
                    height: 6,
                    decoration: const BoxDecoration(
                      color: AppTheme.success,
                      shape: BoxShape.circle,
                      boxShadow: [BoxShadow(color: AppTheme.success, blurRadius: 6)],
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Text(
                    'LIVE',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: AppTheme.success,
                      letterSpacing: 1.5,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildMetricsRow(int total, int online, int active) {
    return SizedBox(
      height: 110,
      child: ListView(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
        children: [
          _metricChip('Total Fleet', total.toString(), '+3', positive: true),
          _metricChip('Online', online.toString(), '98%', positive: true),
          _metricChip('Connections', active.toString(), '+2', positive: true),
          _metricChip('Ping', '38ms', '-4ms', positive: true),
        ],
      ),
    );
  }

  Widget _metricChip(String label, String value, String trend, {required bool positive}) {
    return Container(
      margin: const EdgeInsets.only(right: 12),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: AppTheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
                Text(
                  label.toUpperCase(),
                  style: const TextStyle(
                    fontSize: 9,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.textMuted,
                    letterSpacing: 1.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.textPrimary,
                    letterSpacing: -0.5,
                    height: 1,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
            decoration: BoxDecoration(
              color: positive ? AppTheme.success.withOpacity(0.1) : Colors.red.withOpacity(0.1),
              borderRadius: BorderRadius.circular(6),
            ),
            child: Text(
              trend,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: positive ? AppTheme.success : Colors.red,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildThroughputSection() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 20, 28, 20),
      child: SnowCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'NETWORK THROUGHPUT',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.textPrimary,
                    letterSpacing: 2,
                  ),
                ),
                Icon(LucideIcons.activity, size: 14, color: AppTheme.accent.withOpacity(0.5)),
              ],
            ),
            const SizedBox(height: 32),
            SizedBox(
              height: 140,
              child: LineChart(
                LineChartData(
                  gridData: const FlGridData(show: false),
                  titlesData: const FlTitlesData(show: false),
                  borderData: FlBorderData(show: false),
                  lineBarsData: [
                    LineChartBarData(
                      spots: const [
                        FlSpot(0, 3),
                        FlSpot(2, 4.5),
                        FlSpot(4, 3.5),
                        FlSpot(6, 6),
                        FlSpot(8, 4),
                        FlSpot(10, 5),
                        FlSpot(12, 4.5),
                      ],
                      isCurved: true,
                      color: AppTheme.accent,
                      barWidth: 3,
                      isStrokeCapRound: true,
                      dotData: const FlDotData(show: false),
                      belowBarData: BarAreaData(
                        show: true,
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            AppTheme.accent.withOpacity(0.15),
                            AppTheme.accent.withOpacity(0),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFleetRow(BuildContext context, List<dynamic> devices) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(28, 12, 28, 20),
      child: SnowCard(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'FLEET DISTRIBUTION',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: AppTheme.textPrimary,
                letterSpacing: 2,
              ),
            ),
            const SizedBox(height: 24),
            SizedBox(
              height: 80,
              child: BarChart(
                BarChartData(
                  gridData: const FlGridData(show: false),
                  titlesData: const FlTitlesData(show: false),
                  borderData: FlBorderData(show: false),
                  barGroups: [
                    _bar(0, 5, AppTheme.accent),
                    _bar(1, 3, Colors.white24),
                    _bar(2, 8, AppTheme.success),
                    _bar(3, 2, AppTheme.warning),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _legend(AppTheme.accent, 'Win'),
                  const SizedBox(width: 16),
                  _legend(Colors.white24, 'App'),
                  const SizedBox(width: 16),
                  _legend(AppTheme.success, 'UX'),
                  const SizedBox(width: 16),
                  _legend(AppTheme.warning, 'IoT'),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  BarChartGroupData _bar(int x, double y, Color color) {
    return BarChartGroupData(
      x: x,
      barRods: [
        BarChartRodData(
          toY: y,
          color: color,
          width: 16,
          borderRadius: BorderRadius.circular(6),
        ),
      ],
    );
  }

  Widget _legend(Color color, String label) {
    return Row(
      children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(
          label.toUpperCase(),
          style: TextStyle(fontSize: 10, color: Colors.white.withOpacity(0.3), fontWeight: FontWeight.w800, letterSpacing: 1),
        ),
      ],
    );
  }

  Widget _buildActivity() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'LATEST EVENTS',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: Colors.white,
              letterSpacing: 2,
            ),
          ),
          const SizedBox(height: 20),
          _activityRow(LucideIcons.shieldCheck, 'Security protocol initialized', 'Just now', AppTheme.success),
          _activityRow(LucideIcons.zap, 'Fleet manager synchronized', '4m ago', AppTheme.accent),
          _activityRow(LucideIcons.globe, 'Global relay established', '12m ago', AppTheme.warning),
        ],
      ),
    );
  }

  Widget _activityRow(IconData icon, String title, String time, Color color) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: color.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, size: 16, color: color),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  time,
                  style: const TextStyle(
                    fontSize: 11,
                    color: AppTheme.textMuted,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          const Icon(LucideIcons.chevronRight, size: 14, color: AppTheme.divider),
        ],
      ),
    );
  }
}
