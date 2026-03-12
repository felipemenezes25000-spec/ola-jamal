import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import { useResponsive } from '../../../lib/ui/responsive';
import { haptics } from '../../../lib/haptics';

const { colors, radius } = clinicalSoftTokens;

interface CertificateAlertProps {
  onPress: () => void;
}

export function CertificateAlert({ onPress }: CertificateAlertProps) {
  const { rs } = useResponsive();
  const iconSize = rs(36);
  return (
    <TouchableOpacity
      style={[styles.certAlert, { padding: rs(14), gap: rs(12) }]}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Configurar certificado digital"
    >
      <View style={[styles.certIconWrap, { width: iconSize, height: iconSize }]}>
        <Feather name="shield" size={rs(20)} color={colors.warningAccent} />
      </View>
      <View style={styles.certText}>
        <Text style={styles.certTitle}>Certificado Digital pendente</Text>
        <Text style={styles.certDesc}>
          Configure para assinar receitas digitalmente.
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color={colors.warningAccent} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  certAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.banner,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(242, 161, 0, 0.3)',
    backgroundColor: colors.warningBg,
  },
  certIconWrap: {
    borderRadius: 12,
    backgroundColor: 'rgba(242, 161, 0, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  certText: { flex: 1, minWidth: 0 },
  certTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#624E33',
    marginBottom: 2,
  },
  certDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: colors.secondary,
  },
});
