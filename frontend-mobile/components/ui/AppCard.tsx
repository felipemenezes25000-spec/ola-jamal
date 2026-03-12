import React from 'react';
import { View, Pressable, StyleProp, ViewStyle } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { useResponsive } from '../../lib/ui/responsive';

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
  const { colors, borderRadius, shadows } = useAppTheme();
  const { rs } = useResponsive();

  const cardStyles: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.card,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.borderLight,
    ...(variant === 'outlined' ? { borderWidth: 1.5, borderColor: colors.border } : {}),
    ...(selected ? { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft } : {}),
    ...(variant === 'default' ? shadows.card : {}),
    ...(variant === 'elevated' ? shadows.elevated : {}),
  } as ViewStyle;

  const paddingStyle = !noPadding ? { padding: rs(16) } : undefined;

  const combinedStyles: StyleProp<ViewStyle> = [
    cardStyles,
    paddingStyle,
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          combinedStyles,
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
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
