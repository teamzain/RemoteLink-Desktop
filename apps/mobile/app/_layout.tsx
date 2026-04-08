import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import '../global.css';
import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, Lato_100Thin, Lato_300Light, Lato_400Regular, Lato_700Bold, Lato_900Black } from '@expo-google-fonts/lato';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ErrorModal } from '@/components/ErrorModal';
import { presenceService } from '@/src/services/presenceService';

export const unstable_settings = {
  anchor: '(tabs)',
};

// Prevent auto hiding splash screen
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  const [loaded, error] = useFonts({
    Lato_100Thin,
    Lato_300Light,
    Lato_400Regular,
    Lato_700Bold,
    Lato_900Black,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  useEffect(() => {
    presenceService.connect();
    return () => {
      presenceService.disconnect();
    };
  }, []);

  useEffect(() => {
    // Round 7: Ultra-Safe KeepAwake activation
    // Wrapped in a delay to avoid Expo boot-time race conditions
    let active = true;
    const setupKeepAwake = async () => {
      try {
        await new Promise(r => setTimeout(r, 2000));
        if (!active) return;
        const { activateKeepAwakeAsync } = await import('expo-keep-awake');
        await activateKeepAwakeAsync();
        console.log('[Root] KeepAwake active');
      } catch (e) {
        // Silently fail as this is the primary cause of console noise
      }
    };
    setupKeepAwake();
    return () => {
      active = false;
      import('expo-keep-awake').then(m => m.deactivateKeepAwake()).catch(() => {});
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: 'fade',
            animationDuration: 300,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="session" options={{ animation: 'fade' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <ErrorModal />
        <StatusBar style="auto" />
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
