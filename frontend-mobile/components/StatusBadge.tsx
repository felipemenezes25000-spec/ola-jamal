import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from '../lib/theme';

const c = theme.colors;

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  submitted: { label: 'Enviado', color: '#D97706', bg: '#FEF3C7' },
  pending: { label: 'Pendente', color: c.text.tertiary, bg: c.background.secondary },
  analyzing: { label: 'Analisando', color: '#2563EB', bg: '#DBEAFE' },
  in_review: { label: 'Em Análise', color: '#2563EB', bg: '#DBEAFE' },
  approved: { label: 'Aprovado', color: '#059669', bg: '#D1FAE5' },
  approved_pending_payment: { label: 'A Pagar', color: '#EA580C', bg: '#FFEDD5' },
  pending_payment: { label: 'Aguard. Pgto', color: '#EA580C', bg: '#FFEDD5' },
  paid: { label: 'Pago', color: '#059669', bg: '#D1FAE5' },
  signed: { label: 'Assinado', color: '#7C3AED', bg: '#EDE9FE' },
  delivered: { label: 'Entregue', color: '#059669', bg: '#D1FAE5' },
  completed: { label: 'Concluído', color: '#059669', bg: '#D1FAE5' },
  rejected: { label: 'Rejeitado', color: '#DC2626', bg: '#FEE2E2' },
  cancelled: { label: 'Cancelado', color: '#6B7280', bg: '#F3F4F6' },
  searching_doctor: { label: 'Buscando Médico', color: '#D97706', bg: '#FEF3C7' },
  consultation_ready: { label: 'Consulta Pronta', color: '#2563EB', bg: '#DBEAFE' },
  in_consultation: { label: 'Em Consulta', color: '#2563EB', bg: '#DBEAFE' },
  consultation_finished: { label: 'Finalizada', color: '#059669', bg: '#D1FAE5' },
};

const FALLBACK = { label: 'Processando', color: c.text.tertiary, bg: c.background.secondary };

export function getStatusLabel(status: string): string {
  return STATUS_CONFIG[status]?.label ?? FALLBACK.label;
}

export function getStatusColor(status: string): string {
  return STATUS_CONFIG[status]?.color ?? FALLBACK.color;
}

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status] ?? FALLBACK;
  const isSm = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, isSm && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: cfg.color }]} />
      <Text
        style={[styles.text, { color: cfg.color }, isSm && styles.textSm]}
        numberOfLines={1}
      >
        {cfg.label}
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
    borderRadius: 100,
    gap: 5,
    flexShrink: 1,
  },
  badgeSm: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  textSm: {
    fontSize: 10,
  },
});
