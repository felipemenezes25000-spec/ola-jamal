import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Octicons } from '@expo/vector-icons';
import { Feather } from '@expo/vector-icons';
import { Ionicons } from '@expo/vector-icons';
import { StatCard } from './StatCard';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import type { DashboardResponsive } from './useDashboardResponsive';

const { colors } = clinicalSoftTokens;

interface Stats {
  pendentes: number;
  done: number;
  prescriptions: number;
  consultations: number;
}

interface StatsGridProps {
  stats: Stats;
  responsive: DashboardResponsive;
}

export function StatsGrid({ stats, responsive }: StatsGridProps) {
  return (
    <View style={styles.grid}>
      <StatCard
        responsive={responsive}
        iconBg={colors.dangerLight}
        title="Pendentes"
        value={stats.pendentes}
        valueColor={colors.danger}
        icon={<Octicons name="clock" size={18} color="#FF666A" />}
      />

      <StatCard
        responsive={responsive}
        iconBg={colors.successLight}
        title="Atendidos"
        value={stats.done}
        valueColor={colors.success}
        icon={<Ionicons name="checkmark-circle" size={18} color={colors.success} />}
      />

      <StatCard
        responsive={responsive}
        iconBg={colors.infoLight}
        title="Receitas"
        value={stats.prescriptions}
        valueColor="#455B71"
        icon={<Feather name="file-text" size={18} color="#1DA0F2" />}
      />

      <StatCard
        responsive={responsive}
        iconBg={colors.infoLight}
        title={'Consultas\ndo dia'}
        value={stats.consultations}
        valueColor="#1DA0F2"
        icon={<Ionicons name="videocam" size={18} color="#1DA0F2" />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 18,
  },
});
