import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';

// Status config matching EXACT backend snake_case values from EnumHelper.ToSnakeCase()
// Following spec: submitted=yellow, in_review=blue, approved_pending_payment=orange, paid=green, signed=purple, delivered=green, rejected=red, cancelled=gray
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Enviado', color: theme.colors.status.warning, bg: theme.colors.status.warningLight },
  pending: { label: 'Pendente', color: theme.colors.text.tertiary, bg: theme.colors.background.secondary },
  analyzing: { label: 'Analisando', color: theme.colors.status.info, bg: theme.colors.status.infoLight },
  in_review: { label: 'Em Análise', color: theme.colors.status.info, bg: theme.colors.status.infoLight },
  approved: { label: 'Aprovado', color: theme.colors.status.success, bg: theme.colors.status.successLight },
  approved_pending_payment: { label: 'A Pagar', color: theme.colors.status.warning, bg: theme.colors.status.warningLight },
  pending_payment: { label: 'Aguardando Pgto', color: theme.colors.status.warning, bg: theme.colors.status.warningLight },
  paid: { label: 'Pago', color: theme.colors.status.success, bg: theme.colors.status.successLight },
  signed: { label: 'Assinado', color: theme.colors.medical.exam, bg: theme.colors.medical.examLight },
  delivered: { label: 'Entregue', color: theme.colors.status.success, bg: theme.colors.status.successLight },
  completed: { label: 'Concluído', color: theme.colors.status.success, bg: theme.colors.status.successLight },
  rejected: { label: 'Rejeitado', color: theme.colors.status.error, bg: theme.colors.status.errorLight },
  cancelled: { label: 'Cancelado', color: theme.colors.text.tertiary, bg: theme.colors.background.secondary },
  searching_doctor: { label: 'Buscando Médico', color: theme.colors.status.warning, bg: theme.colors.status.warningLight },
  consultation_ready: { label: 'Consulta Pronta', color: theme.colors.status.info, bg: theme.colors.status.infoLight },
  in_consultation: { label: 'Em Consulta', color: theme.colors.status.info, bg: theme.colors.status.infoLight },
  consultation_finished: { label: 'Finalizada', color: theme.colors.status.success, bg: theme.colors.status.successLight },
};

const FALLBACK_LABEL = 'Em processamento';

export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label ?? FALLBACK_LABEL;
}

export function getStatusColor(status: string): string {
  return STATUS_CONFIG[status]?.color || theme.colors.text.tertiary;
}

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] ?? {
    label: FALLBACK_LABEL,
    color: theme.colors.text.tertiary,
    bg: theme.colors.background.secondary,
  };

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, size === 'sm' && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: config.color }]} />
      <Text
        style={[styles.text, { color: config.color }, size === 'sm' && styles.textSm]}
        numberOfLines={1}
        ellipsizeMode="tail"
      >
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
    borderRadius: theme.borderRadius.full,
    gap: 5,
    flexShrink: 1,
    minWidth: 0,
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
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  textSm: {
    fontSize: 10,
  },
});
