import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { theme } from '../lib/theme';
import { uiTokens } from '../lib/ui/tokens';
import { AppChip } from './ui/AppChip';

const c = theme.colors;
const s = theme.spacing;

export interface RequestTypeFilterItem {
  key: string;
  label: string;
}

interface RequestTypeFilterProps {
  items: RequestTypeFilterItem[];
  value: string;
  onValueChange: (key: string) => void;
  disabled?: boolean;
  variant?: 'patient' | 'doctor';
}

export function RequestTypeFilter({
  items,
  value,
  onValueChange,
  disabled = false,
  variant = 'patient',
}: RequestTypeFilterProps) {
  const accent = variant === 'doctor' ? '#0077B6' : c.primary.main;
  const accentSoft = variant === 'doctor' ? '#E0F2FE' : c.primary.soft;

  return (
    <View style={styles.wrapper}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item) => (
          <AppChip
            key={item.key}
            label={item.label}
            selected={value === item.key}
            onPress={() => onValueChange(item.key)}
            disabled={disabled}
            accentColor={accent}
            accentSoftColor={accentSoft}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingVertical: s.sm,
    backgroundColor: c.background.default,
  },
  scrollContent: {
    flexDirection: 'row',
    paddingHorizontal: uiTokens.screenPaddingHorizontal,
    gap: 8,
  },
});
