import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { useResponsive } from '../../lib/ui/responsive';

export interface TopSummaryItem {
  label: string;
  value: string | number;
}

interface TopSummaryStripProps {
  items: TopSummaryItem[];
  compact?: boolean;
}

export function TopSummaryStrip({ items, compact = false }: TopSummaryStripProps) {
  const { colors } = useAppTheme();
  const { rs, isCompact, screenPad } = useResponsive();
  const styles = useMemo(() => makeStyles(colors, rs), [colors, rs]);

  const content = items.map((item) => (
    <View key={item.label} style={[styles.card, isCompact && items.length >= 3 && { minWidth: rs(90), flex: 0 }]}>
      <Text style={[styles.value, compact && styles.valueCompact]} numberOfLines={1}>{item.value}</Text>
      <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
    </View>
  ));

  if (isCompact && items.length >= 3) {
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, compact && styles.rowCompact, { paddingHorizontal: screenPad }]}
      >
        {content}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.row, compact && styles.rowCompact, { paddingHorizontal: screenPad }]}>
      {content}
    </View>
  );
}

function makeStyles(colors: { surface: string; borderLight: string; text: string; textMuted: string }, rs: (v: number) => number) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
      marginBottom: 6,
    },
    rowCompact: {
      marginBottom: 4,
    },
    card: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.borderLight,
      paddingVertical: rs(10),
      paddingHorizontal: rs(10),
    },
    value: {
      fontSize: rs(18),
      fontWeight: '700',
      color: colors.text,
    },
    valueCompact: {
      fontSize: rs(16),
    },
    label: {
      marginTop: 2,
      fontSize: 11,
      color: colors.textMuted,
    },
  });
}
