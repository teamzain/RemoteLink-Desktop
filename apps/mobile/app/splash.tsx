import React, { useEffect } from 'react';
import { View, StyleSheet, Dimensions, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay, 
  Easing 
} from 'react-native-reanimated';
import { Logo } from '../components/Logo';
import { useAuthStore } from '../src/stores/authStore';
import { Text } from "@/components/Text";

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SplashScreen() {
  const router = useRouter();
  const { initialize, isAuthenticated } = useAuthStore();

  // Animation start values
  // Logo starts fully visible
  const logoOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const logoTranslateY = useSharedValue(0);
  
  // Brand text moves from bottom to center
  const textTranslateY = useSharedValue(SCREEN_HEIGHT * 0.4); 
  const textOpacity = useSharedValue(0);
  
  const versionOpacity = useSharedValue(0);

  useEffect(() => {
    // 1. Text fades in and moves up from bottom to center
    textOpacity.value = withTiming(1, { duration: 800 });
    textTranslateY.value = withTiming(0, { 
      duration: 1200, 
      easing: Easing.out(Easing.exp)
    });

    // 2. Then, the link icon disappears (slides up slightly and fades out)
    logoOpacity.value = withDelay(1300, withTiming(0, { duration: 400, easing: Easing.in(Easing.ease) }));
    logoScale.value = withDelay(1300, withTiming(0.8, { duration: 400 }));
    logoTranslateY.value = withDelay(1300, withTiming(-20, { duration: 400 }));

    // 3. Version fades in at the bottom
    versionOpacity.value = withDelay(500, withTiming(1, { duration: 800 }));

    // Initialize auth and navigate sequence
    const setup = async () => {
      await initialize();
      
      setTimeout(() => {
        if (isAuthenticated) {
          router.replace('/(tabs)');
        } else {
          router.replace('/onboarding');
        }
      }, 2400); // Navigate faster after logo disappears
    };

    setup();
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
    marginTop: -20, // Moves the text a little upward
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
