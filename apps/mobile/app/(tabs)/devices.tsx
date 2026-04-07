import React, { useState, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView, FlatList, TextInput, TouchableOpacity, RefreshControl, Dimensions, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Search, RefreshCw, Monitor, Smartphone, Terminal, MonitorOff, ChevronRight } from 'lucide-react-native';
import { useDeviceStore, Device } from '../../src/stores/deviceStore';
import { Text } from "@/components/Text";

export default function FleetManager() {
  const router = useRouter();
  const { devices, fetchDevices, isLoading } = useDeviceStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredDevices = devices.filter(d => 
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const onlineCount = devices.filter(d => d.isOnline).length;

  useEffect(() => {
    fetchDevices();
  }, []);

  const getOSIcon = (osType?: string, color: string = '#141718') => {
    if (!osType) return <Monitor size={24} color="#8E9295" />;
    const os = osType.toLowerCase();
    if (os.includes('win')) return <Monitor size={24} color={color} />;
    if (os.includes('mac') || os.includes('ios') || os.includes('android')) return <Smartphone size={24} color={color} />;
    if (os.includes('linux')) return <Terminal size={24} color={color} />;
    return <Monitor size={24} color={color} />;
  };

  const renderDeviceCard = ({ item }: { item: Device }) => {
    const isOnline = item.isOnline;

    return (
      <View style={styles.deviceCard}>
        <View style={[styles.osIconContainer, isOnline ? styles.osIconOnline : styles.osIconOffline]}>
          {getOSIcon(item.osType, isOnline ? '#141718' : '#8E9295')}
        </View>

        <View style={styles.deviceInfo}>
          <Text style={[styles.deviceName, !isOnline && styles.textMuted]} numberOfLines={1}>
            {item.name}
          </Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusDot, isOnline ? styles.statusOnline : styles.statusOffline]} />
            <Text style={[styles.statusText, isOnline ? styles.textSuccess : styles.textMuted]}>
              {isOnline ? 'Active' : 'Offline'}
            </Text>
            {item.osType && (
              <>
                <Text style={styles.separator}>·</Text>
                <Text style={styles.osTypeText}>{item.osType}</Text>
              </>
            )}
          </View>
        </View>

        {isOnline ? (
          <TouchableOpacity 
            style={styles.connectButton}
            onPress={() => router.push({
              pathname: '/session',
              params: { deviceId: item.accessKey, deviceName: item.name }
            })}
          >
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        ) : (
          <ChevronRight size={16} color="#E6E8EC" />
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconContainer}>
        <MonitorOff size={28} color="#E6E8EC" />
      </View>
      <Text style={styles.emptyTitle}>Fleet Empty</Text>
      <Text style={styles.emptySubtitle}>Ensure your host machines are active.</Text>
      <TouchableOpacity style={styles.scanButton} onPress={fetchDevices}>
        <Text style={styles.scanButtonText}>Scan Again</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>Fleet Manager</Text>
            <Text style={styles.headerSubtitle}>
              {devices.length} nodes registered · {onlineCount} online
            </Text>
          </View>
          <TouchableOpacity onPress={fetchDevices} disabled={isLoading}>
            <RefreshCw size={18} color="rgba(20, 23, 24, 0.2)" />
          </TouchableOpacity>
        </View>

        <View style={styles.searchBar}>
          <Search size={16} color="#8E9295" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search fleet..."
            placeholderTextColor="#8E9295"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      <FlatList
        data={filteredDevices}
        renderItem={renderDeviceCard}
        keyExtractor={item => item.accessKey}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={isLoading ? <ActivityIndicator style={{marginTop: 50}} color="#141718" /> : renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={fetchDevices} tintColor="#141718" />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  header: {
    paddingHorizontal: 28,
    paddingVertical: 24,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#141718',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#8E9295',
    marginTop: 5,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F8FA',
    borderRadius: 16,
    marginTop: 20,
    paddingHorizontal: 16,
    height: 48,
    borderWidth: 1,
    borderColor: '#E6E8EC',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#141718',
  },
  listContent: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    flexGrow: 1,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 24,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  osIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  osIconOnline: {
    backgroundColor: 'rgba(20, 23, 24, 0.05)',
    borderColor: 'rgba(20, 23, 24, 0.2)',
  },
  osIconOffline: {
    backgroundColor: '#F7F8FA',
    borderColor: '#E6E8EC',
  },
  deviceInfo: {
    flex: 1,
    marginLeft: 16,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#141718',
    letterSpacing: -0.2,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusOnline: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowRadius: 6,
    shadowOpacity: 0.5,
  },
  statusOffline: {
    backgroundColor: '#E6E8EC',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 8,
  },
  textSuccess: {
    color: '#4CAF50',
  },
  textMuted: {
    color: '#8E9295',
  },
  separator: {
    marginHorizontal: 8,
    color: '#E6E8EC',
    fontSize: 12,
  },
  osTypeText: {
    fontSize: 12,
    color: '#8E9295',
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
  },
  connectButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#141718',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 50,
  },
  emptyIconContainer: {
    width: 72,
    height: 72,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E6E8EC',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#141718',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E9295',
    fontWeight: '500',
    textAlign: 'center',
  },
  scanButton: {
    marginTop: 24,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  scanButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141718',
  },
});
