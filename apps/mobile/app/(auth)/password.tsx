import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { Text } from "@/components/Text";

export default function PasswordScreen() {
  const router = useRouter();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { login, isLoading } = useAuthStore();

  const displayName = email ? email.split('@')[0] : 'Guest';
  const formattedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  const handleLogin = async () => {
    if (password.trim().length === 0) {
      Alert.alert('Error', 'Password is required');
      return;
    }

    const success = await login(email, password);
    if (success) {
      // In Flutter it goes to ReadyScreen, then Dashboard. 
      // For now, let's go straight to Dashboard (tabs)
      router.replace('/(tabs)');
    } else {
      Alert.alert('Error', 'Invalid password');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <ChevronLeft color="#000" size={24} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Hello,{'\n'}{formattedName}!!</Text>
      </View>

      <View style={styles.inputContainer}>
        <Lock color="#C2C3CB" size={20} style={styles.inputIcon} />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#C2C3CB"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPassword}
        />
        <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
          {showPassword ? (
            <EyeOff color="#C2C3CB" size={20} />
          ) : (
            <Eye color="#C2C3CB" size={20} />
          )}
        </TouchableOpacity>
      </View>

      <TouchableOpacity 
        style={styles.loginButton} 
        onPress={handleLogin}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.loginButtonText}>Login</Text>
        )}
      </TouchableOpacity>
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
    fontSize: 40,
    fontWeight: '700',
    color: '#323142',
    lineHeight: 50,
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
  loginButton: {
    backgroundColor: '#141718',
    height: 65,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  loginButtonText: {
    color: '#F3F5FB',
    fontSize: 16,
    fontWeight: '500',
  },
});
