import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { uiTokens } from '../../lib/ui/tokens';

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
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <View style={[styles.row, compact && styles.rowCompact]}>
      {items.map((item) => (
        <View key={item.label} style={styles.card}>
          <Text style={[styles.value, compact && styles.valueCompact]} numberOfLines={1}>{item.value}</Text>
          <Text style={styles.label} numberOfLines={1}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function makeStyles(colors: { surface: string; borderLight: string; text: string; textMuted: string }) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: uiTokens.screenPaddingHorizontal,
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
      paddingVertical: 10,
      paddingHorizontal: 10,
    },
    value: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
    },
    valueCompact: {
      fontSize: 16,
    },
    label: {
      marginTop: 2,
      fontSize: 11,
      color: colors.textMuted,
    },
  });
}
