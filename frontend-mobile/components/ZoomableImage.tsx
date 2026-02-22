import React, { useCallback } from 'react';
import { Image, StyleSheet, View, Platform, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { clamp, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';

interface ZoomableImageProps {
  uri: string;
  onClose?: () => void;
  showHint?: boolean;
}

export function ZoomableImage({ uri }: ZoomableImageProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
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
    const newScale = Math.max(1, Math.min(6, scale.value + delta));
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
      scale.value = clamp(savedScale.value * e.scale, 1, 6);
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
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
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
        scale.value = 2.5;
        savedScale.value = 2.5;
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

  const imgH = screenH * 0.85;
  const content = (
    <GestureDetector gesture={composed}>
      <Animated.View style={[styles.container, { width: screenW, height: imgH }, animatedStyle]}>
        <Image source={{ uri }} style={{ width: screenW, height: imgH }} resizeMode="contain" />
      </Animated.View>
    </GestureDetector>
  );

  if (Platform.OS === 'web') {
    return (
      <View
        style={[styles.wrapper, { flex: 1, width: '100%', height: '100%' }]}
        // @ts-expect-error onWheel exists on web
        onWheel={handleWheel}
      >
        {content}
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    width: '100%',
    minHeight: 200,
  },
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
