import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DailyMediaView } from '@daily-co/react-native-daily-js';

import { colors, spacing, borderRadius } from '../../lib/themeDoctor';
import {
  startConsultation,
  finishConsultation,
  fetchRequestById,
  autoFinishConsultation,
  reportCallConnected,
} from '../../lib/api';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { useDailyCall, ConnectionQuality } from '../../hooks/useDailyCall';

// ────────────────────────────────────────────────────────────────
// API helper — busca join token do backend
// ────────────────────────────────────────────────────────────────
async function fetchJoinToken(requestId: string): Promise<{
  token: string;
  roomUrl: string;
  roomName: string;
  isOwner: boolean;
  contractedMinutes: number | null;
}> {
  return apiClient.post('/api/video/join-token', { requestId });
}

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function qualityColor(q: ConnectionQuality): string {
  switch (q) {
    case 'good': return '#22c55e';
    case 'poor': return '#f59e0b';
    case 'bad': return '#ef4444';
    default: return '#94a3b8';
  }
}

// ────────────────────────────────────────────────────────────────
// Main Screen
// ────────────────────────────────────────────────────────────────
export default function VideoCallScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const rid = (Array.isArray(requestId) ? requestId[0] : requestId) ?? '';
  const isDoctor = user?.role === 'doctor';

  // State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [meetingToken, setMeetingToken] = useState<string | null>(null);
  const [contractedMinutes, setContractedMinutes] = useState<number | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [consultationStartedAt, setConsultationStartedAt] = useState<string | null>(null);
  const connectedReportedRef = useRef(false);
  const alertedRef = useRef<Set<number>>(new Set());
  const autoFinishedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // ── Daily.co hook ──────────────────────────────────────────
  const {
    callState,
    localParticipant,
    remoteParticipant,
    isMuted,
    isCameraOff,
    isFrontCamera,
    quality,
    errorMessage,
    join,
    leave,
    toggleMute,
    toggleCamera,
    flipCamera,
  } = useDailyCall({
    roomUrl: roomUrl ?? '',
    token: meetingToken ?? '',
    onRemoteJoined: () => {
      if (!connectedReportedRef.current && rid) {
        connectedReportedRef.current = true;
        reportCallConnected(rid).catch(() => {});
      }
    },
    onCallEnded: (reason) => {
      if (reason === 'ejected') {
        Alert.alert('Tempo esgotado', 'O tempo contratado expirou.');
      }
      cleanup();
      router.back();
    },
    onError: (msg) => {
      setError(msg);
    },
  });

  // ── Init: buscar token e dados da consulta ─────────────────

  useEffect(() => {
    if (!rid) return;
    let cancelled = false;

    (async () => {
      try {
        const joinData = await fetchJoinToken(rid);

        if (cancelled) return;

        setRoomUrl(joinData.roomUrl);
        setMeetingToken(joinData.token);
        setContractedMinutes(joinData.contractedMinutes);

        const req = await fetchRequestById(rid);
        if (cancelled) return;

        if (req.contractedMinutes) setContractedMinutes(req.contractedMinutes);
        if (req.consultationStartedAt) {
          setConsultationStartedAt(req.consultationStartedAt);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao iniciar videochamada');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [rid]);

  // ── Auto-join quando token estiver pronto ──────────────────

  useEffect(() => {
    if (roomUrl && meetingToken && callState === 'idle') {
      join();
    }
  }, [roomUrl, meetingToken, callState, join]);

  // ── Médico: iniciar consulta no backend quando entrar ──────

  useEffect(() => {
    if (callState === 'joined' && isDoctor && rid) {
      startConsultation(rid).catch(() => {});
    }
  }, [callState, isDoctor, rid]);

  // ── Reportar call connected quando remoto entrar ───────────

  useEffect(() => {
    if (callState === 'joined' && remoteParticipant && !connectedReportedRef.current && rid) {
      connectedReportedRef.current = true;
      reportCallConnected(rid).catch(() => {});
    }
  }, [callState, remoteParticipant, rid]);

  // ── Timer sincronizado com servidor ────────────────────────

  useEffect(() => {
    if (!consultationStartedAt) return;
    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - new Date(consultationStartedAt).getTime()) / 1000);
      setCallSeconds(Math.max(0, elapsed));
    };
    updateElapsed();
    timerRef.current = setInterval(updateElapsed, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [consultationStartedAt]);

  // ── Polling para consultationStartedAt (paciente) ──────────

  useEffect(() => {
    if (isDoctor || !rid || consultationStartedAt) return;
    const poll = setInterval(() => {
      fetchRequestById(rid)
        .then(req => {
          if (req.consultationStartedAt) setConsultationStartedAt(req.consultationStartedAt);
        })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(poll);
  }, [isDoctor, rid, consultationStartedAt]);

  // ── Countdown / Auto-finish ────────────────────────────────

  useEffect(() => {
    if (!contractedMinutes || contractedMinutes <= 0) return;
    const remaining = contractedMinutes * 60 - callSeconds;

    if (remaining === 120 && !alertedRef.current.has(120)) {
      alertedRef.current.add(120);
      Alert.alert('Atenção', 'Sua consulta termina em 2 minutos.');
    }
    if (remaining === 60 && !alertedRef.current.has(60)) {
      alertedRef.current.add(60);
      Alert.alert('Atenção', 'Sua consulta termina em 1 minuto.');
    }
    if (remaining <= 0 && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      Alert.alert('Tempo esgotado', 'O tempo contratado expirou. A consulta será encerrada.', [
        {
          text: 'OK',
          onPress: async () => {
            await leave();
            try { await autoFinishConsultation(rid); } catch {}
            router.back();
          },
        },
      ]);
    }
  }, [callSeconds, contractedMinutes, rid, leave]);

  // ── Cleanup ────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // ── End call ───────────────────────────────────────────────

  const handleEnd = () => {
    Alert.alert('Encerrar consulta', 'Deseja encerrar a videochamada agora?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Encerrar',
        style: 'destructive',
        onPress: async () => {
          await leave();
          if (isDoctor && rid) {
            setEnding(true);
            try { await finishConsultation(rid); } catch {}
            setEnding(false);
          }
          cleanup();
          router.back();
        },
      },
    ]);
  };

  // ── Loading state ──────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Preparando videochamada...</Text>
      </View>
    );
  }

  if (error || callState === 'error') {
    return (
      <View style={[styles.container, styles.center]}>
        <Ionicons name="alert-circle" size={48} color="#ef4444" />
        <Text style={styles.errorText}>{error || errorMessage || 'Erro na chamada'}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Timer display ──────────────────────────────────────────

  const timerDisplay = contractedMinutes
    ? `${formatTime(callSeconds)} / ${formatTime(contractedMinutes * 60)}`
    : formatTime(callSeconds);

  const remaining = contractedMinutes ? contractedMinutes * 60 - callSeconds : null;
  const timerUrgent = remaining != null && remaining <= 120;

  // ── Render ─────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Remote video (full screen) */}
      {remoteParticipant?.videoTrack?.persistentTrack != null ? (
        <DailyMediaView
          videoTrack={remoteParticipant.videoTrack.persistentTrack}
          audioTrack={remoteParticipant.audioTrack?.persistentTrack ?? null}
          mirror={false}
          zOrder={0}
          style={styles.remoteVideo}
          objectFit="cover"
        />
      ) : (
        <View style={[styles.remoteVideo, styles.noVideo]}>
          <Ionicons name="person-circle-outline" size={80} color="#475569" />
          <Text style={styles.waitingText}>
            {callState === 'joining'
              ? 'Entrando na sala...'
              : 'Aguardando participante...'}
          </Text>
        </View>
      )}

      {/* Local video (PiP) */}
      {localParticipant?.videoTrack?.persistentTrack != null && !isCameraOff && (
        <View style={[styles.localVideoContainer, { bottom: 90 + insets.bottom }]}>
          <DailyMediaView
            videoTrack={localParticipant.videoTrack.persistentTrack}
            audioTrack={null}
            mirror={isFrontCamera}
            zOrder={1}
            style={styles.localVideo}
            objectFit="cover"
          />
        </View>
      )}

      {/* Status bar */}
      <View style={[styles.statusBar, { paddingTop: insets.top + 6 }]}>
        <View style={styles.statusRow}>
          <View style={[styles.qualityDot, { backgroundColor: qualityColor(quality) }]} />
          <Text style={styles.statusText}>
            {callState === 'joining' ? 'Conectando...' : callState === 'joined' ? 'Em chamada' : callState}
          </Text>
        </View>
        <View style={[styles.timerBadge, timerUrgent && styles.timerUrgent]}>
          <Ionicons name="time-outline" size={14} color={timerUrgent ? '#ef4444' : '#94a3b8'} />
          <Text style={[styles.timerText, timerUrgent && styles.timerTextUrgent]}>
            {timerDisplay}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={toggleMute}
        >
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, isCameraOff && styles.controlBtnActive]}
          onPress={toggleCamera}
        >
          <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlBtn} onPress={flipCamera}>
          <Ionicons name="camera-reverse-outline" size={24} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.controlBtn, styles.endCallBtn]}
          onPress={handleEnd}
          disabled={ending}
        >
          {ending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="call" size={24} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ────────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  remoteVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  noVideo: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  waitingText: {
    color: '#64748b',
    fontSize: 14,
  },
  localVideoContainer: {
    position: 'absolute',
    right: 12,
    width: 110,
    height: 148,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.primary,
    zIndex: 10,
  },
  localVideo: {
    flex: 1,
  },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: 'rgba(15,23,42,0.7)',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 20,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  qualityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(30,41,59,0.8)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  timerUrgent: {
    backgroundColor: 'rgba(127,29,29,0.8)',
  },
  timerText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  timerTextUrgent: {
    color: '#ef4444',
  },
  controls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(15,23,42,0.85)',
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(51,65,85,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.6)',
  },
  endCallBtn: {
    backgroundColor: '#ef4444',
  },
  loadingText: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
});
