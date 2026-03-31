/**
 * VideoCallWaiting — Tela de espera quando o outro participante não entrou.
 *
 * Estados: joining, aguardando, câmera off, paciente saiu (só se já entrou antes), consulta iniciada sem paciente na sala.
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DesignColors } from '../../../lib/designSystem';

const REMOTE_LEFT_GRACE_MS = 7000;

interface VideoCallWaitingProps {
  colors: DesignColors;
  callState: string;
  isDoctor: boolean;
  timerStarted: boolean;
  /** True when the remote participant is in the room (camera may be off). */
  remoteParticipantPresent: boolean;
  /** True if remote was ever present this session — distingue "nunca entrou" de "saiu". */
  remoteEverJoined: boolean;
}

export const VideoCallWaiting = React.memo(function VideoCallWaiting({
  colors, callState, isDoctor, timerStarted, remoteParticipantPresent, remoteEverJoined,
}: VideoCallWaitingProps) {
  const [showRemoteLeft, setShowRemoteLeft] = useState(false);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const remoteGone = !remoteParticipantPresent && remoteEverJoined && isDoctor && timerStarted;

  useEffect(() => {
    if (remoteGone) {
      graceTimerRef.current = setTimeout(() => setShowRemoteLeft(true), REMOTE_LEFT_GRACE_MS);
    } else {
      setShowRemoteLeft(false);
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    }
    return () => {
      if (graceTimerRef.current) {
        clearTimeout(graceTimerRef.current);
        graceTimerRef.current = null;
      }
    };
  }, [remoteGone]);

  let title: string;
  let subtitle: string;

  if (callState === 'reconnecting') {
    title = 'Reconectando...';
    subtitle = 'Conexão instável — tentando reconectar automaticamente';
  } else if (callState === 'joining') {
    title = 'Entrando na sala...';
    subtitle = isDoctor ? 'O paciente será notificado' : 'Conectando à sala do médico...';
  } else if (remoteParticipantPresent) {
    title = 'Câmera desligada';
    subtitle = 'O participante está na chamada com a câmera desativada';
  } else if (isDoctor && timerStarted && remoteEverJoined && showRemoteLeft) {
    title = 'Paciente saiu da chamada';
    subtitle = 'O paciente pode voltar enquanto houver tempo.\nSó você (médico) encerra a consulta — Res. CFM nº 2.454/2026.';
  } else if (isDoctor && timerStarted && remoteEverJoined && !showRemoteLeft) {
    title = 'Reconectando paciente...';
    subtitle = 'Aguardando o paciente retornar à chamada.';
  } else if (isDoctor && timerStarted && !remoteEverJoined) {
    title = 'Consulta iniciada';
    subtitle = 'Aguardando o paciente entrar na chamada. Timer e transcrição já estão ativos.';
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
