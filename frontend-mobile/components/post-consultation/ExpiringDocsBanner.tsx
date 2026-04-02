/**
 * ExpiringDocsBanner — Banner que mostra documentos prestes a vencer.
 * Aparece na home do paciente quando há receitas vencendo nos próximos 15 dias.
 * Toque navega para request-detail → renovar.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import type { DesignColors } from '../../lib/designSystem';
import type { RequestResponseDto } from '../../types/database';

interface Props {
  requests: RequestResponseDto[];
}

const DAYS_THRESHOLD = 15;

function getExpiringDocs(requests: RequestResponseDto[]) {
  const now = Date.now();
  const threshold = now + DAYS_THRESHOLD * 86400000;

  return requests
    .filter((r) => {
      if (!r.signedAt) return false;
      if (r.requestType !== 'prescription') return false;
      // Calcular validade estimada: 6 meses para simples
      const signedMs = new Date(r.signedAt).getTime();
      const expiresMs = signedMs + 180 * 86400000; // ~6 meses
      return expiresMs > now && expiresMs <= threshold;
    })
    .map((r) => {
      const signedMs = new Date(r.signedAt!).getTime();
      const expiresMs = signedMs + 180 * 86400000;
      const daysLeft = Math.max(0, Math.ceil((expiresMs - now) / 86400000));
      return { request: r, daysLeft };
    })
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

export function ExpiringDocsBanner({ requests }: Props) {
  const { colors } = useAppTheme();
  const S = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();

  const expiring = useMemo(() => getExpiringDocs(requests), [requests]);

  if (expiring.length === 0) return null;

  const first = expiring[0];
  const isUrgent = first.daysLeft <= 3;

  return (
    <TouchableOpacity
      style={[S.banner, isUrgent && S.bannerUrgent]}
      activeOpacity={0.8}
      onPress={() => router.push(`/request-detail/${first.request.id}`)}
      accessibilityRole="button"
      accessibilityLabel={
        expiring.length === 1
          ? `Receita vence em ${first.daysLeft} dia${first.daysLeft !== 1 ? 's' : ''}. Toque para renovar`
          : `${expiring.length} receitas vencendo em breve. Mais urgente: ${first.daysLeft} dia${first.daysLeft !== 1 ? 's' : ''}`
      }
      accessibilityHint="Abre os detalhes do pedido para renovação"
    >
      <View style={[S.icon, isUrgent && S.iconUrgent]} importantForAccessibility="no">
        <Ionicons name={isUrgent ? 'warning' : 'time-outline'}
          size={20} color={isUrgent ? '#DC2626' : '#D97706'} />
      </View>
      <View style={S.body} importantForAccessibility="no">
        <Text style={[S.title, isUrgent && S.titleUrgent]}>
          {expiring.length === 1
            ? `Receita vence em ${first.daysLeft} dia${first.daysLeft !== 1 ? 's' : ''}`
            : `${expiring.length} receitas vencendo em breve`}
        </Text>
        <Text style={S.sub}>
          {expiring.length === 1
            ? 'Toque para renovar antes do vencimento'
            : `Mais urgente: ${first.daysLeft} dia${first.daysLeft !== 1 ? 's' : ''}`}
        </Text>
      </View>
      <View style={S.action} importantForAccessibility="no">
        <Text style={[S.actionText, isUrgent && S.actionTextUrgent]}>Renovar</Text>
        <Ionicons name="chevron-forward" size={14}
          color={isUrgent ? '#DC2626' : '#D97706'} />
      </View>
    </TouchableOpacity>
  );
}

function makeStyles(c: DesignColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      padding: 16, borderRadius: 16, marginBottom: 12,
      backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    },
    bannerUrgent: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
    icon: {
      width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF3C7',
      justifyContent: 'center', alignItems: 'center',
    },
    iconUrgent: { backgroundColor: '#FEE2E2' },
    body: { flex: 1 },
    title: { fontSize: 14, fontWeight: '600', color: '#92400E' },
    titleUrgent: { color: '#991B1B' },
    sub: { fontSize: 12, color: '#B45309', marginTop: 2 },
    action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    actionText: { fontSize: 13, fontWeight: '600', color: '#D97706' },
    actionTextUrgent: { color: '#DC2626' },
  });
}
