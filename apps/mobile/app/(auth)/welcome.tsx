import React from 'react';
import { View, StyleSheet, Dimensions, SafeAreaView, TouchableOpacity, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Globe } from 'lucide-react-native';
import { Logo } from '../../components/Logo';
import { Text } from "@/components/Text";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Logo Section */}
      <View style={styles.logoContainer}>
        <Logo size={140} color="#141718" />
      </View>

      {/* Welcome Text */}
      <View style={styles.textContainer}>
        <Text style={styles.welcomeText}>Welcome to{'\n'}Connect-X</Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionContainer}>
        <TouchableOpacity 
          style={[styles.button, styles.primaryButton]} 
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.primaryButtonText}>Login</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.secondaryButton]} 
          onPress={() => router.push('/(auth)/signup')}
        >
          <Text style={styles.secondaryButtonText}>Sign up</Text>
        </TouchableOpacity>
      </View>

      {/* Social Login */}
      <View style={styles.socialContainer}>
        <Text style={styles.socialHeader}>Continue With Accounts</Text>
        <View style={styles.socialRow}>
          <TouchableOpacity style={[styles.socialButton, { backgroundColor: 'rgba(212, 70, 56, 0.1)' }]}>
            <Mail color="#D44638" size={18} />
            <Text style={[styles.socialButtonText, { color: '#D44638' }]}>GOOGLE</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.socialButton, { backgroundColor: 'rgba(66, 103, 178, 0.1)' }]}>
            <Globe color="#4267B2" size={18} />
            <Text style={[styles.socialButtonText, { color: '#4267B2' }]}>FACEBOOK</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
  },
  logoContainer: {
    marginTop: 80,
    width: 154,
    height: 185,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPart: {
    position: 'absolute',
    backgroundColor: '#141718',
    borderRadius: 16,
  },
  textContainer: {
    marginTop: 40,
    paddingHorizontal: 20,
  },
  welcomeText: {
    fontSize: 40,
    fontWeight: '800',
    color: '#212121',
    textAlign: 'center',
    lineHeight: 56,
    letterSpacing: -1,
  },
  actionContainer: {
    marginTop: 80,
    width: '100%',
    paddingHorizontal: 25,
  },
  button: {
    width: '100%',
    height: 61,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  primaryButton: {
    backgroundColor: '#141718',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  secondaryButton: {
    backgroundColor: '#E3E3E3',
  },
  secondaryButtonText: {
    color: '#B1B1B1',
    fontSize: 18,
    fontWeight: '700',
  },
  socialContainer: {
    position: 'absolute',
    bottom: 60,
    width: '100%',
    alignItems: 'center',
  },
  socialHeader: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ACADB9',
    marginBottom: 24,
  },
  socialRow: {
    flexDirection: 'row',
    gap: 14,
    paddingHorizontal: 25,
  },
  socialButton: {
    flex: 1,
    height: 57,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  socialButtonText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
