import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { clinicalSoftTokens } from './clinicalSoftTokens';
import { haptics } from '../../../lib/haptics';

const { radius } = clinicalSoftTokens;

interface CertificateAlertProps {
  onPress: () => void;
}

export function CertificateAlert({ onPress }: CertificateAlertProps) {
  return (
    <TouchableOpacity
      style={styles.certAlert}
      onPress={() => {
        haptics.selection();
        onPress();
      }}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel="Configurar certificado digital"
    >
      <View style={styles.certIconWrap}>
        <Feather name="alert-triangle" size={18} color="#EF4444" />
      </View>
      <View style={styles.certText}>
        <Text style={styles.certTitle}>Certificado digital não configurado</Text>
        <Text style={styles.certDesc}>
          Configure para assinar receitas digitalmente.
        </Text>
      </View>
      <Feather name="chevron-right" size={16} color="#EF4444" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  certAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: radius.banner,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA', // red-200
    backgroundColor: '#FEF2F2', // red-50
    gap: 12,
  },
  certIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#FEE2E2', // red-100
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  certText: { flex: 1, minWidth: 0 },
  certTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#991B1B', // red-800
    marginBottom: 2,
  },
  certDesc: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    color: '#B91C1C', // red-700
  },
});
