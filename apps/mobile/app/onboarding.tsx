import React, { useState, useRef } from 'react';
import { View, StyleSheet, FlatList, Dimensions, Image, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, ArrowRight } from 'lucide-react-native';
import { Text } from "@/components/Text";

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const STEPS = [
  {
    id: '1',
    title: 'Universal Control\nFrom Desktop',
    subtitle: 'Take full command of your Android device from any desktop with Connect-X.',
    image: require('../assets/images/onboarding_step1.png'),
  },
  {
    id: '2',
    title: 'Ultra-Low\nLatency Streaming',
    subtitle: 'Experience smooth, high-fidelity remote desktop control in real-time.',
    image: require('../assets/images/onboarding_step2.png'),
  },
  {
    id: '3',
    title: 'Private & Secure\nConnectivity',
    subtitle: 'Your data is encrypted end-to-end between your host and controller.',
    image: require('../assets/images/onboarding_step3.png'),
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < STEPS.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
      setCurrentIndex(currentIndex + 1);
    } else {
      router.replace('/login');
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1 });
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSkip = () => {
    router.replace('/login');
  };

  const renderItem = ({ item }: { item: typeof STEPS[0] }) => (
    <View style={styles.page}>
      <View style={styles.imageWrapper}>
        <View style={styles.imageBackground} />
        <Image source={item.image} style={styles.image} resizeMode="contain" />
      </View>
      
      <View style={styles.indicatorRow}>
        {STEPS.map((_, i) => (
          <View 
            key={i} 
            style={[
              styles.indicator, 
              i === currentIndex ? styles.indicatorActive : styles.indicatorInactive
            ]} 
          />
        ))}
      </View>

      <View style={styles.textContainer}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={STEPS}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setCurrentIndex(index);
        }}
        keyExtractor={(item) => item.id}
      />

      <View style={styles.navigatorContainer}>
        <View style={styles.navigator}>
          <TouchableOpacity 
            onPress={handleBack} 
            disabled={currentIndex === 0}
            style={styles.navButton}
          >
            <ArrowLeft color={currentIndex === 0 ? '#B1B5C4' : '#23262F'} size={24} />
          </TouchableOpacity>
          
          <View style={styles.divider} />
          
          <TouchableOpacity onPress={handleNext} style={styles.navButton}>
            <ArrowRight color="#23262F" size={24} />
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
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 30,
    zIndex: 10,
  },
  skipText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#D7D7D7',
  },
  page: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: '10%', // Replaced fixed padding 40
  },
  imageWrapper: {
    marginTop: '15%', // Responsive margin
    width: '100%', // Fills the container based on padding
    height: SCREEN_WIDTH * 0.9, // Make height scale with width
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageBackground: {
    position: 'absolute',
    width: '100%',
    height: '95%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 35,
    top: '10%',
  },
  image: {
    width: '95%',
    height: '100%', // Scale with the wrapper height safely
    borderRadius: 33,
  },
  indicatorRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: '5%',
  },
  indicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginHorizontal: 4,
  },
  indicatorActive: {
    backgroundColor: '#141718',
  },
  indicatorInactive: {
    backgroundColor: 'rgba(35, 38, 47, 0.5)',
  },
  textContainer: {
    marginTop: '8%',
    alignItems: 'center',
  },
  title: {
    fontSize: SCREEN_WIDTH > 350 ? 32 : 28, // Responsive slightly
    fontWeight: '700',
    textAlign: 'center',
    color: '#23262F',
    lineHeight: SCREEN_WIDTH > 350 ? 48 : 40,
  },
  subtitle: {
    fontSize: SCREEN_WIDTH > 350 ? 16 : 14,
    fontWeight: '300',
    textAlign: 'center',
    color: '#8E9295',
    lineHeight: SCREEN_WIDTH > 350 ? 28 : 24,
    marginTop: 15,
  },
  navigatorContainer: {
    position: 'absolute',
    bottom: 50,
    width: '100%',
    alignItems: 'center',
  },
  navigator: {
    width: 154,
    height: 64,
    backgroundColor: '#FCFCFD',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.12,
    shadowRadius: 32,
    elevation: 10,
  },
  navButton: {
    paddingHorizontal: 20,
    height: '100%',
    justifyContent: 'center',
  },
  divider: {
    width: 2,
    height: 24,
    backgroundColor: '#E6E8EC',
  },
});
