import React, { useCallback } from 'react';
import { Dimensions, StyleSheet, View, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { clamp, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const PDF_HEIGHT = Math.min(600, SCREEN_HEIGHT - 200);

interface ZoomablePdfViewProps {
  children: React.ReactNode;
}

export function ZoomablePdfView({ children }: ZoomablePdfViewProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const handleWheel = useCallback((e: { nativeEvent?: { deltaY?: number; preventDefault?: () => void } }) => {
    if (Platform.OS !== 'web') return;
    e?.nativeEvent?.preventDefault?.();
    const deltaY = e?.nativeEvent?.deltaY ?? 0;
    const delta = -deltaY * 0.004;
    const newScale = Math.max(0.5, Math.min(4, scale.value + delta));
    scale.value = newScale;
    savedScale.value = newScale;
    if (newScale <= 1) {
      translateX.value = 0;
      translateY.value = 0;
      savedTranslateX.value = 0;
      savedTranslateY.value = 0;
    }
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 0.5, 4);
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value <= 1) {
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  const panGesture = Gesture.Pan()
    .minPointers(1)
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        scale.value = 1;
        savedScale.value = 1;
        translateX.value = 0;
        translateY.value = 0;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = 2;
        savedScale.value = 2;
      }
    });

  const composed = Gesture.Simultaneous(pinchGesture, panGesture, doubleTapGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const content = (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.container, animatedStyle]}>
        {children}
      </Animated.View>
    </GestureDetector>
  );

  if (Platform.OS === 'web') {
    return (
      <View style={styles.wrapper} {...({ onWheel: handleWheel } as any)}>
        {content}
      </View>
    );
  }

  return <View style={styles.wrapper}>{content}</View>;
}

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: PDF_HEIGHT,
    overflow: 'hidden',
    borderRadius: 8,
  },
  container: {
    width: SCREEN_WIDTH,
    height: PDF_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
