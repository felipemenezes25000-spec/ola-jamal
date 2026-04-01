import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import type { DashboardResponsive } from './useDashboardResponsive';

const { colors, radius } = clinicalSoftTokens;

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string | number;
  valueColor: string;
  responsive: DashboardResponsive;
}

export function StatCard({ icon, iconBg, title, value, valueColor, responsive }: StatCardProps) {
  const { typography } = responsive;
  return (
    <View style={styles.statCard}>
      <View style={styles.statRow}>
        <View style={[styles.statIconDot, { backgroundColor: iconBg }]} />
        <Text
          style={[styles.statTitle, { fontSize: typography.statTitle }]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <Text
        style={[
          styles.statValue,
          {
            color: valueColor,
            fontSize: typography.statValue,
            lineHeight: typography.statValue * 1.15,
          },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    width: '48%',
    borderRadius: radius.iconBox,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statIconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statTitle: {
    color: colors.secondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statValue: {
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
