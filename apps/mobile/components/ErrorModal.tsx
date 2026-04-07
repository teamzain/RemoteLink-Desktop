import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions, Modal, Platform } from 'react-native';
import { useUIStore } from '../src/stores/uiStore';
import { AlertCircle } from 'lucide-react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ErrorModal() {
  const { errorModalVisible, errorTitle, errorMessage, hideError } = useUIStore();

  return (
    <Modal
      visible={errorModalVisible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <AlertCircle color="#FF3B30" size={48} strokeWidth={1.5} />
          </View>
          
          <Text style={styles.title}>{errorTitle || 'Error'}</Text>
          <Text style={styles.message}>{errorMessage || 'An unexpected error occurred.'}</Text>

          <TouchableOpacity style={styles.button} onPress={hideError}>
            <Text style={styles.buttonText}>Dismiss</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    width: SCREEN_WIDTH * 0.85,
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  iconContainer: {
    marginBottom: 16,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#23262F',
    textAlign: 'center',
    marginBottom: 8,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  message: {
    fontSize: 15,
    fontWeight: '400',
    color: '#8E9295',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
  button: {
    width: '100%',
    height: 52,
    borderRadius: 16,
    backgroundColor: '#141718',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
  },
});
