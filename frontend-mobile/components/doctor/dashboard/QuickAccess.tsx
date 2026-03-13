import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import { haptics } from '../../../lib/haptics';
import type { DashboardResponsive } from './useDashboardResponsive';

const { colors, radius, shadow } = clinicalSoftTokens;

interface QuickAccessProps {
  onPedidos: () => void;
  onAlertas: () => void;
  onCertificados: () => void;
  responsive: DashboardResponsive;
}

export function QuickAccess({ onPedidos, onAlertas, onCertificados, responsive }: QuickAccessProps) {
  const { typography, heights } = responsive;
  return (
    <View style={styles.quickSection}>
      <Text
        style={[styles.sectionTitle, { fontSize: typography.sectionTitle, lineHeight: typography.sectionTitle * 1.17 }]}
      >
        Acessos rápidos
      </Text>

      <View style={styles.quickRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.quickButton, { height: heights.quickButton }]}
          onPress={() => {
            haptics.selection();
            onPedidos();
          }}
          accessibilityRole="button"
          accessibilityLabel="Pedidos"
        >
          <View style={styles.quickIconBox}>
            <Feather name="file-text" size={22} color="#28A7F0" />
          </View>
          <Text style={[styles.quickLabel, { fontSize: typography.quickLabel }]} numberOfLines={1}>
            Pedidos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.quickButton, { height: heights.quickButton }]}
          onPress={() => {
            haptics.selection();
            onAlertas();
          }}
          accessibilityRole="button"
          accessibilityLabel="Alertas"
        >
          <View style={styles.quickIconBox}>
            <Feather name="bell" size={22} color="#28A7F0" />
          </View>
          <Text style={[styles.quickLabel, { fontSize: typography.quickLabel }]} numberOfLines={1}>
            Alertas
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.quickButton, { height: heights.quickButton }]}
          onPress={() => {
            haptics.selection();
            onCertificados();
          }}
          accessibilityRole="button"
          accessibilityLabel="Certificados"
        >
          <View style={styles.quickIconBox}>
            <Feather name="shield" size={22} color="#28A7F0" />
          </View>
          <Text style={[styles.quickLabel, { fontSize: typography.quickLabel }]} numberOfLines={1}>
            Certificados
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quickSection: {
    marginBottom: 8,
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 18,
  },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  quickButton: {
    width: '31.2%',
    borderRadius: 22,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.quickButton,
  },
  quickIconBox: {
    width: 46,
    height: 46,
    borderRadius: radius.iconBoxSmall,
    backgroundColor: '#EFF8FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  quickLabel: {
    flex: 1,
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
