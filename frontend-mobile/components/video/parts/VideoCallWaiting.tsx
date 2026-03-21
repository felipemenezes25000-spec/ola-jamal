/**
 * VideoCallWaiting — Tela de espera quando o outro participante não entrou.
 *
 * 4 estados: joining, aguardando (médico/paciente), paciente voltou, paciente saiu.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../../lib/designSystem';

interface VideoCallWaitingProps {
  colors: DesignColors;
  callState: string;
  isDoctor: boolean;
  timerStarted: boolean;
}

export const VideoCallWaiting = React.memo(function VideoCallWaiting({
  colors, callState, isDoctor, timerStarted,
}: VideoCallWaitingProps) {
  let title: string;
  let subtitle: string;

  if (callState === 'reconnecting') {
    title = 'Reconectando...';
    subtitle = 'Conexão instável — tentando reconectar automaticamente';
  } else if (callState === 'joining') {
    title = 'Entrando na sala...';
    subtitle = isDoctor ? 'O paciente será notificado' : 'Conectando à sala do médico...';
  } else if (isDoctor && timerStarted) {
    title = 'Paciente saiu da chamada';
    subtitle = 'O paciente pode voltar enquanto houver tempo.\nSó você (médico) encerra a consulta — Res. CFM nº 2.454/2026.';
  } else if (!isDoctor && timerStarted) {
    title = 'Você voltou à sala';
    subtitle = 'Aguardando o médico na sala. Sua consulta continua.';
  } else {
    title = 'Aguardando participante';
    subtitle = isDoctor ? 'O paciente será notificado para entrar' : 'O médico entrará em breve';
  }

  return (
    <View style={S.container}>
      <View style={[S.circle, { backgroundColor: 'rgba(44,177,255,0.12)' }]}>
        <Ionicons name="person-circle-outline" size={72} color={colors.textSecondary} />
      </View>
      <Text style={[S.title, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[S.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
    </View>
  );
});

const S = StyleSheet.create({
  container: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    justifyContent: 'center', alignItems: 'center', gap: 12,
  },
  circle: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 16, fontWeight: '600' },
  subtitle: { fontSize: 13, textAlign: 'center', paddingHorizontal: 32 },
});
