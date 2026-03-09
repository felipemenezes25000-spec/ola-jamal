/**
 * Card padrão do fluxo médico: surface do tema (light/dark), radius 16, padding 16–20, sombra suave.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, StyleProp } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';

export interface DoctorCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function DoctorCard({
  children,
  style,
  noPadding = false,
  onPress,
  accessibilityLabel,
}: DoctorCardProps) {
  const { colors, borderRadius, shadows: themeShadows } = useAppTheme({ role: 'doctor' });
  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.card,
      borderColor: colors.borderLight,
      ...themeShadows.card,
    },
    !noPadding && { padding: 16 },
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
  card: {
    overflow: 'hidden',
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.93,
    transform: [{ scale: 0.99 }],
  },
});
