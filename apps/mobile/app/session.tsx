import React, { useEffect, useState, useRef, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions, Platform, StatusBar, TextInput, ViewProps } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { 
  ChevronLeft, 
  Keyboard as KeyboardIcon, 
  RefreshCw, 
  MoreVertical, 
  CircleAlert, 
  X
} from 'lucide-react-native';
import { RTCView } from 'react-native-webrtc';
import * as ScreenOrientation from 'expo-screen-orientation';
import { useKeepAwake } from 'expo-keep-awake';
import { GestureDetector, Gesture, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming, 
  interpolate,
  runOnJS
} from 'react-native-reanimated';
import { useSessionStore } from '../src/stores/sessionStore';
import { Text } from "@/components/Text";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function SessionViewerScreen() {
  const router = useRouter();
  const { deviceId, deviceName, deviceType } = useLocalSearchParams<{ 
    deviceId: string, 
    deviceName: string, 
    deviceType: string 
  }>();
  const { 
    remoteStream, 
    remoteCursor,
    isConnected, 
    isConnecting, 
    error, 
    connect, 
    disconnect, 
    sendInput 
  } = useSessionStore();

  const [showControls, setShowControls] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [keyboardText, setKeyboardText] = useState('');
  const keyboardInputRef = useRef<TextInput>(null);
  const videoLayout = useSharedValue({ x: 0, y: 0, width: 0, height: 0 });
  const lastScrollY = useRef(0);
  const lastScrollX = useRef(0);

  const controlsOpacity = useSharedValue(1);
  const controlsY = useSharedValue(0);

  // Throttling: separate refs for pan (16ms = 60fps) and scroll (32ms prevents overlapping swipes)
  const lastMoveTime = useRef(0);
  const lastScrollTime = useRef(0);
  const THROTTLE_MS = 16;
  const SCROLL_THROTTLE_MS = 32;

  useEffect(() => {
    // Adaptive Orientation
    const isMobile = deviceType === 'android' || deviceType === 'ios' || deviceType === 'Smartphone';
    if (!isMobile) {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    } else {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    }
    
    StatusBar.setHidden(true);
    
    if (deviceId) {
      connect(deviceId);
    }

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      StatusBar.setHidden(false);
      disconnect();
    };
  }, [deviceId]);

  useEffect(() => {
    if (showControls && !showKeyboard) {
      const timer = setTimeout(() => {
        hideControls();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [showControls, showKeyboard]);

  const toggleControls = () => {
    if (showControls) hideControls();
    else showControlsNow();
  };

  const showControlsNow = () => {
    setShowControls(true);
    controlsOpacity.value = withTiming(1);
    controlsY.value = withTiming(0);
  };

  const hideControls = () => {
    setShowControls(false);
    controlsOpacity.value = withTiming(0);
    controlsY.value = withTiming(-100);
  };

  // Coordinate normalization
  const normalizeCoordinates = (lx: number, ly: number) => {
    const { width, height, x: offsetX, y: offsetY } = videoLayout.value;
    if (width === 0 || height === 0) {
      console.warn('[Viewer] Layout not ready for normalization:', videoLayout.value);
      return null;
    }

    // We assume RTCView 'contain' mode logic
    const nx = Math.max(0, Math.min(1, (lx - offsetX) / width));
    const ny = Math.max(0, Math.min(1, (ly - offsetY) / height));
    console.log(`[Viewer] Normalized touch: (${lx}, ${ly}) -> (${nx.toFixed(3)}, ${ny.toFixed(3)})`);
    return { x: nx, y: ny };
  };

  // Gestures
  const tapGesture = Gesture.Tap()
    .runOnJS(true)
    .onEnd((event) => {
      const coords = normalizeCoordinates(event.x, event.y);
      if (coords) {
        // Send both together — host uses dispatchClick(80ms) so we don't need an artificial delay
        sendInput({ type: 'mousedown', button: 0, x: coords.x, y: coords.y });
        sendInput({ type: 'mouseup', button: 0, x: coords.x, y: coords.y });
      }
      // Toggle controls on tap
      showControlsNow();
    });

  const longPressGesture = Gesture.LongPress()
    .runOnJS(true)
    .onEnd((event) => {
      const coords = normalizeCoordinates(event.x, event.y);
      if (coords) {
        sendInput({ type: 'mousedown', button: 2, x: coords.x, y: coords.y });
        sendInput({ type: 'mouseup', button: 2, x: coords.x, y: coords.y });
      }
    });

  // Single-finger Pan (Moving Windows/Icons)
  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .maxPointers(1)
    .onStart((event) => {
      const coords = normalizeCoordinates(event.x, event.y);
      if (coords) {
        sendInput({ type: 'mousedown', button: 0, x: coords.x, y: coords.y });
      }
    })
    .onUpdate((event) => {
      const now = Date.now();
      if (now - lastMoveTime.current < THROTTLE_MS) return;
      lastMoveTime.current = now;

      const coords = normalizeCoordinates(event.x, event.y);
      if (coords) {
        sendInput({ type: 'mousemove', x: coords.x, y: coords.y });
      }
    })
    .onEnd((event) => {
       const coords = normalizeCoordinates(event.x, event.y);
       if (coords) {
         sendInput({ type: 'mouseup', button: 0, x: coords.x, y: coords.y });
       }
    });

  // Top-Edge Swipe (Mobile Menu / Windows Notifications)
  const edgeSwipeGesture = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((event) => {
      // Must start in the top 120px of the screen
      if (event.y < 120 && event.translationY > 40) {
        showControlsNow();
        // If swipe is deep, send the system shortcut
        if (event.translationY > 150) {
          sendInput({ type: 'shortcut', key: 'notifications' });
        }
      }
    });

  // Two-finger Scroll (Mouse Wheel)
  const scrollGesture = Gesture.Pan()
    .runOnJS(true)
    .minPointers(2)
    .onStart(() => {
      lastScrollY.current = 0;
      lastScrollX.current = 0;
    })
    .onUpdate((event) => {
      const now = Date.now();
      if (now - lastScrollTime.current < SCROLL_THROTTLE_MS) return;
      lastScrollTime.current = now;

      // Calculate incremental delta
      const dy = event.translationY - lastScrollY.current;
      const dx = event.translationX - lastScrollX.current;

      lastScrollY.current = event.translationY;
      lastScrollX.current = event.translationX;

      // Skip micro-movements (< 2px) to avoid flooding tiny swipes
      if (Math.abs(dy) < 2 && Math.abs(dx) < 2) return;

      // Pass actual touch position so host scrolls under the fingers
      const coords = normalizeCoordinates(event.x, event.y);
      const px = coords?.x ?? 0.5;
      const py = coords?.y ?? 0.5;

      // Send wheel events (inverted for natural scrolling)
      sendInput({
        type: 'wheel',
        deltaX: -dx,
        deltaY: -dy,
        x: px, y: py
      });
    });

  const composedGesture = Gesture.Race(
    edgeSwipeGesture,
    scrollGesture, 
    panGesture, 
    Gesture.Exclusive(longPressGesture, tapGesture)
  );

  const animatedTopBarStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
    transform: [{ translateY: controlsY.value }]
  }));

  const handleKeyboardSubmit = () => {
    if (keyboardText) {
      sendInput({ type: 'typeText', text: keyboardText });
      setKeyboardText('');
    }
  };

  const renderLoading = () => (
    <View style={styles.loadingContainer}>
      {error ? (
        <View style={styles.errorCard}>
          <CircleAlert color="#F44336" size={48} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => connect(deviceId!)}>
            <Text style={styles.retryButtonText}>RETRY CONNECTION</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.loaderWrapper}>
          <ActivityIndicator color="#141718" size="large" />
          <Text style={styles.loaderTitle}>ESTABLISHING ENCRYPTED LINK</Text>
          <Text style={styles.loaderSubtitle}>{deviceName?.toUpperCase()}</Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      
      {!isConnected || !remoteStream ? (
        renderLoading()
      ) : (
        <>
          <GestureDetector gesture={composedGesture}>
            <View 
              style={styles.videoContainer}
              onLayout={(e) => {
                videoLayout.value = e.nativeEvent.layout;
              }}
            >
              <RTCView
                streamURL={remoteStream.toURL()}
                style={styles.rtcView}
                objectFit="contain"
              />

              {/* Remote Native Cursor Overlay */}
              {remoteCursor && remoteCursor.visible && (
                <View 
                  pointerEvents="none"
                  style={[
                    styles.remoteCursor,
                    {
                      left: (remoteCursor.x * videoLayout.value.width) + videoLayout.value.x,
                      top: (remoteCursor.y * videoLayout.value.height) + videoLayout.value.y,
                    }
                  ]}
                >
                  <View style={styles.cursorPointer} />
                </View>
              )}
            </View>
          </GestureDetector>

          {/* Top Bar Overlay */}
          <Animated.View style={[styles.topBar, animatedTopBarStyle]}>
            <TouchableOpacity style={styles.iconBtn} onPress={() => router.back()}>
              <ChevronLeft color="#FFFFFF" size={24} />
            </TouchableOpacity>
            
            <View style={styles.glassCapsule}>
              <View style={[styles.statusDot, isConnected ? styles.dotGreen : styles.dotYellow]} />
              <Text style={styles.deviceIdText}>{deviceName?.toUpperCase()}</Text>
              
              <TouchableOpacity 
                style={styles.innerIconBtn} 
                onPress={() => {
                  setShowKeyboard(!showKeyboard);
                  if (!showKeyboard) {
                    setTimeout(() => keyboardInputRef.current?.focus(), 100);
                  }
                }}
              >
                <KeyboardIcon color={showKeyboard ? '#141718' : 'rgba(255,255,255,0.3)'} size={18} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.innerIconBtn}
                onPress={() => sendInput({ type: 'request-keyframe' })}
              >
                <RefreshCw color="rgba(255,255,255,0.3)" size={18} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.iconBtn}>
              <MoreVertical color="#FFFFFF" size={24} />
            </TouchableOpacity>
          </Animated.View>

          {/* Keyboard Panel */}
          {showKeyboard && (
            <View style={styles.keyboardPanel}>
              <TextInput
                ref={keyboardInputRef}
                style={styles.keyboardInput}
                placeholder="Inject keystrokes..."
                placeholderTextColor="rgba(255,255,255,0.2)"
                value={keyboardText}
                onChangeText={setKeyboardText}
                onSubmitEditing={handleKeyboardSubmit}
                returnKeyType="send"
                autoFocus
              />
              <TouchableOpacity 
                style={styles.closeKeyboardBtn} 
                onPress={() => setShowKeyboard(false)}
              >
                <X color="#FFFFFF" size={20} />
              </TouchableOpacity>
            </View>
          )}

          {/* Status Pill (when controls hidden) */}
          {!showControls && !showKeyboard && (
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, styles.dotGreen]} />
              <Text style={styles.statusPillText}>DTLS-SRTP ENCRYPTED LINK</Text>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#F7F8FA',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWrapper: {
    alignItems: 'center',
  },
  loaderTitle: {
    marginTop: 32,
    fontSize: 10,
    fontWeight: '900',
    color: 'rgba(0,0,0,0.2)',
    letterSpacing: 3,
  },
  loaderSubtitle: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 1,
  },
  errorCard: {
    marginHorizontal: 40,
    padding: 24,
    backgroundColor: 'rgba(244, 67, 54, 0.05)',
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(244, 67, 54, 0.1)',
  },
  errorText: {
    marginTop: 16,
    color: '#F44336',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 32,
    backgroundColor: '#141718',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 16,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  videoContainer: {
    flex: 1,
  },
  rtcView: {
    flex: 1,
  },
  remoteCursor: {
    position: 'absolute',
    width: 20,
    height: 20,
    zIndex: 10,
  },
  cursorPointer: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#000000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 3,
  },
  topBar: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconBtn: {
    width: 44,
    height: 44,
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  glassCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: {
    backgroundColor: '#4CAF50',
    shadowColor: '#4CAF50',
    shadowRadius: 6,
    shadowOpacity: 0.5,
  },
  dotYellow: {
    backgroundColor: '#FFC107',
  },
  deviceIdText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginHorizontal: 16,
  },
  innerIconBtn: {
    marginLeft: 12,
  },
  keyboardPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#141718',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  keyboardInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    paddingHorizontal: 20,
    height: 48,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  closeKeyboardBtn: {
    marginLeft: 12,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusPill: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  statusPillText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.5,
    marginLeft: 10,
  },
});
