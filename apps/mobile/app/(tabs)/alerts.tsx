import React from 'react';
import { View, StyleSheet, SafeAreaView, Dimensions, Platform, ScrollView, TouchableOpacity } from 'react-native';
import { BellOff, Settings, Shield, Zap, CreditCard, CheckCircle2, Trash2, X } from 'lucide-react-native';
import { Text } from "@/components/Text";
import { useNotificationStore } from '../../src/stores/notificationStore';

export default function AlertsScreen() {
  const { notifications, markAsRead, clearAll } = useNotificationStore();

  const getIcon = (type: string) => {
    switch (type) {
      case 'SECURITY': return <Shield size={18} color="#F44336" />;
      case 'SYSTEM': return <Zap size={18} color="#2196F3" />;
      case 'BILLING': return <CreditCard size={18} color="#FF9800" />;
      default: return <BellOff size={18} color="#8E9295" />;
    }
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'SECURITY': return 'rgba(244, 67, 54, 0.1)';
      case 'SYSTEM': return 'rgba(33, 150, 243, 0.1)';
      case 'BILLING': return 'rgba(255, 152, 0, 0.1)';
      default: return 'rgba(142, 146, 149, 0.1)';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Alerts</Text>
          <Text style={styles.headerSubtitle}>System notifications & security</Text>
        </View>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={clearAll} style={styles.clearButton}>
            <Trash2 size={18} color="#8E9295" />
          </TouchableOpacity>
        )}
      </View>
      
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.iconContainer}>
            <BellOff size={26} color="#8E9295" />
          </View>
          <Text style={styles.emptyTitle}>No alerts</Text>
          <Text style={styles.emptySubtitle}>Connect-X is running normally.</Text>
        </View>
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {notifications.map((notif) => (
            <TouchableOpacity 
              key={notif.id} 
              style={[styles.alertCard, !notif.isRead && styles.unreadCard]}
              onPress={() => markAsRead(notif.id)}
            >
              <View style={[styles.typeIcon, { backgroundColor: getStatusColor(notif.type) }]}>
                {getIcon(notif.type)}
              </View>
              
              <View style={styles.alertInfo}>
                <View style={styles.alertHeader}>
                  <Text style={styles.alertTitle}>{notif.title}</Text>
                  <Text style={styles.alertTime}>{notif.timestamp}</Text>
                </View>
                <Text style={styles.alertMessage}>{notif.message}</Text>
              </View>

              {!notif.isRead && <View style={styles.unreadDot} />}
            </TouchableOpacity>
          ))}
          <View style={{ height: 100 }} />
        </ScrollView>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  headerText: {
    flex: 1,
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
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 100, // Offset for the tab bar
  },
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#141718',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#8E9295',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  clearButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
  },
  alertCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  unreadCard: {
    borderColor: 'rgba(142, 146, 149, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  alertInfo: {
    flex: 1,
    marginLeft: 16,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  alertTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#141718',
  },
  alertTime: {
    fontSize: 11,
    color: '#8E9295',
    fontWeight: '500',
  },
  alertMessage: {
    fontSize: 13,
    color: '#8E9295',
    lineHeight: 18,
    marginTop: 4,
    fontWeight: '500',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2196F3',
    position: 'absolute',
    right: 12,
    top: 12,
  },
});
