import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, borderRadius } from '../constants/theme';

// Status config matching EXACT backend snake_case values from EnumHelper.ToSnakeCase()
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Enviado', color: '#6B7280', bg: '#F3F4F6' },
  pending: { label: 'Pendente', color: '#6B7280', bg: '#F3F4F6' },
  analyzing: { label: 'Analisando', color: '#8B5CF6', bg: '#EDE9FE' },
  in_review: { label: 'Em Análise', color: '#8B5CF6', bg: '#EDE9FE' },
  approved: { label: 'Aprovado', color: colors.success, bg: '#D1FAE5' },
  approved_pending_payment: { label: 'Aguardando Pgto', color: colors.warning, bg: '#FEF3C7' },
  pending_payment: { label: 'Aguardando Pgto', color: colors.warning, bg: '#FEF3C7' },
  paid: { label: 'Pago', color: colors.primary, bg: '#DBEAFE' },
  signed: { label: 'Assinado', color: '#059669', bg: '#D1FAE5' },
  delivered: { label: 'Entregue', color: '#059669', bg: '#D1FAE5' },
  completed: { label: 'Concluído', color: '#059669', bg: '#D1FAE5' },
  rejected: { label: 'Rejeitado', color: colors.error, bg: '#FEE2E2' },
  cancelled: { label: 'Cancelado', color: colors.error, bg: '#FEE2E2' },
  searching_doctor: { label: 'Buscando Médico', color: colors.secondary, bg: '#FFF7ED' },
  consultation_ready: { label: 'Consulta Pronta', color: colors.primary, bg: '#DBEAFE' },
  in_consultation: { label: 'Em Consulta', color: '#059669', bg: '#D1FAE5' },
  consultation_finished: { label: 'Consulta Finalizada', color: '#059669', bg: '#D1FAE5' },
};

const FALLBACK_LABEL = 'Em processamento';

export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label ?? FALLBACK_LABEL;
}

export function getStatusColor(status: string): string {
  return STATUS_CONFIG[status]?.color || '#6B7280';
}

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? { label: FALLBACK_LABEL, color: '#6B7280', bg: '#F3F4F6' };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === 'sm' && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text style={[styles.text, { color: config.color }, size === 'sm' && styles.textSm]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    gap: 5,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
  textSm: {
    fontSize: 10,
  },
});
