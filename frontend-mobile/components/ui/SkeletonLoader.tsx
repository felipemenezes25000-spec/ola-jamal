import React, { useEffect } from 'react';
import { View, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useAppTheme } from '../../lib/ui/useAppTheme';

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function SkeletonLoader({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}: SkeletonProps) {
  const { colors } = useAppTheme();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900 }),
        withTiming(0.4, { duration: 900 }),
      ),
      -1,
      false,
    );
    return () => { cancelAnimation(opacity); };
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      accessible={false}
      importantForAccessibility="no"
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.border,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

export function SkeletonCard({ style }: { style?: ViewStyle }) {
  const { colors, shadows, borderRadius, spacing } = useAppTheme();

  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: borderRadius.card,
          padding: spacing.md,
          marginBottom: spacing.sm + 2,
          ...shadows.card,
        },
        style,
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={skStyles.row}>
        <SkeletonLoader width={44} height={44} borderRadius={12} />
        <View style={skStyles.textCol}>
          <SkeletonLoader width="70%" height={14} />
          <SkeletonLoader width="50%" height={12} style={{ marginTop: 8 }} />
        </View>
        <SkeletonLoader width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View
      style={skStyles.list}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityLabel="Carregando conteúdo"
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

const skStyles = {
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  textCol: {
    flex: 1,
  },
  list: {
    gap: 8,
  },
};
