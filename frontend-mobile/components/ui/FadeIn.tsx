import React, { useEffect, useRef } from 'react';
import { Animated, ViewStyle, StyleProp } from 'react-native';

interface FadeInProps {
  visible: boolean;
  duration?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/**
 * Faz fade-in suave quando `visible` muda para true.
 * Uso: envolver o conteúdo que aparece após loading.
 */
export function FadeIn({ visible, duration = 250, style, children }: FadeInProps) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        useNativeDriver: true,
      }).start();
    } else {
      opacity.setValue(0);
    }
  }, [visible, duration, opacity]);

  if (!visible) return null;

  return (
    <Animated.View style={[{ opacity, flex: 1 }, style]}>
      {children}
    </Animated.View>
  );
}
