import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import { haptics } from '../../../lib/haptics';
import type { DashboardResponsive } from './useDashboardResponsive';

const { colors, radius } = clinicalSoftTokens;

interface QuickAccessProps {
  onPedidos: () => void;
  onAlertas: () => void;
  onProntuarios: () => void;
  responsive: DashboardResponsive;
}

export function QuickAccess({ onPedidos, onAlertas, onProntuarios, responsive }: QuickAccessProps) {
  const { typography, heights, iconSizes } = responsive;
  const iconSize = iconSizes?.quickIcon ?? 20;
  return (
    <View style={styles.quickSection}>
      <Text
        style={[styles.sectionTitle, { fontSize: typography.sectionTitle, lineHeight: typography.sectionTitle * 1.25 }]}
      >
        Acessos rápidos
      </Text>

      <View style={styles.quickRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.quickButton, { minHeight: heights.quickButton }]}
          onPress={() => {
            haptics.selection();
            onPedidos();
          }}
          accessibilityRole="button"
          accessibilityLabel="Pedidos"
        >
          <View style={[styles.quickIconBox, { backgroundColor: '#DBEAFE' }]}>
            <Feather name="clipboard" size={iconSize} color="#3B82F6" />
          </View>
          <Text style={[styles.quickLabel, { fontSize: typography.quickLabel }]} numberOfLines={1}>
            Pedidos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.quickButton, { minHeight: heights.quickButton }]}
          onPress={() => {
            haptics.selection();
            onAlertas();
          }}
          accessibilityRole="button"
          accessibilityLabel="Alertas"
        >
          <View style={[styles.quickIconBox, { backgroundColor: '#FEF3C7' }]}>
            <Feather name="bell" size={iconSize} color="#F59E0B" />
          </View>
          <Text style={[styles.quickLabel, { fontSize: typography.quickLabel }]} numberOfLines={1}>
            Alertas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          style={[styles.quickButton, { minHeight: heights.quickButton }]}
          onPress={() => {
            haptics.selection();
            onProntuarios();
          }}
          accessibilityRole="button"
          accessibilityLabel="Prontuários"
        >
          <View style={[styles.quickIconBox, { backgroundColor: '#DCFCE7' }]}>
            <Feather name="check-square" size={iconSize} color="#22C55E" />
          </View>
          <Text style={[styles.quickLabel, { fontSize: typography.quickLabel }]} numberOfLines={1}>
            Prontuários
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#0F172A',
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  quickButton: {
    flex: 1,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 10,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  quickIconBox: {
    width: 36,
    height: 36,
    borderRadius: radius.iconBoxSmall,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: {
    color: '#0F172A',
    fontWeight: '600',
    textAlign: 'center',
  },
});
