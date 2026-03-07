import React from 'react';
import { View, Pressable, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';

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
  const { colors, borderRadius, shadows, spacing } = useAppTheme();

  const cardStyles: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    ...(variant === 'outlined' ? { borderWidth: 1, borderColor: colors.borderLight } : {}),
    ...(selected ? { borderColor: colors.primary, backgroundColor: colors.surfaceSecondary } : {}), // primarySoft removido, usando surface sec
    ...(variant === 'default' ? shadows.card : {}),
    ...(variant === 'elevated' ? shadows.elevated : {}),
  } as ViewStyle; // Cast to avoid TS complexity with shadows type

  const paddingStyle = !noPadding ? { padding: spacing.md } : undefined;

  // Selected state override
  const selectedStyle = selected ? {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft, // Now safe from theme hook
  } : undefined;

  const combinedStyles: StyleProp<ViewStyle> = [
    cardStyles,
    paddingStyle,
    selectedStyle,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          combinedStyles,
          pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] },
        ]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        {children}
      </Pressable>
    );
  }

  return <View style={combinedStyles}>{children}</View>;
}
