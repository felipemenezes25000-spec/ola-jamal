/**
 * DocumentValidityBadge — Mostra validade estimada de um documento.
 * Verde: válido (>30 dias). Âmbar: vencendo (≤30 dias). Vermelho: vencido.
 * Botão "Renovar" quando está vencendo.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { RequestResponseDto } from '../../types/database';

interface Props {
  request: RequestResponseDto;
}

function getValidity(request: RequestResponseDto) {
  if (!request.signedAt) return null;
  if (request.requestType !== 'prescription' && request.requestType !== 'exam') return null;

  const signedMs = new Date(request.signedAt).getTime();
  const now = Date.now();

  // Receita controlada: 30 dias. Simples: 180 dias. Exame: 180 dias.
  const isControlled = request.prescriptionType === 'controlled' ||
    request.prescriptionKind === 'controlled_special';
  const validityDays = isControlled ? 30 : 180;
  const expiresMs = signedMs + validityDays * 86400000;
  const daysLeft = Math.ceil((expiresMs - now) / 86400000);

  return {
    daysLeft,
    expiresDate: new Date(expiresMs).toLocaleDateString('pt-BR'),
    isExpired: daysLeft <= 0,
    isExpiring: daysLeft > 0 && daysLeft <= 30,
    isValid: daysLeft > 30,
    validityDays,
  };
}

export function DocumentValidityBadge({ request }: Props) {
  const router = useRouter();
  const validity = useMemo(() => getValidity(request), [request]);

  if (!validity) return null;

  const { daysLeft, expiresDate, isExpired, isExpiring } = validity;

  const bg = isExpired ? '#FEF2F2' : isExpiring ? '#FFFBEB' : '#F0FDF4';
  const border = isExpired ? '#FECACA' : isExpiring ? '#FDE68A' : '#BBF7D0';
  const textColor = isExpired ? '#991B1B' : isExpiring ? '#92400E' : '#166534';
  const icon = isExpired ? 'close-circle' : isExpiring ? 'warning' : 'checkmark-circle';
  const iconColor = isExpired ? '#DC2626' : isExpiring ? '#D97706' : '#22C55E';

  const label = isExpired
    ? `Vencida em ${expiresDate}`
    : isExpiring
      ? `Vence em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''} (${expiresDate})`
      : `Válida até ${expiresDate}`;

  return (
    <View style={[s.container, { backgroundColor: bg, borderColor: border }]}>
      <Ionicons name={icon as any} size={18} color={iconColor} />
      <Text style={[s.text, { color: textColor }]}>{label}</Text>
      {(isExpired || isExpiring) && (
        <TouchableOpacity
          style={[s.btn, { backgroundColor: isExpired ? '#DC2626' : '#D97706' }]}
          onPress={() => router.push('/new-request/prescription')}
        >
          <Text style={s.btnText}>Renovar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 8,
  },
  text: { fontSize: 13, fontWeight: '600', flex: 1 },
  btn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10,
  },
  btnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
});
