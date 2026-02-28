/**
 * RenoveJá — Tela de Videoconsulta com Daily.co
 *
 * Features:
 * - Vídeo nativo via DailyMediaView (sem WebView)
 * - Painel lateral de anamnese IA para o médico (deslizante)
 * - Sugestões clínicas da IA em tempo real
 * - Timer sincronizado com servidor + countdown
 * - Quality indicator, mute/camera/flip controls
 * - Notas clínicas ao encerrar (modal)
 * - SignalR para receber TranscriptUpdate + AnamnesisUpdate + SuggestionUpdate
 * - Criação de sala Daily.co antes do join
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Dimensions,
  Animated,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DailyMediaView } from '@daily-co/react-native-daily-js';
import * as Clipboard from 'expo-clipboard';

import { colors } from '../../lib/themeDoctor';
import {
  startConsultation,
  finishConsultation,
  fetchRequestById,
  autoFinishConsultation,
  reportCallConnected,
  transcribeAudioChunk,
  getTimeBankBalance,
} from '../../lib/api';
import { createDailyRoom, fetchJoinToken } from '../../lib/api-daily';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { useDailyCall, type ConnectionQuality } from '../../hooks/useDailyCall';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';

const { width: SCREEN_W } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(340, SCREEN_W * 0.85);

// ──── Helpers ────

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

function qColor(q: ConnectionQuality) {
  return q === 'good' ? '#22c55e' : q === 'poor' ? '#f59e0b' : q === 'bad' ? '#ef4444' : '#64748b';
}

function qLabel(q: ConnectionQuality) {
  return q === 'good' ? 'Boa' : q === 'poor' ? 'Instável' : q === 'bad' ? 'Ruim' : '...';
}

const ANA_FIELDS = [
  { key: 'queixa_principal', label: 'Queixa Principal', icon: 'chatbubble-ellipses' },
  { key: 'historia_doenca_atual', label: 'HDA', icon: 'time' },
  { key: 'sintomas', label: 'Sintomas', icon: 'thermometer' },
  { key: 'medicamentos_em_uso', label: 'Medicamentos', icon: 'medical' },
  { key: 'alergias', label: 'Alergias', icon: 'warning' },
  { key: 'antecedentes_relevantes', label: 'Antecedentes', icon: 'document-text' },
  { key: 'cid_sugerido', label: 'CID Sugerido', icon: 'code-slash' },
] as const;

// ──── Main Screen ────

export default function VideoCallScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const rid = (Array.isArray(requestId) ? requestId[0] : requestId) ?? '';
  const isDoctor = user?.role === 'doctor';

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [meetingToken, setMeetingToken] = useState<string | null>(null);
  const [contractedMinutes, setContractedMinutes] = useState<number | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [consultationStartedAt, setConsultationStartedAt] = useState<string | null>(null);
  const connReportedRef = useRef(false);
  const alertedRef = useRef<Set<number>>(new Set());
  const autoFinishedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Doctor: timer control — médico controla quando iniciar a contagem
  const [timerStarted, setTimerStarted] = useState(false);
  const timerStartedRef = useRef(false);

  // Patient: time bank
  const [bankBalance, setBankBalance] = useState<{ minutes: number; seconds: number } | null>(null);
  const [consultationType, setConsultationType] = useState<string>('medico_clinico');

  // Audio recording for transcription (doctor only) — real implementation
  const audioRecorder = useAudioRecorder(rid);

  // Anamnesis & Transcript (doctor)
  const [panelOpen, setPanelOpen] = useState(false);
  const panelAnim = useRef(new Animated.Value(0)).current;
  const [transcript, setTranscript] = useState('');
  const [anamnesis, setAnamnesis] = useState<Record<string, any> | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isAiActive, setIsAiActive] = useState(false);
  const tScrollRef = useRef<ScrollView>(null);
  const signalRRef = useRef<any>(null);

  // Clinical notes modal
  const [showNotes, setShowNotes] = useState(false);
  const [clinicalNotes, setClinicalNotes] = useState('');

  // ── Daily.co hook ──

  const {
    callState, localParticipant, remoteParticipant,
    isMuted, isCameraOff, isFrontCamera, quality, errorMessage,
    join, leave, toggleMute, toggleCamera, flipCamera,
  } = useDailyCall({
    roomUrl: roomUrl ?? '',
    token: meetingToken ?? '',
    onRemoteJoined: () => {
      if (!connReportedRef.current && rid) {
        connReportedRef.current = true;
        reportCallConnected(rid).catch(() => {});
      }
    },
    onCallEnded: (reason) => {
      if (reason === 'ejected') Alert.alert('Tempo esgotado', 'O tempo contratado expirou.');
      cleanup();
      router.back();
    },
    onError: (msg) => setError(msg),
  });

  // ── Panel animation ──

  const togglePanel = useCallback(() => {
    Animated.spring(panelAnim, {
      toValue: panelOpen ? 0 : 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
    setPanelOpen(p => !p);
  }, [panelOpen, panelAnim]);

  // ── SignalR for real-time transcript/anamnesis ──

  const connectSignalR = useCallback(async () => {
    if (!rid || !isDoctor) return;
    try {
      const signalR = require('@microsoft/signalr');
      let apiBase = apiClient.getBaseUrl(); // e.g. 'http://192.168.x.x:5000' or '' for web
      apiBase = apiBase.replace(/\/api\/?$/, '');
      // Get token from stored auth (same key used by api-client.ts)
      let authToken = '';
      try {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        authToken = (await AsyncStorage.getItem('@renoveja:auth_token')) ?? '';
      } catch {}

      if (!authToken) {
        console.warn('[SignalR] No auth token found — cannot connect');
        return;
      }

      const conn = new signalR.HubConnectionBuilder()
        .withUrl(`${apiBase}/hubs/video`, {
          accessTokenFactory: () => authToken,
        })
        .withAutomaticReconnect()
        .build();

      conn.on('TranscriptUpdate', (data: any) => {
        const text = data?.fullText ?? data?.FullText ?? '';
        if (text) {
          setTranscript(text);
          setIsAiActive(true);
          setTimeout(() => tScrollRef.current?.scrollToEnd({ animated: true }), 100);
        }
      });

      conn.on('AnamnesisUpdate', (data: any) => {
        const json = data?.anamnesisJson ?? data?.AnamnesisJson ?? '';
        try { if (json) setAnamnesis(JSON.parse(json)); } catch {}
      });

      conn.on('SuggestionUpdate', (data: any) => {
        const items = data?.suggestions ?? data?.Suggestions ?? [];
        if (Array.isArray(items)) setSuggestions(items);
      });

      await conn.start();
      await conn.invoke('JoinRoom', rid);
      signalRRef.current = conn;
    } catch (e) {
      console.warn('SignalR connection failed (non-critical):', e);
    }
  }, [rid, isDoctor]);

  const disconnectSignalR = useCallback(async () => {
    try { await signalRRef.current?.stop(); } catch {}
    signalRRef.current = null;
  }, []);

  // ── Init: create room + fetch token ──

  useEffect(() => {
    if (!rid) return;
    let cancelled = false;

    (async () => {
      try {
        // 1. Ensure Daily room exists (idempotent — backend creates on Daily.co)
        await createDailyRoom(rid).catch(() => {});
        if (cancelled) return;

        // 2. Get join token
        const joinData = await fetchJoinToken(rid);
        if (cancelled) return;
        setRoomUrl(joinData.roomUrl);
        setMeetingToken(joinData.token);
        setContractedMinutes(joinData.contractedMinutes);

        // 3. Get request data
        const req = await fetchRequestById(rid);
        if (cancelled) return;
        if (req.contractedMinutes) setContractedMinutes(req.contractedMinutes);
        if (req.consultationStartedAt) setConsultationStartedAt(req.consultationStartedAt);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erro ao iniciar videochamada');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [rid]);

  // Auto-join when token ready
  useEffect(() => {
    if (roomUrl && meetingToken && callState === 'idle') join();
  }, [roomUrl, meetingToken, callState, join]);

  // Doctor: start consultation + connect SignalR ONLY when doctor presses Start Timer
  const handleStartTimer = useCallback(async () => {
    if (!rid || timerStartedRef.current) return;
    timerStartedRef.current = true;
    setTimerStarted(true);
    try {
      const result = await startConsultation(rid);
      // Backend may or may not set consultationStartedAt immediately.
      // If not set yet (waiting for both parties), we start the timer locally
      // so the doctor sees immediate feedback.
      if (result.consultationStartedAt) {
        setConsultationStartedAt(result.consultationStartedAt);
      } else {
        // Start timer locally — the server will sync later
        setConsultationStartedAt(new Date().toISOString());
      }
      // Also report doctor as connected to help trigger server-side timer
      reportCallConnected(rid).catch(() => {});
      connectSignalR();
      // Start real audio recording for transcription
      if (isDoctor) {
        // Small delay to let audio session stabilize after Daily.co
        await new Promise(r => setTimeout(r, 500));
        const started = await audioRecorder.start();
        if (!started) {
          console.warn('Audio recording failed to start — transcription won\'t work');
          // Retry once after a longer delay
          await new Promise(r => setTimeout(r, 1500));
          const retried = await audioRecorder.start();
          if (!retried) {
            console.warn('Audio recording retry also failed');
          }
        }
      }
    } catch (e: any) {
      console.warn('Failed to start consultation:', e?.message);
      // Still set local timer so UI isn't stuck
      if (!consultationStartedAt) {
        setConsultationStartedAt(new Date().toISOString());
      }
    }
  }, [rid, connectSignalR, isDoctor, audioRecorder, consultationStartedAt]);

  // Effect: when doctor joins, DON'T auto-start. Wait for button press.
  useEffect(() => {
    if (callState === 'joined' && isDoctor && rid) {
      // Just connect SignalR for readiness, but don't start consultation or timer
      // The doctor will press "Iniciar Consulta" button
    }
  }, [callState, isDoctor, rid]);

  // Patient: load time bank balance
  useEffect(() => {
    if (isDoctor || !rid) return;
    fetchRequestById(rid)
      .then(r => {
        if (r.consultationType) setConsultationType(r.consultationType);
        return getTimeBankBalance(r.consultationType || 'medico_clinico');
      })
      .then(res => setBankBalance({ minutes: res.balanceMinutes, seconds: res.balanceSeconds }))
      .catch(() => {});
  }, [isDoctor, rid]);

  // Report call connected when remote joins
  useEffect(() => {
    if (callState === 'joined' && remoteParticipant && !connReportedRef.current && rid) {
      connReportedRef.current = true;
      reportCallConnected(rid).catch(() => {});
    }
  }, [callState, remoteParticipant, rid]);

  // Server-synced timer
  useEffect(() => {
    if (!consultationStartedAt) return;
    const update = () => {
      const e = Math.floor((Date.now() - new Date(consultationStartedAt).getTime()) / 1000);
      setCallSeconds(Math.max(0, e));
    };
    update();
    timerRef.current = setInterval(update, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [consultationStartedAt]);

  // Patient: poll consultationStartedAt
  useEffect(() => {
    if (isDoctor || !rid || consultationStartedAt) return;
    const poll = setInterval(() => {
      fetchRequestById(rid)
        .then(r => { if (r.consultationStartedAt) setConsultationStartedAt(r.consultationStartedAt); })
        .catch(() => {});
    }, 4000);
    return () => clearInterval(poll);
  }, [isDoctor, rid, consultationStartedAt]);

  // Countdown / Auto-finish
  useEffect(() => {
    if (!contractedMinutes || contractedMinutes <= 0) return;
    const rem = contractedMinutes * 60 - callSeconds;
    if (rem === 120 && !alertedRef.current.has(120)) {
      alertedRef.current.add(120);
      Alert.alert('Atenção', 'A consulta termina em 2 minutos.');
    }
    if (rem === 60 && !alertedRef.current.has(60)) {
      alertedRef.current.add(60);
      Alert.alert('Atenção', 'A consulta termina em 1 minuto.');
    }
    if (rem <= 0 && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      Alert.alert('Tempo esgotado', 'O tempo contratado expirou.', [{
        text: 'OK', onPress: () => doEnd(true),
      }]);
    }
  }, [callSeconds, contractedMinutes]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    audioRecorder.stop();
    disconnectSignalR();
  }, [disconnectSignalR, audioRecorder]);

  // End call
  const doEnd = useCallback(async (autoFinish = false) => {
    if (isDoctor && !autoFinish) { setShowNotes(true); return; }
    await leave();
    if (autoFinish) { try { await autoFinishConsultation(rid); } catch {} }
    cleanup();
    router.back();
  }, [isDoctor, leave, rid, cleanup, router]);

  const confirmEnd = useCallback(async () => {
    setShowNotes(false);
    setEnding(true);
    await leave();
    try {
      await finishConsultation(rid, clinicalNotes.trim() ? { clinicalNotes: clinicalNotes.trim() } : undefined);
    } catch {}
    setEnding(false);
    cleanup();
    // Navigate to consultation summary to show AI anamnesis results
    router.replace(`/consultation-summary/${rid}` as any);
  }, [leave, rid, clinicalNotes, cleanup, router]);

  const onEndPress = () => {
    if (isDoctor) {
      const title = 'Encerrar consulta';
      const msg = 'Deseja encerrar a videochamada agora?';
      Alert.alert(title, msg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Encerrar', style: 'destructive', onPress: () => doEnd(false) },
      ]);
    } else {
      // Patient: show time bank info when leaving early
      const rem = contractedMinutes ? contractedMinutes * 60 - callSeconds : null;
      const unusedMin = rem != null && rem > 0 ? Math.floor(rem / 60) : 0;
      const msg = unusedMin > 0
        ? `Você ainda tem ~${unusedMin} minuto(s) restantes.\n\nAo sair, o tempo não utilizado será creditado no seu banco de horas para usar em futuras consultas.`
        : 'Deseja sair da videochamada?';
      Alert.alert('Sair da consulta', msg, [
        { text: 'Continuar', style: 'cancel' },
        {
          text: unusedMin > 0 ? 'Sair e guardar saldo' : 'Sair',
          style: 'destructive',
          onPress: () => leave().then(() => { cleanup(); router.back(); }),
        },
      ]);
    }
  };

  // ── Render helpers ──

  if (loading) return (
    <View style={[S.container, S.center]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={S.loadTitle}>Preparando videochamada</Text>
      <Text style={S.loadSub}>Conectando à sala de consulta...</Text>
    </View>
  );

  if (error || callState === 'error') return (
    <View style={[S.container, S.center]}>
      <Ionicons name="alert-circle" size={56} color={colors.error} />
      <Text style={S.errText}>{error || errorMessage || 'Erro na chamada'}</Text>
      <TouchableOpacity style={S.retryBtn} onPress={() => { setError(''); setLoading(true); }}>
        <Text style={S.retryTxt}>Tentar novamente</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ marginTop: 8, padding: 10 }} onPress={() => router.back()}>
        <Text style={{ color: '#64748b' }}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );

  const rem = contractedMinutes ? contractedMinutes * 60 - callSeconds : null;
  const urgent = rem != null && rem <= 120;
  const critical = rem != null && rem <= 60;
  const timerStr = contractedMinutes ? `${fmt(callSeconds)} / ${fmt(contractedMinutes * 60)}` : fmt(callSeconds);
  const hasAna = anamnesis && Object.keys(anamnesis).length > 0;
  const hasSug = suggestions.length > 0;
  const hasT = transcript.length > 0;
  const panelHas = hasAna || hasSug || hasT;

  const panelX = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_WIDTH + 20, 0] });

  return (
    <View style={S.container}>
      {/* Remote video */}
      {remoteParticipant?.videoTrack?.persistentTrack != null ? (
        <DailyMediaView
          videoTrack={remoteParticipant.videoTrack.persistentTrack}
          audioTrack={remoteParticipant.audioTrack?.persistentTrack ?? null}
          mirror={false} zOrder={0} style={S.remote} objectFit="cover"
        />
      ) : (
        <View style={[S.remote, S.noVid]}>
          <View style={S.waitCircle}>
            <Ionicons name="person-circle-outline" size={72} color="#334155" />
          </View>
          <Text style={S.waitTitle}>{callState === 'joining' ? 'Entrando na sala...' : 'Aguardando participante'}</Text>
          <Text style={S.waitSub}>{isDoctor ? 'O paciente será notificado' : 'O médico entrará em breve'}</Text>
        </View>
      )}

      {/* Local PiP */}
      {localParticipant?.videoTrack?.persistentTrack != null && !isCameraOff && (
        <View style={[S.pip, { top: insets.top + 52 }]}>
          <DailyMediaView
            videoTrack={localParticipant.videoTrack.persistentTrack}
            audioTrack={null} mirror={isFrontCamera} zOrder={1} style={S.pipVid} objectFit="cover"
          />
          {isMuted && (
            <View style={S.pipMute}><Ionicons name="mic-off" size={10} color="#fff" /></View>
          )}
        </View>
      )}

      {/* Top bar */}
      <View style={[S.top, { paddingTop: insets.top + 8 }]}>
        <View style={S.topL}>
          <View style={[S.qPill, { backgroundColor: `${qColor(quality)}22` }]}>
            <View style={[S.qDot, { backgroundColor: qColor(quality) }]} />
            <Text style={[S.qTxt, { color: qColor(quality) }]}>{qLabel(quality)}</Text>
          </View>
          {isAiActive && (
            <View style={S.aiPill}>
              <View style={S.aiDot} />
              <Text style={S.aiTxt}>IA</Text>
            </View>
          )}
        </View>
        <View style={[S.tPill, urgent && S.tPillUrg, critical && S.tPillCrit]}>
          <Ionicons name="time-outline" size={14} color={critical ? '#fff' : urgent ? '#f59e0b' : '#94a3b8'} />
          <Text style={[S.tTxt, urgent && S.tTxtUrg, critical && S.tTxtCrit]}>{timerStr}</Text>
        </View>
      </View>

      {/* Doctor: panel toggle */}
      {isDoctor && callState === 'joined' && (
        <TouchableOpacity
          style={[S.panelBtn, { top: insets.top + 60 + 160 }, panelOpen && S.panelBtnOn]}
          onPress={togglePanel} activeOpacity={0.7}
        >
          <Ionicons name={panelOpen ? 'chevron-forward' : 'document-text'} size={20} color="#fff" />
          {panelHas && !panelOpen && <View style={S.panelDot} />}
        </TouchableOpacity>
      )}

      {/* Doctor: Start Timer / Recording Button */}
      {isDoctor && callState === 'joined' && !timerStarted && (
        <View style={S.startTimerOverlay}>
          <TouchableOpacity style={S.startTimerBtn} onPress={handleStartTimer} activeOpacity={0.8}>
            <Ionicons name="play-circle" size={28} color="#fff" />
            <View>
              <Text style={S.startTimerTitle}>Iniciar Consulta</Text>
              <Text style={S.startTimerSub}>Timer, transcrição e anamnese IA</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Doctor: Recording indicator */}
      {isDoctor && timerStarted && audioRecorder.isRecording && (
        <View style={[S.recIndicator, { top: insets.top + 60 + 100 }]}>
          <View style={S.recDot} />
          <Text style={S.recText}>Gravando · {audioRecorder.chunksSent} transcrições</Text>
        </View>
      )}
      {isDoctor && timerStarted && audioRecorder.error && (
        <View style={[S.recIndicator, { top: insets.top + 60 + 100, backgroundColor: 'rgba(245,158,11,0.8)' }]}>
          <Ionicons name="warning" size={12} color="#fff" />
          <Text style={S.recText}>Mic: {audioRecorder.error}</Text>
        </View>
      )}

      {/* Patient: Time Bank Balance */}
      {!isDoctor && bankBalance && bankBalance.minutes > 0 && (
        <View style={[S.bankBadge, { top: insets.top + 60 }]}>
          <Ionicons name="time-outline" size={14} color="#22c55e" />
          <Text style={S.bankText}>Saldo: {bankBalance.minutes} min</Text>
        </View>
      )}

      {/* Patient: info about early leave */}
      {!isDoctor && callState === 'joined' && contractedMinutes && callSeconds > 0 && (
        <View style={[S.earlyLeaveHint, { bottom: 80 + insets.bottom + 12 }]}>
          <Ionicons name="information-circle-outline" size={14} color="#94a3b8" />
          <Text style={S.earlyLeaveText}>Sair antes? O tempo restante vai pro seu banco de horas.</Text>
        </View>
      )}

      {/* Doctor: Anamnesis panel */}
      {isDoctor && (
        <Animated.View
          style={[S.panel, { width: PANEL_WIDTH, top: insets.top + 48, bottom: 80 + insets.bottom, transform: [{ translateX: panelX }] }]}
          pointerEvents={panelOpen ? 'auto' : 'none'}
        >
          <ScrollView style={{ flex: 1 }} contentContainerStyle={S.panelInner} showsVerticalScrollIndicator={false}>
            {/* Anamnesis */}
            {hasAna && (
              <View style={S.sec}>
                <View style={S.secH}>
                  <Ionicons name="document-text" size={16} color={colors.primary} />
                  <Text style={S.secT}>ANAMNESE</Text>
                  <View style={S.badge}><Ionicons name="sparkles" size={10} color={colors.primary} /><Text style={S.badgeTxt}>IA</Text></View>
                </View>
                {ANA_FIELDS.map(({ key, label, icon }) => {
                  const v = anamnesis?.[key];
                  if (!v || (typeof v === 'string' && !v.trim())) return null;
                  const d = Array.isArray(v) ? v.join(', ') : String(v);
                  const alert = key === 'alergias';
                  return (
                    <View key={key} style={S.af}>
                      <View style={S.afL}><Ionicons name={icon as any} size={11} color={alert ? colors.error : '#64748b'} /><Text style={[S.afLT, alert && { color: colors.error }]}>{label}</Text></View>
                      <Text style={S.afV}>{d}</Text>
                    </View>
                  );
                })}
                {Array.isArray(anamnesis?.alertas_vermelhos) && anamnesis!.alertas_vermelhos.length > 0 && (
                  <View style={S.rfBlock}>
                    <View style={S.afL}><Ionicons name="alert-circle" size={13} color="#EF4444" /><Text style={[S.afLT, { color: '#EF4444', fontWeight: '700' }]}>ALERTAS</Text></View>
                    {(anamnesis!.alertas_vermelhos as string[]).map((f, i) => <Text key={i} style={S.rfTxt}>⚠️ {f}</Text>)}
                  </View>
                )}
              </View>
            )}

            {/* Suggestions */}
            {hasSug && (
              <View style={S.sec}>
                <View style={S.secH}><Ionicons name="bulb" size={16} color="#8B5CF6" /><Text style={[S.secT, { color: '#8B5CF6' }]}>SUGESTÕES</Text></View>
                {suggestions.map((s, i) => {
                  const red = s.startsWith('🚨');
                  return (
                    <View key={i} style={[S.sugItem, red && S.sugDng]}>
                      <Ionicons name={red ? 'alert-circle' : 'bulb-outline'} size={14} color={red ? '#EF4444' : '#8B5CF6'} />
                      <Text style={[S.sugTxt, red && { color: '#EF4444' }]}>{s.replace('🚨 ', '')}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Transcript */}
            {hasT && (
              <View style={S.sec}>
                <View style={S.secH}>
                  <Ionicons name="mic" size={16} color="#64748b" />
                  <Text style={S.secT}>TRANSCRIÇÃO</Text>
                  <TouchableOpacity style={S.copyBtn} onPress={() => Clipboard.setStringAsync(transcript)}>
                    <Ionicons name="copy-outline" size={12} color={colors.primary} />
                  </TouchableOpacity>
                </View>
                <ScrollView ref={tScrollRef} style={S.tBox} nestedScrollEnabled>
                  <Text style={S.tBoxTxt}>{transcript}</Text>
                </ScrollView>
              </View>
            )}

            {/* Empty */}
            {!panelHas && (
              <View style={S.panelEmpty}>
                <Ionicons name="sparkles-outline" size={32} color="#334155" />
                <Text style={S.peTitle}>Anamnese IA</Text>
                <Text style={S.peSub}>A anamnese e transcrição aparecerão aqui durante a conversa</Text>
              </View>
            )}
          </ScrollView>
          <View style={S.panelFoot}>
            <Ionicons name="information-circle-outline" size={12} color="#475569" />
            <Text style={S.panelFootTxt}>IA como apoio — revisão médica obrigatória</Text>
          </View>
        </Animated.View>
      )}

      {/* Controls */}
      <View style={[S.ctrl, { paddingBottom: insets.bottom + 12 }]}>
        <TouchableOpacity style={[S.cb, isMuted && S.cbOn]} onPress={toggleMute}>
          <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={22} color="#fff" />
          <Text style={S.cLbl}>{isMuted ? 'Mudo' : 'Mic'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.cb, isCameraOff && S.cbOn]} onPress={toggleCamera}>
          <Ionicons name={isCameraOff ? 'videocam-off' : 'videocam'} size={22} color="#fff" />
          <Text style={S.cLbl}>{isCameraOff ? 'Off' : 'Câm'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={S.cb} onPress={flipCamera}>
          <Ionicons name="camera-reverse-outline" size={22} color="#fff" />
          <Text style={S.cLbl}>Virar</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[S.cb, S.endCb]} onPress={onEndPress} disabled={ending}>
          {ending ? <ActivityIndicator size="small" color="#fff" /> : (
            <Ionicons name="call" size={22} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          )}
          <Text style={S.cLbl}>Sair</Text>
        </TouchableOpacity>
      </View>

      {/* Clinical notes modal */}
      <Modal visible={showNotes} transparent animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={S.mOverlay}>
          <View style={S.mCard}>
            <View style={S.mHead}><Ionicons name="create-outline" size={22} color={colors.primary} /><Text style={S.mTitle}>Notas Clínicas</Text></View>
            <Text style={S.mSub}>Adicione observações finais antes de encerrar (opcional)</Text>
            <TextInput
              style={S.mInput} placeholder="Diagnóstico, conduta, orientações..."
              placeholderTextColor="#94a3b8" multiline textAlignVertical="top"
              value={clinicalNotes} onChangeText={setClinicalNotes} autoFocus
            />
            <View style={S.mActs}>
              <TouchableOpacity style={S.mBtnSec} onPress={() => { setClinicalNotes(''); confirmEnd(); }}>
                <Text style={S.mBtnSecT}>Pular</Text>
              </TouchableOpacity>
              <TouchableOpacity style={S.mBtnPri} onPress={confirmEnd}>
                <Text style={S.mBtnPriT}>Encerrar Consulta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ──── Styles ────

const S = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c1222' },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },

  remote: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  noVid: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  waitCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(44,177,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  waitTitle: { color: '#94a3b8', fontSize: 16, fontWeight: '600' },
  waitSub: { color: '#475569', fontSize: 13 },

  pip: { position: 'absolute', left: 12, width: 100, height: 136, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary, zIndex: 15, backgroundColor: '#1e293b' },
  pipVid: { flex: 1 },
  pipMute: { position: 'absolute', bottom: 4, left: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: '#ef4444', justifyContent: 'center', alignItems: 'center' },

  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, backgroundColor: 'rgba(12,18,34,0.75)', zIndex: 20 },
  topL: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  qPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  qDot: { width: 7, height: 7, borderRadius: 4 },
  qTxt: { fontSize: 11, fontWeight: '600' },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: 'rgba(139,92,246,0.2)' },
  aiDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#8B5CF6' },
  aiTxt: { fontSize: 10, fontWeight: '700', color: '#8B5CF6' },
  tPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: 'rgba(30,41,59,0.85)' },
  tPillUrg: { backgroundColor: 'rgba(120,53,15,0.6)' },
  tPillCrit: { backgroundColor: '#dc2626' },
  tTxt: { color: '#94a3b8', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tTxtUrg: { color: '#f59e0b' },
  tTxtCrit: { color: '#fff' },

  panelBtn: { position: 'absolute', right: 0, zIndex: 25, width: 44, height: 44, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, backgroundColor: 'rgba(44,177,255,0.85)', justifyContent: 'center', alignItems: 'center' },
  panelBtnOn: { backgroundColor: 'rgba(30,41,59,0.9)' },
  panelDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },

  panel: { position: 'absolute', right: 0, zIndex: 22, backgroundColor: 'rgba(15,23,42,0.95)', borderTopLeftRadius: 16, borderBottomLeftRadius: 16, overflow: 'hidden' },
  panelInner: { padding: 14, gap: 16 },

  sec: { gap: 8 },
  secH: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secT: { fontSize: 11, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: 'rgba(44,177,255,0.1)' },
  badgeTxt: { fontSize: 9, fontWeight: '700', color: colors.primary },
  copyBtn: { marginLeft: 'auto', padding: 4, borderRadius: 6, backgroundColor: 'rgba(44,177,255,0.1)' },

  af: { gap: 2, paddingLeft: 4 },
  afL: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  afLT: { fontSize: 10, fontWeight: '700', color: '#64748b', letterSpacing: 0.3, textTransform: 'uppercase' },
  afV: { fontSize: 13, color: '#e2e8f0', lineHeight: 19 },
  rfBlock: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 8, gap: 4 },
  rfTxt: { fontSize: 12, color: '#fca5a5', lineHeight: 18 },

  sugItem: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingLeft: 4 },
  sugDng: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: 6 },
  sugTxt: { fontSize: 12, color: '#c4b5fd', lineHeight: 18, flex: 1 },

  tBox: { maxHeight: 150, backgroundColor: 'rgba(30,41,59,0.6)', borderRadius: 8, padding: 8 },
  tBoxTxt: { fontSize: 12, color: '#94a3b8', lineHeight: 19 },

  panelEmpty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  peTitle: { fontSize: 14, fontWeight: '700', color: '#475569' },
  peSub: { fontSize: 12, color: '#334155', textAlign: 'center', lineHeight: 18 },
  panelFoot: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(30,41,59,0.8)', borderTopWidth: 1, borderTopColor: 'rgba(51,65,85,0.3)' },
  panelFootTxt: { fontSize: 10, color: '#475569' },

  ctrl: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingTop: 14, backgroundColor: 'rgba(12,18,34,0.9)' },
  cb: { width: 56, height: 64, borderRadius: 16, backgroundColor: 'rgba(51,65,85,0.7)', justifyContent: 'center', alignItems: 'center', gap: 4 },
  cbOn: { backgroundColor: 'rgba(239,68,68,0.5)' },
  endCb: { backgroundColor: '#dc2626' },
  cLbl: { fontSize: 10, color: 'rgba(255,255,255,0.7)', fontWeight: '600' },

  loadTitle: { color: '#e2e8f0', fontSize: 17, fontWeight: '700' },
  loadSub: { color: '#64748b', fontSize: 13 },
  errText: { color: '#fca5a5', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { marginTop: 12, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 },
  retryTxt: { color: '#fff', fontWeight: '700' },

  mOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  mCard: { backgroundColor: '#1e293b', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  mHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mTitle: { fontSize: 18, fontWeight: '700', color: '#e2e8f0' },
  mSub: { fontSize: 13, color: '#64748b' },
  mInput: { backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 12, padding: 14, minHeight: 120, maxHeight: 200, color: '#e2e8f0', fontSize: 14, lineHeight: 22, borderWidth: 1, borderColor: 'rgba(51,65,85,0.5)' },
  mActs: { flexDirection: 'row', gap: 12, marginTop: 8 },
  mBtnSec: { flex: 1, height: 48, borderRadius: 12, backgroundColor: 'rgba(51,65,85,0.5)', justifyContent: 'center', alignItems: 'center' },
  mBtnSecT: { color: '#94a3b8', fontWeight: '600', fontSize: 14 },
  mBtnPri: { flex: 2, height: 48, borderRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  mBtnPriT: { color: '#fff', fontWeight: '700', fontSize: 14 },

  // Doctor: Start Timer button
  startTimerOverlay: { position: 'absolute', left: 16, right: 16, bottom: 100, zIndex: 30, alignItems: 'center' },
  startTimerBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#059669', paddingHorizontal: 24, paddingVertical: 16, borderRadius: 20, shadowColor: '#059669', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  startTimerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  startTimerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 1 },

  // Recording indicator
  recIndicator: { position: 'absolute', left: 12, zIndex: 25, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(220,38,38,0.8)' },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  recText: { color: '#fff', fontSize: 11, fontWeight: '600' },

  // Patient: Time Bank Badge
  bankBadge: { position: 'absolute', left: 12, zIndex: 25, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(22,163,74,0.2)' },
  bankText: { color: '#22c55e', fontSize: 12, fontWeight: '600' },

  // Patient: Early leave hint
  earlyLeaveHint: { position: 'absolute', left: 12, right: 12, zIndex: 25, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(30,41,59,0.85)' },
  earlyLeaveText: { color: '#94a3b8', fontSize: 11, flex: 1 },
});
