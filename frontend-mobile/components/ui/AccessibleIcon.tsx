/**
 * AccessibleIcon — Wrapper for Ionicons used as interactive buttons.
 *
 * Enforces accessibilityLabel when the icon acts as a standalone button.
 * Provides consistent touch target (min 44x44) and screen reader semantics.
 *
 * Usage:
 *   <AccessibleIcon name="close" label="Fechar" onPress={handleClose} />
 *   <AccessibleIcon name="settings" label="Configurações" onPress={openSettings} hint="Abre as configurações" />
 */

import React from 'react';
import { Pressable, StyleSheet, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

interface AccessibleIconProps {
  /** Ionicons icon name */
  name: IconName;
  /** Required accessibility label for screen readers */
  label: string;
  /** Optional accessibility hint (what happens on press) */
  hint?: string;
  /** Icon size (default 22) */
  size?: number;
  /** Icon color */
  color?: string;
  /** Press handler */
  onPress: () => void;
  /** Long press handler */
  onLongPress?: () => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Extra style for the pressable container */
  style?: ViewStyle;
  /** Hit slop for easier tapping */
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
}

export function AccessibleIcon({
  name,
  label,
  hint,
  size = 22,
  color,
  onPress,
  onLongPress,
  disabled,
  style,
  hitSlop = { top: 8, bottom: 8, left: 8, right: 8 },
}: AccessibleIconProps) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      style={({ pressed }) => [
        styles.container,
        style,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
    >
      <Ionicons name={name} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
