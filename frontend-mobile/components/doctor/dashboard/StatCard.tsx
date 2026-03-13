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
  const { typography, heights } = responsive;
  return (
    <View style={[styles.statCard, { minHeight: heights.statCardMin }]}>
      <View style={[styles.statIconBox, { backgroundColor: iconBg }]}>{icon}</View>
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
          adjustsFontSizeToFit
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
    paddingHorizontal: 18,
    paddingVertical: 18,
    ...shadow.card,
  },
  statIconBox: {
    width: 58,
    height: 58,
    borderRadius: radius.iconBox,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statTextBlock: {
    flex: 1,
  },
  statTitle: {
    color: colors.primaryDark,
    fontWeight: '700',
  },
  statValue: {
    marginTop: 8,
    fontWeight: '800',
    letterSpacing: -1,
  },
});
