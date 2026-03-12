import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import { useResponsive } from '../../../lib/ui/responsive';
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
  const { typography, heights } = responsive;
  const { rs } = useResponsive();
  const iconBoxSize = rs(44);
  return (
    <View style={[styles.statCard, { minHeight: heights.statCardMin, paddingHorizontal: rs(14), paddingVertical: rs(14) }]}>
      <View style={[styles.statIconBox, { backgroundColor: iconBg, width: iconBoxSize, height: iconBoxSize }]}>{icon}</View>
      <View style={styles.statTextBlock}>
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
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  statCard: {
    width: '48%',
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    ...shadow.card,
  },
  statIconBox: {
    borderRadius: radius.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  statTextBlock: {
    flex: 1,
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
