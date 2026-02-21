import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { uiTokens } from '../../lib/ui/tokens';
import { theme } from '../../lib/theme';

interface AppChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  /** Cor de destaque quando selecionado (ex: theme.colors.primary.main) */
  accentColor?: string;
  /** Cor de fundo quando selecionado (ex: theme.colors.primary.soft) */
  accentSoftColor?: string;
  style?: ViewStyle;
}

const CHIP_HEIGHT = 36;
const CHIP_PADDING_H = 16;
const CHIP_BORDER_RADIUS = 20;

export function AppChip({
  label,
  selected = false,
  onPress,
  disabled = false,
  accentColor = theme.colors.primary.main,
  accentSoftColor = theme.colors.primary.soft,
  style,
}: AppChipProps) {
  return (
    <Pressable
      style={[
        styles.chip,
        selected && { backgroundColor: accentSoftColor, borderColor: accentColor },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <Text
        style={[styles.chipText, selected && { color: accentColor, fontWeight: '700' }]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: CHIP_HEIGHT,
    paddingHorizontal: CHIP_PADDING_H,
    borderRadius: CHIP_BORDER_RADIUS,
    backgroundColor: theme.colors.background.paper,
    borderWidth: 1.5,
    borderColor: theme.colors.border.main,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.colors.text.secondary,
  },
});

export const appChipConstants = { CHIP_HEIGHT, CHIP_PADDING_H, CHIP_BORDER_RADIUS };
