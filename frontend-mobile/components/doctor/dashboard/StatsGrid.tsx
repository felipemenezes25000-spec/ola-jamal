import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import type { DashboardResponsive } from './useDashboardResponsive';

const { colors, radius, shadow } = clinicalSoftTokens;

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

interface MetricProps {
  value: number;
  label: string;
  valueColor: string;
  fontSize: number;
  labelSize: number;
}

function Metric({ value, label, valueColor, fontSize, labelSize }: MetricProps) {
  return (
    <View style={styles.metric}>
      <Text
        style={[styles.metricValue, { fontSize, color: valueColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text style={[styles.metricLabel, { fontSize: labelSize }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

export function StatsGrid({ stats, responsive, onPressPedidos, onPressConsultas }: StatsGridProps) {
  const { typography } = responsive;
  const valSize = typography.statValue * 0.85;
  const lblSize = typography.quickLabel * 0.92;

  return (
    <View style={styles.grid}>
      <TouchableOpacity
        style={styles.card}
        activeOpacity={onPressPedidos ? 0.7 : 1}
        onPress={onPressPedidos}
        accessibilityRole={onPressPedidos ? 'button' : 'none'}
        accessibilityLabel="Ver pedidos"
      >
        <Text style={[styles.cardLabel, { fontSize: lblSize }]}>Pedidos</Text>
        <View style={styles.metricsRow}>
          <Metric value={stats.pendentes} label="pendentes" valueColor={colors.danger} fontSize={valSize} labelSize={lblSize} />
          <View style={styles.divider} />
          <Metric value={stats.done} label="atendidos" valueColor={colors.success} fontSize={valSize} labelSize={lblSize} />
          <View style={styles.divider} />
          <Metric value={stats.prescriptions} label="receitas" valueColor={colors.primaryDark} fontSize={valSize} labelSize={lblSize} />
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cardCompact}
        activeOpacity={onPressConsultas ? 0.7 : 1}
        onPress={onPressConsultas}
        accessibilityRole={onPressConsultas ? 'button' : 'none'}
        accessibilityLabel="Ver consultas"
      >
        <Text style={[styles.cardLabel, { fontSize: lblSize }]}>Consultas</Text>
        <Text
          style={[styles.consultValue, { fontSize: valSize * 1.15, color: colors.primary }]}
          numberOfLines={1}
        >
          {stats.consultations}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  card: {
    flex: 3,
    borderRadius: radius.card - 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    ...shadow.card,
  },
  cardCompact: {
    flex: 1,
    borderRadius: radius.card - 4,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
    ...shadow.card,
  },
  cardLabel: {
    color: colors.secondary,
    fontWeight: '600',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricValue: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  metricLabel: {
    color: colors.secondary,
    fontWeight: '500',
    marginTop: 2,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: '#ECF0F5',
  },
  consultValue: {
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
