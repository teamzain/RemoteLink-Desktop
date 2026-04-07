import React, { useState, useRef } from 'react';
import { View, StyleSheet, Dimensions, SafeAreaView, TouchableOpacity, Image, ScrollView, Platform, StatusBar } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { Text } from "@/components/Text";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const STEPS = [
  {
    title: 'Seamless Device Connection',
    subtitle: 'Instantly link your smartphone to your desktop with ultra-low latency.',
    image: require('../../assets/images/onboarding_1.png'),
  },
  {
    title: 'Control Anywhere, Anytime',
    subtitle: 'Take full control of your desktop remotely from anywhere in the world.',
    image: require('../../assets/images/onboarding_2.png'),
  },
  {
    title: 'Cross-Platform Access',
    subtitle: 'Experience bi-directional remote control with unmatched performance.',
    image: require('../../assets/images/onboarding_3.png'),
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const onNext = () => {
    if (currentPage < STEPS.length - 1) {
      scrollRef.current?.scrollTo({ x: (currentPage + 1) * SCREEN_WIDTH, animated: true });
      setCurrentPage(currentPage + 1);
    } else {
      router.replace('/(auth)/welcome');
    }
  };

  const onSkip = () => {
    router.replace('/(auth)/welcome');
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={onSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentPage(index);
        }}
      >
        {STEPS.map((step, index) => (
          <View key={index} style={styles.page}>
            {/* Image Placeholder */}
            <View style={styles.imageBacking}>
              <View style={styles.glowShadow} />
              <View style={styles.imageContainer}>
                <Image 
                  source={step.image} 
                  style={styles.image}
                  resizeMode="contain"
                />
              </View>
            </View>

            {/* Content */}
            <View style={styles.textStack}>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.subtitle}>{step.subtitle}</Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Navigation Controls */}
      <View style={styles.controlsContainer}>
        {/* Indicators */}
        <View style={styles.indicatorContainer}>
          {STEPS.map((_, i) => (
            <View 
              key={i} 
              style={[
                styles.indicator, 
                i === currentPage ? styles.indicatorActive : styles.indicatorInactive
              ]} 
            />
          ))}
        </View>

        {/* Action Button */}
        <TouchableOpacity style={styles.actionButton} onPress={onNext}>
          <ArrowRight color="#FFFFFF" size={24} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  skipButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  skipText: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontWeight: '600',
    fontSize: 16,
    color: '#8E9295',
    letterSpacing: 0.5,
  },
  page: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  imageBacking: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.45,
    marginTop: SCREEN_HEIGHT * 0.1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowShadow: {
    position: 'absolute',
    width: 146,
    height: 146,
    backgroundColor: 'rgba(236, 237, 255, 0.73)',
    borderRadius: 73,
    ...Platform.select({
      ios: {
        shadowColor: '#141718',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 30,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  imageContainer: {
    width: SCREEN_WIDTH * 0.75, // Scaled down to match 287 on 375
    height: SCREEN_HEIGHT * 0.45,
    borderRadius: 30,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  textStack: {
    marginTop: SCREEN_HEIGHT * 0.05,
    alignItems: 'center',
    width: '100%',
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontSize: 24,
    fontWeight: '700',
    color: '#23262F',
    textAlign: 'center',
    letterSpacing: -0.005 * 24,
    lineHeight: 32,
  },
  subtitle: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '400',
    color: '#8E9295',
    textAlign: 'center',
    lineHeight: 22,
  },
  controlsContainer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 50 : 30, // Responsive bottom
    left: 32,
    right: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between', // Separate dots and button
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  indicator: {
    height: 4,
    borderRadius: 5,
  },
  indicatorActive: {
    width: 17,
    backgroundColor: '#141718',
  },
  indicatorInactive: {
    width: 4,
    backgroundColor: 'rgba(35, 38, 47, 0.2)',
  },
  actionButton: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#141718',
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
      },
      android: {
        elevation: 5,
      },
    }),
  },
});
