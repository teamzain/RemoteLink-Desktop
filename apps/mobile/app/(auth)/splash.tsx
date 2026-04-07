import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, SafeAreaView, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay, 
  Easing 
} from 'react-native-reanimated';
import { Logo } from '../../components/Logo';
import { Text } from "@/components/Text";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();

  // Animation start values
  // Logo starts fully visible in the center
  const logoOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const logoTranslateY = useSharedValue(0);
  
  // Brand text sits visibly near the bottom at the start
  const textTranslateY = useSharedValue(SCREEN_HEIGHT * 0.35); 
  const textOpacity = useSharedValue(1); 
  
  const versionOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Text sits at bottom, then after 1 second, it slides up to the center
    textTranslateY.value = withDelay(1000, withTiming(0, { 
      duration: 1000, 
      easing: Easing.inOut(Easing.ease)
    }));

    // 2. As the text slides up, the link icon fades out and disappears
    logoOpacity.value = withDelay(1400, withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }));
    logoScale.value = withDelay(1400, withTiming(0.8, { duration: 400 }));
    logoTranslateY.value = withDelay(1400, withTiming(-30, { duration: 400 }));

    // 3. Version fades in at the very bottom initially
    versionOpacity.value = withTiming(1, { duration: 800 });

    // Navigate to onboarding
    const timer = setTimeout(() => {
      router.replace('/(auth)/onboarding');
    }, 2800); // 1s wait + 1s slide + 800ms to read it

    return () => clearTimeout(timer);
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [
      { scale: logoScale.value },
      { translateY: logoTranslateY.value }
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
    transform: [{ translateY: textTranslateY.value }],
  }));

  const versionStyle = useAnimatedStyle(() => ({
    opacity: versionOpacity.value,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.centerWrapper}>
        <Animated.View style={[styles.logoContainer, logoStyle]}>
          <Logo size={120} />
        </Animated.View>

        <Animated.View style={[styles.brandContainer, textStyle]}>
          <Text style={styles.brandName}>Connect-X</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.versionContainer, versionStyle]}>
        <Text style={styles.version}>Version 1.0</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  centerWrapper: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    // Let the logo sit naturally
  },
  brandContainer: {
    alignItems: 'center',
    zIndex: 10,
    marginTop: -20, // Sit firmly right in the pocket
  },
  brandName: {
    fontSize: 35,
    fontWeight: '500',
    color: '#000000',
    letterSpacing: -0.02 * 35,
  },
  versionContainer: {
    paddingBottom: 20,
    alignItems: 'center',
    width: '100%',
  },
  version: {
    fontSize: 16,
    fontWeight: '300',
    color: '#757171',
    letterSpacing: -0.02 * 16,
  },
});
