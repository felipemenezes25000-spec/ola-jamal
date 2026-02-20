import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../lib/theme';

interface PulsingNotificationIconProps {
  color: string;
  size: number;
  hasUnread: boolean;
}

/**
 * Ícone de notificação que pulsa quando há não lidas.
 * Usado na tab do médico para chamar atenção imediatamente - ele não pode perder tempo.
 */
export function PulsingNotificationIcon({ color, size, hasUnread }: PulsingNotificationIconProps) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (hasUnread) {
      scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 500, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 500, easing: Easing.in(Easing.ease) })
        ),
        -1,
        true
      );
    } else {
      cancelAnimation(scale);
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [hasUnread]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Quando há não lidas, usa cor de alerta para destacar
  const iconColor = hasUnread ? colors.error : color;

  return (
    <Animated.View style={[{ alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, animatedStyle]}>
      <Ionicons name="notifications" size={size} color={iconColor} />
    </Animated.View>
  );
}
