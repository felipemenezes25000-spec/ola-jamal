import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';
import { motionTokens } from '../../lib/ui/motion';

interface FadeInProps {
  visible: boolean;
  duration?: number;
  delay?: number;
  fromY?: number;
  fill?: boolean;
  easing?: (value: number) => number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Faz fade-in suave quando `visible` muda para true.
 * Uso: envolver o conteúdo que aparece após loading.
 */
export function FadeIn({
  visible,
  duration = 250,
  delay = 0,
  fromY = 0,
  fill = true,
  easing = motionTokens.easing.default,
  style,
  children,
}: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(fromY)).current;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    if (visible) {
      timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration,
            easing,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration,
            easing,
            useNativeDriver: true,
          }),
        ]).start();
      }, delay);
    } else {
      opacity.setValue(0);
      translateY.setValue(fromY);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible, duration, delay, fromY, easing, opacity, translateY]);

  if (!visible) return null;

  return (
    <Animated.View style={[{ opacity, transform: [{ translateY }], ...(fill ? { flex: 1 } : null) }, style]}>
      {children}
    </Animated.View>
  );
}
