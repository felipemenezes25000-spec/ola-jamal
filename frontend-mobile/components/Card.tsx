import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';

// Web: react-native-web deprecia shadow*; usar boxShadow.
const shadowDefault =
  Platform.OS === 'web'
    ? { boxShadow: '0px 1px 3px rgba(0,0,0,0.04)' }
    : shadows.sm;
const shadowElevated =
  Platform.OS === 'web'
    ? { boxShadow: '0px 4px 16px rgba(0,0,0,0.08)' }
    : shadows.lg;

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'outlined';
  noPadding?: boolean;
}

export function Card({ children, style, variant = 'default', noPadding = false }: CardProps) {
  return (
    <View
      style={[
        styles.base,
        !noPadding && styles.padding,
        variant === 'elevated' && shadowElevated,
        variant === 'outlined' && styles.outlined,
        variant === 'default' && shadowDefault,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
  },
  padding: {
    padding: spacing.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: colors.gray200,
  },
});
