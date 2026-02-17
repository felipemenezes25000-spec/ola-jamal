import React from 'react';
import { View, Text, StyleSheet, Pressable, useWindowDimensions } from 'react-native';
import { colors, spacing, borderRadius, shadows } from '../lib/theme';

const MIN_TOUCH_HEIGHT = 48;
const H_PADDING = spacing.lg;
const GAP = spacing.sm;
/** Largura abaixo da qual reduzimos padding e fontSize para caber os 4 textos completos */
const NARROW_BREAKPOINT = 360;

export interface RequestTypeFilterItem {
  key: string;
  label: string;
}

interface RequestTypeFilterProps {
  items: RequestTypeFilterItem[];
  value: string;
  onValueChange: (key: string) => void;
  disabled?: boolean;
  /** 'patient' = primary blue, 'doctor' = secondary green */
  variant?: 'patient' | 'doctor';
}

export function RequestTypeFilter({
  items,
  value,
  onValueChange,
  disabled = false,
  variant = 'patient',
}: RequestTypeFilterProps) {
  const { width } = useWindowDimensions();
  const isNarrow = width < NARROW_BREAKPOINT;
  const paddingH = isNarrow ? spacing.xs : spacing.sm;
  const fontSize = isNarrow ? 12 : 14;

  const accent = variant === 'doctor' ? colors.secondary : colors.primary;
  const accentSoft = variant === 'doctor' ? '#D1FAE5' : '#E0F2FE';

  return (
    <View style={styles.wrapper}>
      <View style={[styles.row, { gap: GAP }]} testID="request-type-filter">
        {items.map((item) => {
          const isSelected = value === item.key;
          return (
            <Pressable
              key={item.key}
              style={[
                styles.button,
                {
                  minHeight: MIN_TOUCH_HEIGHT,
                  paddingHorizontal: paddingH,
                  backgroundColor: isSelected ? accentSoft : colors.surface,
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? accent : colors.border,
                },
              ]}
              onPress={() => !disabled && onValueChange(item.key)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
              accessibilityLabel={item.label}
            >
              <Text
                style={[
                  styles.buttonText,
                  { fontSize, letterSpacing: isNarrow ? -0.2 : 0 },
                  isSelected && { color: accent, fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: H_PADDING,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
  },
  button: {
    flex: 1,
    flexShrink: 0,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    minHeight: MIN_TOUCH_HEIGHT,
  },
  buttonText: {
    fontWeight: '600',
    color: colors.textSecondary,
  },
});
