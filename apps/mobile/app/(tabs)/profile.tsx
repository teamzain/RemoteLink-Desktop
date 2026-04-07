import React from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Dimensions, Platform, Modal, TextInput, Linking } from 'react-native';
import { 
  User, 
  Settings, 
  Shield, 
  CreditCard, 
  Landmark, 
  BookOpen, 
  LifeBuoy, 
  Info, 
  LogOut,
  ChevronRight,
  X,
  CheckCircle2,
  Bell,
  Fingerprint,
  Smartphone,
} from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { Text } from "@/components/Text";

export default function ProfileScreen() {
  const { user, logout, updateUser } = useAuthStore();
  const [activeModal, setActiveModal] = RenderState<string | null>(null);
  
  // Local state for profile edits
  const [editName, setEditName] = RenderState(user?.name || '');
  const [editEmail, setEditEmail] = RenderState(user?.email || '');
  const [isBiometricEnabled, setIsBiometricEnabled] = RenderState(true);

  // Helper hook to handle active modal state
  function RenderState<T>(initial: T): [T, (val: T) => void] {
    return React.useState<T>(initial);
  }

  const handleUpdateProfile = async () => {
    const success = await updateUser(editName, editEmail);
    if (success) setActiveModal(null);
  };

  const renderUserBlock = () => (
    <View style={styles.userBlock}>
      <View style={styles.avatarContainer}>
        <View style={styles.avatar}>
          <User color="#FFFFFF" size={28} />
        </View>
      </View>
      <View style={styles.userInfo}>
        <Text style={styles.userName}>{user?.name || 'Connect-X Pro'}</Text>
        <Text style={styles.userEmail}>{user?.email || 'not signed in'}</Text>
      </View>
      <TouchableOpacity style={styles.settingsButton}>
        <Settings size={18} color="#8E9295" />
      </TouchableOpacity>
    </View>
  );

  const renderSection = (title: string, items: any[]) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionContent}>
        {items.map((item, index) => (
          <React.Fragment key={index}>
            <TouchableOpacity 
              style={styles.rowItem}
              onPress={() => {
                if (item.action) {
                  item.action();
                } else if (item.id) {
                  setActiveModal(item.id);
                }
              }}
            >
              <View style={styles.rowIconContainer}>
                <item.icon size={16} color="#8E9295" />
              </View>
              <View style={styles.rowTextContainer}>
                <Text style={styles.rowLabel}>{item.label}</Text>
                {item.hint && <Text style={styles.rowHint}>{item.hint}</Text>}
              </View>
              {item.badge && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              )}
              <ChevronRight size={14} color="#E6E8EC" />
            </TouchableOpacity>
            {index < items.length - 1 && <View style={styles.rowSeparator} />}
          </React.Fragment>
        ))}
      </View>
    </View>
  );

  const renderModalContent = () => {
    switch (activeModal) {
      case 'personal':
        return (
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Personal Information</Text>
            <Text style={styles.modalSub}>Update your identity and data profile</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>FULL NAME</Text>
              <TextInput 
                style={styles.input}
                value={editName}
                onChangeText={setEditName}
                placeholder="Enter full name"
                placeholderTextColor="#8E9295"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
              <TextInput 
                style={styles.input}
                value={editEmail}
                onChangeText={setEditEmail}
                placeholder="Enter email"
                placeholderTextColor="#8E9295"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={handleUpdateProfile}>
              <Text style={styles.primaryButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        );

      case 'security':
        return (
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Security & PIN</Text>
            <Text style={styles.modalSub}>Manage your access control preferences</Text>
            
            <View style={styles.settingRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingLabel}>Biometric Unlock</Text>
                <Text style={styles.settingSub}>Use FaceID or Fingerprint</Text>
              </View>
              <TouchableOpacity 
                onPress={() => setIsBiometricEnabled(!isBiometricEnabled)}
                style={[styles.toggle, isBiometricEnabled && styles.toggleActive]}
              >
                <View style={[styles.toggleCircle, isBiometricEnabled && styles.toggleCircleActive]} />
              </TouchableOpacity>
            </View>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.outlineButton}>
              <Shield size={16} color="#141718" style={{ marginRight: 8 }} />
              <Text style={styles.outlineButtonText}>Change Session PIN</Text>
            </TouchableOpacity>
          </View>
        );

      case 'subscription':
        return (
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Subscription Plan</Text>
            
            <View style={styles.planCard}>
              <View style={styles.planHeader}>
                <Text style={styles.planName}>Connect-X Pro</Text>
                <View style={styles.activeBadge}>
                  <Text style={styles.activeBadgeText}>ACTIVE</Text>
                </View>
              </View>
              <Text style={styles.planPrice}>$12.99 / MONTH</Text>
              <Text style={styles.planNext}>Next billing on May 15, 2026</Text>
              
              <View style={styles.planFeatures}>
                <View style={styles.featureItem}>
                  <CheckCircle2 size={12} color="#4CAF50" />
                  <Text style={styles.featureText}>Unlimited Remote Sessions</Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle2 size={12} color="#4CAF50" />
                  <Text style={styles.featureText}>Ultra-Low Latency Engine</Text>
                </View>
                <View style={styles.featureItem}>
                  <CheckCircle2 size={12} color="#4CAF50" />
                  <Text style={styles.featureText}>Encrypted Control Data</Text>
                </View>
              </View>
            </View>

            <TouchableOpacity style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Upgrade Workspace</Text>
            </TouchableOpacity>
          </View>
        );

      case 'billing':
        return (
          <View style={styles.modalBody}>
            <Text style={styles.modalTitle}>Billing History</Text>
            <Text style={styles.modalSub}>Recent invoices and statements</Text>
            
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              {[
                { date: 'Apr 15, 2026', amount: '$12.99', id: '#INV-0294' },
                { date: 'Mar 15, 2026', amount: '$12.99', id: '#INV-0241' },
                { date: 'Feb 15, 2026', amount: '$12.99', id: '#INV-0198' },
              ].map((inv, i) => (
                <View key={i} style={styles.invoiceRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.invoiceId}>{inv.id}</Text>
                    <Text style={styles.invoiceDate}>{inv.date}</Text>
                  </View>
                  <Text style={styles.invoiceAmount}>{inv.amount}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        );
      
      case 'about':
        return (
          <View style={styles.modalBody}>
            <View style={styles.aboutHeader}>
              <View style={styles.aboutAvatar}>
                <Smartphone size={32} color="#FFFFFF" />
              </View>
              <Text style={styles.aboutTitle}>Connect-X Desktop</Text>
              <Text style={styles.aboutVersion}>Version 2.4.0 (Stable)</Text>
            </View>
            
            <Text style={styles.aboutText}>
              A professional-grade remote control infrastructure for Android and Windows environments. 
              Built with security and performance as core pillars.
            </Text>

            <View style={styles.divider} />
            
            <Text style={styles.footerText}>© 2026 TechVision Connect-X. All rights reserved.</Text>
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {renderUserBlock()}

        {renderSection('ACCOUNT & SECURITY', [
          { id: 'personal', icon: User, label: 'Personal Information', hint: 'Identity & data profiles' },
          { id: 'security', icon: Shield, label: 'Security & PIN', hint: 'Biometrics & access control' },
        ])}

        {renderSection('BILLING & WORKSPACE', [
          { id: 'subscription', icon: CreditCard, label: 'Subscription Plan', hint: 'Manage your plan', badge: 'Premium' },
          { id: 'billing', icon: Landmark, label: 'Billing History', hint: 'Invoices & statements' },
        ])}

        {renderSection('SYSTEM & SUPPORT', [
          { icon: BookOpen, label: 'Documentation', hint: 'API & integration guides', action: () => Linking.openURL('https://docs.Connect-X.app') },
          { icon: LifeBuoy, label: 'Support Hub', hint: 'Direct assistance', action: () => Linking.openURL('mailto:support@Connect-X.app') },
          { id: 'about', icon: Info, label: 'About Connect-X', hint: 'Version 2.4.0 — Stable' },
        ])}

        <TouchableOpacity style={styles.signOutButton} onPress={logout}>
          <LogOut size={18} color="#F44336" />
          <Text style={styles.signOutText}>Terminate Session</Text>
        </TouchableOpacity>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Unified Action Modal */}
      <Modal
        visible={activeModal !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setActiveModal(null)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop} 
            activeOpacity={1} 
            onPress={() => setActiveModal(null)} 
          />
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHandle} />
              <TouchableOpacity style={styles.closeButton} onPress={() => setActiveModal(null)}>
                <X size={20} color="#8E9295" />
              </TouchableOpacity>
            </View>
            
            {renderModalContent()}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 28,
    paddingTop: 32,
  },
  userBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: 24,
  },
  avatarContainer: {
    shadowColor: '#141718',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#141718',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: 20,
  },
  userName: {
    fontSize: 18,
    fontWeight: '900',
    color: '#141718',
    letterSpacing: -0.3,
  },
  userEmail: {
    fontSize: 13,
    color: '#8E9295',
    fontWeight: '500',
    marginTop: 4,
  },
  settingsButton: {
    padding: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 10,
    fontWeight: '900',
    color: '#8E9295',
    letterSpacing: 2,
    marginBottom: 16,
    marginLeft: 4,
  },
  sectionContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    overflow: 'hidden',
  },
  rowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rowIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141718',
  },
  rowHint: {
    fontSize: 11,
    color: '#8E9295',
    fontWeight: '500',
    marginTop: 2,
  },
  rowSeparator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginLeft: 72,
  },
  badge: {
    backgroundColor: 'rgba(20, 23, 24, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(20, 23, 24, 0.1)',
    marginRight: 12,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#141718',
    letterSpacing: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
    paddingVertical: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.1)',
    marginTop: 8,
  },
  signOutText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F44336',
    marginLeft: 12,
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20, 23, 24, 0.4)',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 20,
  },
  modalHeader: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#E6E8EC',
    borderRadius: 2,
    marginBottom: 8,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 16,
    padding: 8,
  },
  modalBody: {
    paddingHorizontal: 28,
    paddingTop: 8,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#141718',
    letterSpacing: -0.5,
  },
  modalSub: {
    fontSize: 13,
    color: '#8E9295',
    marginTop: 4,
    marginBottom: 24,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 10,
    fontWeight: '900',
    color: '#8E9295',
    letterSpacing: 1,
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#F7F8FA',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: '#141718',
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  primaryButton: {
    backgroundColor: '#141718',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#141718',
  },
  settingSub: {
    fontSize: 12,
    color: '#8E9295',
    marginTop: 2,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E6E8EC',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: '#141718',
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleCircleActive: {
    transform: [{ translateX: 20 }],
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 20,
  },
  outlineButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#141718',
    borderRadius: 16,
    paddingVertical: 14,
  },
  outlineButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141718',
  },
  planCard: {
    backgroundColor: '#F7F8FA',
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.03)',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  planName: {
    fontSize: 14,
    fontWeight: '900',
    color: '#141718',
    letterSpacing: 0.5,
  },
  activeBadge: {
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activeBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#4CAF50',
  },
  planPrice: {
    fontSize: 24,
    fontWeight: '900',
    color: '#141718',
  },
  planNext: {
    fontSize: 12,
    color: '#8E9295',
    marginTop: 4,
    marginBottom: 16,
  },
  planFeatures: {
    gap: 8,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featureText: {
    fontSize: 12,
    color: '#141718',
    fontWeight: '500',
    marginLeft: 8,
  },
  secondaryButton: {
    backgroundColor: 'rgba(20, 23, 24, 0.05)',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: '#141718',
    fontSize: 14,
    fontWeight: '700',
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.03)',
  },
  invoiceId: {
    fontSize: 14,
    fontWeight: '700',
    color: '#141718',
  },
  invoiceDate: {
    fontSize: 11,
    color: '#8E9295',
    marginTop: 2,
  },
  invoiceAmount: {
    fontSize: 14,
    fontWeight: '800',
    color: '#141718',
  },
  aboutHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  aboutAvatar: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#141718',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  aboutTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#141718',
  },
  aboutVersion: {
    fontSize: 12,
    color: '#8E9295',
    marginTop: 4,
  },
  aboutText: {
    fontSize: 14,
    color: '#8E9295',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  footerText: {
    fontSize: 10,
    color: '#8E9295',
    textAlign: 'center',
    fontWeight: '500',
  },
});
