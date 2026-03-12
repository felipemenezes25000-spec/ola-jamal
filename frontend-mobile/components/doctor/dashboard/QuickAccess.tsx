import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import { useResponsive } from '../../../lib/ui/responsive';
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
  const { rs, isCompact } = useResponsive();
  const iconBoxSize = rs(36);
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
          style={[styles.quickButton, { height: heights.quickButton, justifyContent: isCompact ? 'center' : 'flex-start' }]}
          onPress={() => {
            haptics.selection();
            onPedidos();
          }}
          accessibilityRole="button"
          accessibilityLabel="Pedidos"
        >
          <View style={[styles.quickIconBox, { width: iconBoxSize, height: iconBoxSize, marginRight: isCompact ? 0 : 8 }]}>
            <Feather name="file-text" size={rs(18)} color="#28A7F0" />
          </View>
          {!isCompact && (
            <Text style={[styles.quickLabel, { fontSize: typography.quickLabel }]} numberOfLines={1}>
              Pedidos
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.quickButton, { height: heights.quickButton, justifyContent: isCompact ? 'center' : 'flex-start' }]}
          onPress={() => {
            haptics.selection();
            onAlertas();
          }}
          accessibilityRole="button"
          accessibilityLabel="Alertas"
        >
          <View style={[styles.quickIconBox, { width: iconBoxSize, height: iconBoxSize, marginRight: isCompact ? 0 : 8 }]}>
            <Feather name="bell" size={rs(18)} color="#28A7F0" />
          </View>
          {!isCompact && (
            <Text style={[styles.quickLabel, { fontSize: typography.quickLabel }]} numberOfLines={1}>
              Alertas
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.quickButton, { height: heights.quickButton, justifyContent: isCompact ? 'center' : 'flex-start' }]}
          onPress={() => {
            haptics.selection();
            onCertificados();
          }}
          accessibilityRole="button"
          accessibilityLabel="Certificados"
        >
          <View style={[styles.quickIconBox, { width: iconBoxSize, height: iconBoxSize, marginRight: isCompact ? 0 : 8 }]}>
            <Feather name="shield" size={rs(18)} color="#28A7F0" />
          </View>
          {!isCompact && (
            <Text style={[styles.quickLabel, { fontSize: typography.quickLabel }]} numberOfLines={1}>
              Certificados
            </Text>
          )}
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
    marginBottom: 12,
  },
  quickRow: {
    flexDirection: 'row',
    gap: 10,
  },
  quickButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow.quickButton,
  },
  quickIconBox: {
    borderRadius: radius.iconBoxSmall,
    backgroundColor: '#EFF8FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickLabel: {
    flex: 1,
    color: colors.primaryDark,
    fontWeight: '600',
  },
});
