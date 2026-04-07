import React, { useEffect } from 'react';
import { View, ScrollView, StyleSheet, SafeAreaView, TouchableOpacity, Dimensions, Image, Platform } from 'react-native';
import { LayoutDashboard, Activity, ShieldCheck, Zap, Globe, ChevronRight, Monitor, Smartphone, Search, Bell, Settings, MoreVertical, LayoutGrid } from 'lucide-react-native';
import { useDeviceStore } from '../../src/stores/deviceStore';
import { useAuthStore } from '../../src/stores/authStore';
import { useHostStore } from '../../src/stores/hostStore';
import { presenceService } from '../../src/services/presenceService';
import { Text } from "@/components/Text";
import { useRouter } from 'expo-router';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function DashboardOverview() {
  const router = useRouter();
  const { devices, fetchDevices, isLoading } = useDeviceStore();
  const { user } = useAuthStore();
  const { deviceId: localDeviceId } = useHostStore();

  useEffect(() => {
    fetchDevices();
    presenceService.connect();
    return () => presenceService.disconnect();
  }, []);

  const total = devices.length;
  const online = devices.filter(d => d.isOnline).length;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.profileAvatar}>
          <Image 
            source={{ uri: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' }} 
            style={styles.avatarImage} 
          />
        </TouchableOpacity>
        <Text style={styles.headerPageTitle}>My Devices</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerActionCircle}>
            <Search size={20} color="#141718" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerActionCircle}>
            <Bell size={20} color="#141718" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Metrics Row */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false} 
          style={styles.metricsRow}
          contentContainerStyle={styles.metricsContent}
        >
          <StatCard 
            label="Total Fleet" 
            value={total.toString()} 
            trend="+11.02%" 
            isBlack={false}
            icon={<LayoutGrid size={18} color="#141718" />}
          />
          <StatCard 
            label="Online Now" 
            value={online.toString()} 
            trend="Active" 
            isBlack={true}
            icon={<Activity size={18} color="#FFFFFF" />}
          />
          <StatCard 
            label="Secure Nodes" 
            value={total.toString()} 
            trend="Protected" 
            isBlack={false}
            icon={<ShieldCheck size={18} color="#141718" />}
          />
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>ACTIVE SESSIONS</Text>
          <TouchableOpacity>
            <MoreVertical size={16} color="#8E9295" />
          </TouchableOpacity>
        </View>

        {devices.map((device) => (
          <DeviceProjectCard 
            key={device.id}
            device={device}
            isLocal={device.id === localDeviceId}
            onConnect={() => router.push({
              pathname: '/session',
              params: { 
                deviceId: device.id, 
                deviceName: device.name,
                deviceType: device.osType?.toLowerCase() || 'unknown'
              }
            })}
          />
        ))}

        {devices.length === 0 && (
          <View style={styles.emptyContainer}>
            <Monitor size={48} color="#E6E8EC" />
            <Text style={styles.emptyText}>No devices connected yet.</Text>
            <Text style={styles.emptySubtext}>Enable hosting on your other devices to see them here.</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value, trend, isBlack, icon }: any) {
  return (
    <View style={[styles.statCard, isBlack && styles.statCardBlack]}>
      <View style={styles.statHeader}>
        <Text style={[styles.statLabel, isBlack && styles.textWhite]}>{label}</Text>
        <View style={[styles.statIconContainer, isBlack && styles.statIconBlack]}>
          {icon}
        </View>
      </View>
      <View style={styles.statFooter}>
        <Text style={[styles.statValue, isBlack && styles.textWhite]}>{value}</Text>
        <View style={[styles.statTrendWrap, isBlack && styles.statTrendBlack]}>
           <Text style={[styles.statTrendText, isBlack && styles.textWhite]}>{trend}</Text>
        </View>
      </View>
    </View>
  );
}

function DeviceProjectCard({ device, isLocal, onConnect }: { device: any, isLocal: boolean, onConnect: () => void }) {
  const isWindows = device.osType?.toLowerCase() === 'windows' || device.name.toLowerCase().includes('pc');
  
  return (
    <TouchableOpacity style={styles.projectCard} onPress={onConnect}>
      <View style={styles.projectHeader}>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={styles.projectTitle} numberOfLines={1}>{device.name}</Text>
            {isLocal && (
              <View style={styles.localBadge}>
                <Text style={styles.localBadgeText}>THIS DEVICE</Text>
              </View>
            )}
          </View>
          <Text style={styles.projectDate}>ID: {device.id}</Text>
        </View>
        <View style={styles.projectLogoWrap}>
           {isWindows ? <Monitor size={22} color="#141718" /> : <Smartphone size={22} color="#141718" />}
        </View>
      </View>

      <View style={styles.projectFooter}>
        <View style={styles.avatarRow}>
          <Image source={{ uri: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sam' }} style={styles.smallAvatar} />
          <View style={[styles.statusBadge, device.isOnline ? styles.statusOnline : styles.statusOffline]}>
            <Text style={[styles.statusText, device.isOnline ? styles.textOnline : styles.textOffline]}>
              {device.isOnline ? '● Online' : '● Offline'}
            </Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
           <View style={styles.progressHeader}>
              <Text style={styles.progressCount}>98% Strength</Text>
              <Text style={styles.progressPercent}>{device.isOnline ? '100%' : '0%'}</Text>
           </View>
           <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: device.isOnline ? '100%' : '0%' }]} />
           </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 12 : 20,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#F7F8FA',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  headerPageTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#141718',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerActionCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingBottom: 20,
  },
  metricsRow: {
    flexGrow: 0,
    maxHeight: 160,
  },
  metricsContent: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 12,
  },
  statCard: {
    width: 140,
    padding: 16,
    borderRadius: 24,
    backgroundColor: '#F7F8FA',
    justifyContent: 'space-between',
  },
  statCardBlack: {
    backgroundColor: '#141718',
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#8E9295',
    flex: 1,
  },
  statIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIconBlack: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statFooter: {
    marginTop: 20,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#141718',
  },
  statTrendWrap: {
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  statTrendBlack: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  statTrendText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#141718',
  },
  textWhite: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginTop: 32,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#141718',
    letterSpacing: 2,
  },
  projectCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 24,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F1F3',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  projectHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  projectTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#141718',
    letterSpacing: -0.5,
    flexShrink: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  localBadge: {
    backgroundColor: '#141718',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  localBadgeText: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '900',
  },
  projectDate: {
    fontSize: 12,
    color: '#8E9295',
    fontWeight: '600',
    marginTop: 2,
  },
  projectLogoWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectFooter: {
    marginTop: 24,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  smallAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusOnline: {
    backgroundColor: 'rgba(76, 175, 80, 0.05)',
  },
  statusOffline: {
    backgroundColor: '#F7F8FA',
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
  },
  textOnline: {
    color: '#4CAF50',
  },
  textOffline: {
    color: '#8E9295',
  },
  progressContainer: {
    marginTop: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressCount: {
    fontSize: 11,
    color: '#8E9295',
    fontWeight: '700',
  },
  progressPercent: {
    fontSize: 11,
    color: '#141718',
    fontWeight: '800',
  },
  progressBarBg: {
    height: 6,
    backgroundColor: '#F7F8FA',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#141718',
    borderRadius: 3,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '900',
    color: '#141718',
    marginTop: 20,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 13,
    color: '#8E9295',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    fontWeight: '500',
  },
});
