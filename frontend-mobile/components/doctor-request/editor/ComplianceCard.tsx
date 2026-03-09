import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../../lib/designSystem';
import { DoctorCard } from '../../ui/DoctorCard';

interface ComplianceCardProps {
  validation: { valid: boolean; messages?: string[]; missingFields?: string[] } | null;
  colors: DesignColors;
}

export const ComplianceCard = React.memo(function ComplianceCard({
  validation, colors,
}: ComplianceCardProps) {
  if (!validation || validation.valid) return null;
  const messages = validation.messages ?? [];
  if (messages.length === 0) return null;

  return (
    <DoctorCard
      style={[styles.card, { borderLeftColor: colors.warning, backgroundColor: colors.warningLight }]}
      noPadding={false}
    >
      <View style={styles.header}>
        <Ionicons name="alert-circle" size={18} color={colors.warning} />
        <Text style={[styles.title, { color: colors.text }]}>Campos obrigatórios</Text>
      </View>
      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Complete os itens abaixo antes de assinar:
      </Text>
      {messages.map((msg, i) => (
        <View key={i} style={styles.item}>
          <Ionicons name="close-circle" size={14} color={colors.error} />
          <Text style={[styles.itemText, { color: colors.text }]}>{msg}</Text>
        </View>
      ))}
    </DoctorCard>
  );
});

const styles = StyleSheet.create({
  card: { marginBottom: 16, borderLeftWidth: 4 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title: { fontSize: 14, fontWeight: '700' },
  hint: { fontSize: 12, marginBottom: 8 },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginBottom: 4 },
  itemText: { flex: 1, fontSize: 13, lineHeight: 18 },
});
