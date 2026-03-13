import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import type { DashboardResponsive } from './useDashboardResponsive';

const { colors, radius, shadow } = clinicalSoftTokens;

interface StatCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  value: string | number;
  valueColor: string;
  responsive: DashboardResponsive;
}

export function StatCard({ icon, iconBg, title, value, valueColor, responsive }: StatCardProps) {
  const { typography, iconSizes } = responsive;
  const iconBoxSize = (iconSizes?.statIcon ?? 22) * 2.4;
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconBox, { backgroundColor: iconBg, width: iconBoxSize, height: iconBoxSize, borderRadius: iconBoxSize * 0.31 }]}>{icon}</View>
      <Text
        style={[styles.statTitle, { fontSize: typography.statTitle, lineHeight: typography.statTitle * 1.3 }]}
        numberOfLines={2}
      >
        {title}
      </Text>
      <Text
        style={[
          styles.statValue,
          {
            color: valueColor,
            fontSize: typography.statValue,
            lineHeight: typography.statValue * 1.1,
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
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 16,
    ...shadow.card,
  },
  statIconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statTitle: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  statValue: {
    marginTop: 4,
    fontWeight: '800',
    letterSpacing: -1,
  },
});
