import React from 'react';
import { Text, StyleSheet, Pressable, ViewStyle } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';

interface AppChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  disabled?: boolean;
  accentColor?: string;
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
  accentColor,
  accentSoftColor,
  style,
}: AppChipProps) {
  const { colors } = useAppTheme();
  const accent = accentColor ?? colors.primary;
  const accentSoft = accentSoftColor ?? colors.primarySoft;

  return (
    <Pressable
      style={[
        styles.chip,
        {
          backgroundColor: selected ? accentSoft : colors.surface,
          borderColor: selected ? accent : colors.border,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`Filtrar por ${label}`}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? accent : colors.textSecondary },
          selected && { fontWeight: '700' },
        ]}
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
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export const appChipConstants = { CHIP_HEIGHT, CHIP_PADDING_H, CHIP_BORDER_RADIUS };
