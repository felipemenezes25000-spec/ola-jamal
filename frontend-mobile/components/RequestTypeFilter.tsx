import React from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { theme } from '../lib/theme';

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
        {items.map((item) => {
          const isSelected = value === item.key;
          return (
            <Pressable
              key={item.key}
              style={[
                styles.chip,
                isSelected && { backgroundColor: accentSoft, borderColor: accent },
              ]}
              onPress={() => !disabled && onValueChange(item.key)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected, disabled }}
            >
              <Text
                style={[
                  styles.chipText,
                  isSelected && { color: accent, fontWeight: '700' },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
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
    paddingHorizontal: 20,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 100,
    backgroundColor: c.background.paper,
    borderWidth: 1.5,
    borderColor: c.border.main,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.text.secondary,
  },
});
