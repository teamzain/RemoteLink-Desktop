import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Mail } from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import { useAuthStore } from '../../src/stores/authStore';
import { Text } from "@/components/Text";

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const { loginWithToken, isLoading } = useAuthStore();

  useEffect(() => {
    // Handle deep links
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  const handleDeepLink = async (url: string) => {
    if (url.includes('Connect-X://auth/callback')) {
      const params = new URL(url).searchParams;
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken');
      
      if (accessToken) {
        const success = await loginWithToken(accessToken, refreshToken || undefined);
        if (success) {
          router.replace('/(tabs)');
        } else {
          Alert.alert('Error', 'Google Authentication failed');
        }
      }
    }
  };

  const handleNext = () => {
    if (email.trim().length > 0) {
      router.push({
        pathname: '/password',
        params: { email }
      });
    } else {
      Alert.alert('Error', 'Identification required');
    }
  };

  const handleGoogleLogin = async () => {
    const authUrl = 'http://159.65.84.190/api/auth/oauth/google?platform=mobile';
    await WebBrowser.openBrowserAsync(authUrl);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <ChevronLeft color="#000" size={24} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Login</Text>
        <Text style={styles.subtitle}>Good to see you back!</Text>
      </View>

      <View style={styles.inputContainer}>
        <Mail color="#C2C3CB" size={20} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Email or Phone Number"
          placeholderTextColor="#C2C3CB"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
      </View>

      <TouchableOpacity 
        style={styles.nextButton} 
        onPress={handleNext}
        disabled={isLoading}
      >
        <Text style={styles.nextButtonText}>Next</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.signupLink} 
        onPress={() => router.replace('/signup')}
      >
        <Text style={styles.signupText}>
          Don't have an account? <Text style={styles.signupTextBold}>Sign Up</Text>
        </Text>
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
      </View>

      <Text style={styles.socialTitle}>Continue With Accounts</Text>

      <View style={styles.socialButtonsContainer}>
        <TouchableOpacity 
          style={[styles.socialButton, { backgroundColor: 'rgba(212, 70, 56, 0.25)' }]} 
          onPress={handleGoogleLogin}
        >
          <Text style={[styles.socialButtonText, { color: '#D44638' }]}>GOOGLE</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.socialButton, { backgroundColor: 'rgba(66, 103, 178, 0.25)' }]} 
        >
          <Text style={[styles.socialButtonText, { color: '#4267B2' }]}>FACEBOOK</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  content: {
    paddingHorizontal: 35,
    paddingTop: 60,
    paddingBottom: 40,
  },
  backButton: {
    width: 45,
    height: 45,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D3D1D8',
    shadowOffset: { width: 6, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 10,
  },
  header: {
    marginTop: 70,
  },
  title: {
    fontSize: 38,
    fontWeight: '600',
    color: '#323142',
    lineHeight: 48,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: '#8E9295',
    marginTop: 8,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
    height: 65,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 10,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#323142',
    fontWeight: '500',
  },
  nextButton: {
    backgroundColor: '#141718',
    height: 65,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  nextButtonText: {
    color: '#F3F5FB',
    fontSize: 16,
    fontWeight: '500',
  },
  signupLink: {
    marginTop: 30,
    alignItems: 'center',
  },
  signupText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ACADB9',
  },
  signupTextBold: {
    color: '#323142',
    fontWeight: '700',
  },
  dividerContainer: {
    marginTop: 30,
    paddingHorizontal: 20,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(194, 195, 203, 0.3)',
  },
  socialTitle: {
    textAlign: 'center',
    marginTop: 30,
    fontSize: 16,
    fontWeight: '500',
    color: '#ACADB9',
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    marginTop: 24,
    justifyContent: 'space-between',
  },
  socialButton: {
    width: '48%',
    height: 57,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialButtonText: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2.5,
  },
});
