import React, { useState } from 'react';
import { View, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Mail, Lock, User, Eye, EyeOff } from 'lucide-react-native';
import { Text } from "@/components/Text";

export default function SignupScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = () => {
    // Registration logic placeholder (as in Flutter)
    Alert.alert('Info', 'Registration is currently handled via the web or Google Auth.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <ChevronLeft color="#000" size={24} />
      </TouchableOpacity>

      <View style={styles.header}>
        <Text style={styles.title}>Create your{'\n'}Account</Text>
      </View>

      <View style={styles.inputsWrapper}>
        <View style={styles.inputContainer}>
          <User color="#C2C3CB" size={20} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            placeholderTextColor="#C2C3CB"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.inputContainer}>
          <Mail color="#C2C3CB" size={20} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Enter Your Email"
            placeholderTextColor="#C2C3CB"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
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
      </View>

      <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
        <Text style={styles.registerButtonText}>Register</Text>
      </TouchableOpacity>

      <TouchableOpacity 
        style={styles.loginLink} 
        onPress={() => router.replace('/login')}
      >
        <Text style={styles.loginLinkText}>
          Already Have An Account? <Text style={styles.loginLinkTextBold}>Sign In</Text>
        </Text>
      </TouchableOpacity>

      <View style={styles.dividerContainer}>
        <View style={styles.divider} />
      </View>

      <Text style={styles.socialTitle}>Continue With Accounts</Text>

      <View style={styles.socialButtonsContainer}>
        <TouchableOpacity style={[styles.socialButton, { backgroundColor: 'rgba(212, 70, 56, 0.25)' }]}>
          <Text style={[styles.socialButtonText, { color: '#D44638' }]}>GOOGLE</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.socialButton, { backgroundColor: 'rgba(66, 103, 178, 0.25)' }]}>
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
  inputsWrapper: {
    marginTop: 40,
    gap: 20,
  },
  inputContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
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
  registerButton: {
    backgroundColor: '#141718',
    height: 65,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 35,
  },
  registerButtonText: {
    color: '#F3F5F6',
    fontSize: 16,
    fontWeight: '500',
  },
  loginLink: {
    marginTop: 30,
    alignItems: 'center',
  },
  loginLinkText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ACADB9',
  },
  loginLinkTextBold: {
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
