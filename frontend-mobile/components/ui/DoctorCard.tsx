/**
 * Card padrão do fluxo médico: branco, radius 16, padding 16–20, sombra suave.
 */

import React from 'react';
import { View, StyleSheet, ViewStyle, Pressable, StyleProp } from 'react-native';
import { colors, doctorDS, shadows } from '../../lib/themeDoctor';

export interface DoctorCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  noPadding?: boolean;
  onPress?: () => void;
}

export function DoctorCard({
  children,
  style,
  noPadding = false,
  onPress,
}: DoctorCardProps) {
  const cardStyle: StyleProp<ViewStyle> = [
    styles.card,
    !noPadding && { padding: doctorDS.cardPadding },
    style,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [...cardStyle, pressed && styles.pressed]}
        accessibilityRole="button"
      >
        {children}
      </Pressable>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: doctorDS.cardRadius,
    overflow: 'hidden',
    ...shadows.card,
  },
  pressed: {
    opacity: 0.95,
  },
});
