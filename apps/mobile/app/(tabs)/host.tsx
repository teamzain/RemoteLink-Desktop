import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Clipboard,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  AppState,
} from 'react-native';
import {
  Power,
  Zap,
  ShieldCheck,
  Copy,
  TriangleAlert,
  Lock,
  Radio,
  CheckCircle2,
  Circle,
} from 'lucide-react-native';
import { useHostStore } from '../../src/stores/hostStore';
import { Text } from '@/components/Text';

export default function HostScreen() {
  const {
    isHosting,
    isSignaling,
    isAccessibilityEnabled,
    hasOverlayPermission,
    hasIgnoreBatteryOptimization,
    hasPassword,
    sessionId,
    error,
    ensureHosting,
    startHosting,
    stopHosting,
    setHostPassword,
    checkAccessibilityStatus,
    openAccessibilitySettings,
    checkOverlayPermission,
    requestOverlayPermission,
    checkBatteryOptimization,
    requestBatteryOptimizationExemption,
    registerDevice,
  } = useHostStore();

  const [isEnabling, setIsEnabling] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  useEffect(() => {
    checkAccessibilityStatus();
    checkOverlayPermission();
    checkBatteryOptimization();
    registerDevice();
  }, []);

  // Re-check permissions whenever the app comes to foreground (user may have just granted them)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: string) => {
      if (state === 'active') {
        checkAccessibilityStatus();
        checkOverlayPermission();
        checkBatteryOptimization();
      }
    });
    return () => sub.remove();
  }, []);

  // Step 1 — connect to signaling server and register device
  const handleEnableConnectX = async () => {
    setIsEnabling(true);
    try {
      await ensureHosting();
    } catch {
      Alert.alert('Connection Failed', 'Could not connect to the signaling server. Check your network and try again.');
    } finally {
      setIsEnabling(false);
    }
  };

  // Step 2 — start screen capture & broadcast
  const handleStartHosting = async () => {
    if (hasPassword === false) {
      // No password set yet — ask user to set one first
      setShowPasswordModal(true);
      return;
    }
    setIsStarting(true);
    try {
      await startHosting();
    } finally {
      setIsStarting(false);
    }
  };

  const handleSavePassword = async () => {
    setPasswordError('');
    if (password.length < 4) {
      setPasswordError('Password must be at least 4 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }
    setIsSaving(true);
    try {
      await setHostPassword(password);
      setShowPasswordModal(false);
      setPassword('');
      setConfirmPassword('');
      // Password saved — proceed directly into hosting
      setIsStarting(true);
      await startHosting();
    } catch (e: any) {
      setPasswordError(e?.response?.data?.error || 'Failed to save password. Try again.');
    } finally {
      setIsSaving(false);
      setIsStarting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    Clipboard.setString(text);
    Alert.alert('Copied', 'Host ID copied to clipboard');
  };

  // ─── BROADCASTING STATE ──────────────────────────────────────────────────
  if (isHosting) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.hero, styles.heroLive]}>
          <View style={styles.heroHeader}>
            <View style={[styles.badge, styles.badgeLive]}>
              <View style={[styles.badgeDot, styles.badgeDotLive]} />
              <Text style={[styles.badgeText, styles.textSuccess]}>BROADCASTING</Text>
            </View>
            <TouchableOpacity onPress={stopHosting} style={styles.stopButton}>
              <Power size={16} color="#F44336" />
              <Text style={styles.stopButtonText}>Stop</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.heroTitle}>{'Screen Sharing\nis Active'}</Text>
          <Text style={styles.heroSubtitle}>
            Your device is visible and accessible from your desktop dashboard.
          </Text>
        </View>

        <ScrollView style={styles.details} contentContainerStyle={styles.detailsContent}>
          <SectionTitle title="BROADCAST IDENTITY" />
          <InfoRow
            label="Host ID"
            value={sessionId || '— — —'}
            canCopy
            copyText={sessionId || ''}
            onCopy={copyToClipboard}
          />
          <InfoRow label="Signal Status" value="Connected" valueColor="#4CAF50" />
          <InfoRow label="Security" value="P2P Encrypted" />
          <InfoRow label="Access Password" value="Set" valueColor="#4CAF50" />
          <View style={styles.divider} />
          <SectionTitle title="LIVE TELEMETRY" />
          <InfoRow label="Bandwidth" value="Calculating..." />
          <InfoRow label="Link Quality" value="Optimized" valueColor="#4CAF50" />
          {error && (
            <>
              <View style={styles.divider} />
              <View style={styles.errorRow}>
                <TriangleAlert size={16} color="#F44336" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            </>
          )}
          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── SETUP FLOW (Step 1 → Step 2) ────────────────────────────────────────
  const step1Done = isSignaling;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.details}
        contentContainerStyle={[styles.detailsContent, { paddingTop: 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.pageTitle}>Host Setup</Text>
        <Text style={styles.pageSubtitle}>Follow the steps below to start broadcasting your screen.</Text>

        {/* ── STEP 1 ── */}
        <View style={[styles.stepCard, step1Done && styles.stepCardDone]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepMeta}>
              {step1Done
                ? <CheckCircle2 size={20} color="#4CAF50" />
                : <Circle size={20} color="#141718" />}
              <Text style={[styles.stepLabel, step1Done && styles.stepLabelDone]}>
                Step 1 — Enable Remote Link
              </Text>
            </View>
          </View>

          <Text style={styles.stepDescription}>
            {step1Done
              ? 'Remote Link is active. Your device is registered and reachable.'
              : 'Connect this device to the Connect-X network so your desktop can discover it.'}
          </Text>

          {!step1Done && (
            <>
              <PermissionRow
                label="Accessibility Service"
                description="Required for remote touch control"
                granted={isAccessibilityEnabled}
                onGrant={openAccessibilitySettings}
              />
              <PermissionRow
                label="Draw Over Other Apps"
                description="Required to display controls on top of any screen"
                granted={hasOverlayPermission}
                onGrant={requestOverlayPermission}
              />
              <PermissionRow
                label="Battery Optimization"
                description="Keeps the session alive in the background"
                granted={hasIgnoreBatteryOptimization}
                onGrant={requestBatteryOptimizationExemption}
              />

              <TouchableOpacity
                style={[styles.primaryButton, isEnabling && styles.buttonDisabled, { marginTop: 12 }]}
                onPress={handleEnableConnectX}
                disabled={isEnabling}
              >
                {isEnabling
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <>
                      <Radio size={16} color="#FFF" style={styles.buttonIcon} />
                      <Text style={styles.primaryButtonText}>Enable Remote Link</Text>
                    </>}
              </TouchableOpacity>
            </>
          )}

          {step1Done && sessionId && (
            <InfoRow
              label="Host ID"
              value={sessionId}
              canCopy
              copyText={sessionId}
              onCopy={copyToClipboard}
            />
          )}
        </View>

        {/* ── STEP 2 ── */}
        <View style={[styles.stepCard, !step1Done && styles.stepCardLocked]}>
          <View style={styles.stepHeader}>
            <View style={styles.stepMeta}>
              <Circle size={20} color={step1Done ? '#141718' : '#C8CACC'} />
              <Text style={[styles.stepLabel, !step1Done && styles.stepLabelLocked]}>
                Step 2 — Start Hosting
              </Text>
            </View>
          </View>

          <Text style={[styles.stepDescription, !step1Done && styles.stepDescriptionLocked]}>
            {step1Done
              ? hasPassword === false
                ? 'Set an access password before your first broadcast. Viewers need it to connect.'
                : 'Your full screen will be shared automatically. Viewers connect using your Host ID and password.'
              : 'Complete Step 1 first.'}
          </Text>

          {step1Done && (
            <>
              {hasPassword === false && (
                <View style={styles.warningRow}>
                  <Lock size={13} color="#FF9800" />
                  <Text style={styles.warningText}>
                    No password set. You will be prompted to create one.
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryButton, isStarting && styles.buttonDisabled]}
                onPress={handleStartHosting}
                disabled={isStarting}
              >
                {isStarting
                  ? <ActivityIndicator color="#FFF" size="small" />
                  : <>
                      <Zap size={16} color="#FFF" style={styles.buttonIcon} />
                      <Text style={styles.primaryButtonText}>Start Hosting</Text>
                    </>}
              </TouchableOpacity>
            </>
          )}
        </View>

        {error && (
          <View style={styles.errorRow}>
            <TriangleAlert size={16} color="#F44336" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Password Setup Modal */}
      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={() => !isSaving && setShowPasswordModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Lock size={24} color="#141718" />
            </View>
            <Text style={styles.modalTitle}>Set Access Password</Text>
            <Text style={styles.modalSubtitle}>
              Viewers need this password to connect to your device. You only need to set it once.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="New password"
              placeholderTextColor="#8E9295"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              autoFocus
            />
            <TextInput
              style={styles.input}
              placeholder="Confirm password"
              placeholderTextColor="#8E9295"
              secureTextEntry
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              autoCapitalize="none"
            />

            {passwordError ? <Text style={styles.inputError}>{passwordError}</Text> : null}

            <TouchableOpacity
              style={[styles.modalPrimaryButton, isSaving && styles.modalButtonDisabled]}
              onPress={handleSavePassword}
              disabled={isSaving}
            >
              {isSaving
                ? <ActivityIndicator color="#FFFFFF" size="small" />
                : <Text style={styles.modalPrimaryButtonText}>Save & Start Hosting</Text>}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowPasswordModal(false)}
              disabled={isSaving}
            >
              <Text style={styles.modalCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function PermissionRow({ label, description, granted, onGrant }: {
  label: string;
  description: string;
  granted: boolean;
  onGrant: () => void;
}) {
  return (
    <View style={styles.permissionRow}>
      <View style={styles.permissionLeft}>
        <View style={[styles.permissionDot, granted ? styles.permissionDotGranted : styles.permissionDotPending]} />
        <View style={{ flex: 1 }}>
          <Text style={styles.permissionLabel}>{label}</Text>
          <Text style={styles.permissionDescription}>{description}</Text>
        </View>
      </View>
      {!granted && (
        <TouchableOpacity style={styles.permissionButton} onPress={onGrant}>
          <Text style={styles.permissionButtonText}>Enable</Text>
        </TouchableOpacity>
      )}
      {granted && (
        <CheckCircle2 size={18} color="#4CAF50" />
      )}
    </View>
  );
}

function InfoRow({ label, value, canCopy, copyText, onCopy, valueColor }: any) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <View style={styles.infoValueContainer}>
        <Text style={[styles.infoValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
        {canCopy && (
          <TouchableOpacity onPress={() => onCopy(copyText)} style={styles.copyButton}>
            <Copy size={14} color="#8E9295" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },

  // ── Page header ──
  pageTitle: { fontSize: 26, fontWeight: '900', color: '#141718', letterSpacing: -0.5, marginBottom: 6 },
  pageSubtitle: { fontSize: 14, color: '#8E9295', fontWeight: '500', lineHeight: 20, marginBottom: 28 },

  // ── Step cards ──
  stepCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E6E8EC',
  },
  stepCardDone: { borderColor: 'rgba(76,175,80,0.25)', backgroundColor: 'rgba(76,175,80,0.02)' },
  stepCardLocked: { opacity: 0.45 },
  stepHeader: { marginBottom: 10 },
  stepMeta: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepLabel: { fontSize: 15, fontWeight: '800', color: '#141718', flex: 1 },
  stepLabelDone: { color: '#4CAF50' },
  stepLabelLocked: { color: '#8E9295' },
  stepDescription: { fontSize: 13, color: '#8E9295', fontWeight: '500', lineHeight: 19, marginBottom: 16 },
  stepDescriptionLocked: { color: '#C8CACC' },

  // ── Buttons ──
  primaryButton: {
    flexDirection: 'row',
    backgroundColor: '#141718',
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryButton: {
    flexDirection: 'row',
    backgroundColor: '#F7F8FA',
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E6E8EC',
  },
  secondaryButtonText: { color: '#141718', fontSize: 14, fontWeight: '700' },
  buttonIcon: { marginRight: 8 },
  buttonDisabled: { opacity: 0.55 },
  stopButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(244,67,54,0.2)',
    backgroundColor: 'rgba(244,67,54,0.05)',
    gap: 6,
  },
  stopButtonText: { color: '#F44336', fontSize: 13, fontWeight: '700' },

  // ── Warning ──
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,152,0,0.07)',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,152,0,0.2)',
    marginBottom: 12,
    gap: 8,
  },
  warningText: { flex: 1, fontSize: 12, color: '#FF9800', fontWeight: '600', lineHeight: 17 },

  // ── Live hero ──
  hero: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: 32,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    backgroundColor: '#FFFFFF',
  },
  heroLive: { backgroundColor: 'rgba(76,175,80,0.03)' },
  heroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  badge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  badgeLive: { backgroundColor: 'rgba(76,175,80,0.1)', borderColor: 'rgba(76,175,80,0.2)' },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeDotLive: { backgroundColor: '#4CAF50' },
  badgeText: { fontSize: 9, fontWeight: '900', marginLeft: 8, letterSpacing: 1.5 },
  textSuccess: { color: '#4CAF50' },
  heroTitle: { fontSize: 30, fontWeight: '900', color: '#141718', lineHeight: 34, letterSpacing: -1, marginBottom: 10 },
  heroSubtitle: { fontSize: 14, color: '#8E9295', fontWeight: '500', lineHeight: 20 },

  // ── Info rows ──
  details: { flex: 1 },
  detailsContent: { paddingHorizontal: 24, paddingVertical: 24 },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#8E9295', letterSpacing: 2, marginBottom: 20 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  infoLabel: { fontSize: 13, fontWeight: '700', color: '#8E9295' },
  infoValueContainer: { flexDirection: 'row', alignItems: 'center' },
  infoValue: { fontSize: 13, fontWeight: '900', color: '#141718' },
  copyButton: { marginLeft: 10 },
  divider: { height: 1, backgroundColor: 'rgba(0,0,0,0.05)', marginVertical: 20 },
  errorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  errorText: { fontSize: 13, color: '#F44336', fontWeight: '700', marginLeft: 10, flex: 1 },

  // ── Permission rows ──
  permissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F3',
  },
  permissionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  permissionDot: { width: 8, height: 8, borderRadius: 4 },
  permissionDotGranted: { backgroundColor: '#4CAF50' },
  permissionDotPending: { backgroundColor: '#FF9800' },
  permissionLabel: { fontSize: 13, fontWeight: '700', color: '#141718' },
  permissionDescription: { fontSize: 11, color: '#8E9295', fontWeight: '500', marginTop: 1 },
  permissionButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F7F8FA',
    borderWidth: 1,
    borderColor: '#E6E8EC',
  },
  permissionButtonText: { fontSize: 12, fontWeight: '700', color: '#141718' },

  // ── Password modal ──
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, width: '100%' },
  modalIconWrap: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F7F8FA', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '900', color: '#141718', marginBottom: 8 },
  modalSubtitle: { fontSize: 14, color: '#8E9295', fontWeight: '500', lineHeight: 20, marginBottom: 24 },
  input: { height: 52, borderWidth: 1, borderColor: '#E6E8EC', borderRadius: 12, paddingHorizontal: 16, fontSize: 15, color: '#141718', backgroundColor: '#F7F8FA', marginBottom: 12 },
  inputError: { fontSize: 13, color: '#F44336', fontWeight: '600', marginBottom: 12 },
  modalPrimaryButton: { height: 52, backgroundColor: '#141718', borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  modalButtonDisabled: { opacity: 0.5 },
  modalPrimaryButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  modalCancelButton: { height: 44, alignItems: 'center', justifyContent: 'center' },
  modalCancelButtonText: { fontSize: 14, color: '#8E9295', fontWeight: '600' },
});
