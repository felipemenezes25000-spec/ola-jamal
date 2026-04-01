import React from 'react';
import { View, StyleSheet } from 'react-native';
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
  onPressPedidos?: () => void;
  onPressConsultas?: () => void;
}

function StatsGrid_Fn({ stats, responsive }: StatsGridProps) {
  return (
    <View style={styles.grid}>
      <View style={styles.row}>
        <StatCard
          icon={null}
          iconBg={colors.statPendentes}
          title="Pendentes"
          value={stats.pendentes}
          valueColor={colors.statPendentes}
          responsive={responsive}
        />
        <StatCard
          icon={null}
          iconBg={colors.statConcluidos}
          title="Concluídos"
          value={stats.done}
          valueColor={colors.statConcluidos}
          responsive={responsive}
        />
      </View>
      <View style={styles.row}>
        <StatCard
          icon={null}
          iconBg={colors.statReceitas}
          title="Receitas"
          value={stats.prescriptions}
          valueColor={colors.statReceitas}
          responsive={responsive}
        />
        <StatCard
          icon={null}
          iconBg={colors.statConsultas}
          title="Consultas"
          value={stats.consultations}
          valueColor={colors.statConsultas}
          responsive={responsive}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    marginBottom: 20,
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
});

export const StatsGrid = React.memo(StatsGrid_Fn);
