import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../lib/theme';

const c = theme.colors;
const r = theme.borderRadius;

type CardVariant = 'default' | 'elevated' | 'outlined';

interface AppCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: CardVariant;
  noPadding?: boolean;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function AppCard({
  children,
  style,
  variant = 'default',
  noPadding = false,
  selected = false,
  onPress,
  accessibilityLabel,
}: AppCardProps) {
  const cardStyle = [
    styles.base,
    !noPadding && styles.padding,
    variant === 'default' && theme.shadows.card,
    variant === 'elevated' && theme.shadows.elevated,
    variant === 'outlined' && styles.outlined,
    selected && styles.selected,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: c.background.paper,
    borderRadius: r.card,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  padding: {
    padding: theme.spacing.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: c.border.light,
  },
  selected: {
    borderColor: c.primary.main,
    backgroundColor: c.primary.soft,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
});
