/**
 * VideoCallWaiting — Waiting screen when the other participant hasn't joined.
 *
 * Centered avatar with status messaging on dark background.
 * States: joining, waiting, camera off, patient left, consultation started without patient.
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
  /** True if remote was ever present this session — distinguishes "never joined" from "left". */
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
  let iconName: keyof typeof Ionicons.glyphMap = 'person-circle-outline';
  let iconColor = 'rgba(255,255,255,0.4)';

  if (callState === 'reconnecting') {
    title = 'Reconectando...';
    subtitle = 'Conexao instavel — tentando reconectar automaticamente';
    iconName = 'cloud-offline-outline';
    iconColor = '#F59E0B';
  } else if (callState === 'joining') {
    title = 'Entrando na sala...';
    subtitle = isDoctor ? 'O paciente sera notificado' : 'Conectando a sala do medico...';
    iconName = 'videocam-outline';
    iconColor = '#0EA5E9';
  } else if (remoteParticipantPresent) {
    title = 'Camera desligada';
    subtitle = 'O participante esta na chamada com a camera desativada';
    iconName = 'videocam-off-outline';
    iconColor = 'rgba(255,255,255,0.5)';
  } else if (isDoctor && timerStarted && remoteEverJoined && showRemoteLeft) {
    title = 'Paciente saiu da chamada';
    subtitle = 'O paciente pode voltar enquanto houver tempo.\nSo voce (medico) encerra a consulta — Res. CFM no 2.454/2026.';
    iconName = 'person-remove-outline';
    iconColor = '#F59E0B';
  } else if (isDoctor && timerStarted && remoteEverJoined && !showRemoteLeft) {
    title = 'Reconectando paciente...';
    subtitle = 'Aguardando o paciente retornar a chamada.';
    iconName = 'refresh-outline';
    iconColor = '#0EA5E9';
  } else if (isDoctor && timerStarted && !remoteEverJoined) {
    title = 'Consulta iniciada';
    subtitle = 'Aguardando o paciente entrar na chamada. Timer e transcricao ja estao ativos.';
    iconName = 'hourglass-outline';
    iconColor = '#22C55E';
  } else if (!isDoctor && timerStarted) {
    title = 'Voce voltou a sala';
    subtitle = 'Aguardando o medico na sala. Sua consulta continua.';
    iconName = 'checkmark-circle-outline';
    iconColor = '#22C55E';
  } else {
    title = 'Aguardando participante';
    subtitle = isDoctor ? 'O paciente sera notificado para entrar' : 'O medico entrara em breve';
    iconName = 'person-circle-outline';
    iconColor = 'rgba(255,255,255,0.4)';
  }

  return (
    <View style={S.container}>
      {/* Large avatar circle */}
      <View style={S.avatarOuter}>
        <View style={[S.avatarInner, { borderColor: iconColor }]}>
          <Ionicons name={iconName} size={56} color={iconColor} />
        </View>
      </View>

      <Text style={S.title}>{title}</Text>
      <Text style={S.subtitle}>{subtitle}</Text>

      {/* Pulsing dots indicator */}
      {(callState === 'joining' || (!remoteParticipantPresent && !showRemoteLeft)) && (
        <View style={S.dotsRow}>
          <View style={[S.dot, { opacity: 0.4 }]} />
          <View style={[S.dot, { opacity: 0.6 }]} />
          <View style={[S.dot, { opacity: 0.9 }]} />
        </View>
      )}
    </View>
  );
});

const S = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    backgroundColor: '#0B1120',
  },
  avatarOuter: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatarInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 2,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0EA5E9',
  },
});
