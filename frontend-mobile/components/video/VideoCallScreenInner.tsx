/**
 * RenoveJá — Tela de Videoconsulta com Daily.co (conteúdo real).
 * Carregado dinamicamente apenas em development build; não usado no Expo Go.
 *
 * Features:
 * - Vídeo nativo via DailyMediaView (sem WebView)
 * - Picture-in-Picture (Android): ao minimizar o app, pop-up flutuante com a pessoa da consulta
 * - Painel lateral de anamnese IA para o médico (deslizante)
 * - Sugestões clínicas da IA em tempo real
 * - Timer sincronizado com servidor + countdown
 * - Quality indicator, mute/camera/flip controls
 * - Notas clínicas ao encerrar (modal)
 * - Transcrição via Whisper (useAudioRecorder grava áudio, backend transcreve)
 * - SignalR para receber TranscriptUpdate + AnamnesisUpdate + SuggestionUpdate
 * - Criação de sala Daily.co antes do join
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Dimensions,
  Animated,
  Platform,
  BackHandler,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { nav } from '../../lib/navigation';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { DailyMediaView } from '@daily-co/react-native-daily-js';
import ExpoPip from 'expo-pip';

import { useAppTheme } from '../../lib/ui/useAppTheme';
import DoctorAIPanel from './DoctorAIPanel';
import { VideoCallControls, VideoCallTopBar, VideoCallWaiting, ClinicalNotesModal } from './parts';
import {
  startConsultation,
  finishConsultation,
  fetchRequestById,
  autoFinishConsultation,
  reportCallConnected,
  getTimeBankBalance,
} from '../../lib/api';
import { createDailyRoom, fetchJoinToken } from '../../lib/api-daily';
import { apiClient } from '../../lib/api-client';
import { useAuth } from '../../contexts/AuthContext';
import { useDailyCall } from '../../hooks/useDailyCall';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useRequestUpdated } from '../../hooks/useRequestUpdated';

const { width: SCREEN_W } = Dimensions.get('window');
const PANEL_WIDTH = Math.min(380, SCREEN_W * 0.9);

// ──── Main Screen ────

export default function VideoCallScreenInner() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  // Video call: tema dark unificado — overlay, modal e painel usam o mesmo tema.
  // Evita mix light/dark bugado dentro da chamada.
  const darkTheme = useAppTheme({ scheme: 'dark' });
  const colors = darkTheme.colors;
  const modalColors = darkTheme.colors;
  const S = useMemo(() => makeStyles(colors, modalColors), [colors, modalColors]);

  const rid = (Array.isArray(requestId) ? requestId[0] : requestId) ?? '';
  const isDoctor = user?.role === 'doctor';

  // PiP: layout simplificado quando em janela flutuante (Android; no iOS retorna false)
  const isInPipMode = (ExpoPip?.useIsInPip?.() ?? { isInPipMode: false }).isInPipMode;

  // Core state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const [roomUrl, setRoomUrl] = useState<string | null>(null);
  const [meetingToken, setMeetingToken] = useState<string | null>(null);
  const [contractedMinutes, setContractedMinutes] = useState<number | null>(null);
  const [callSeconds, setCallSeconds] = useState(0);
  const [consultationStartedAt, setConsultationStartedAt] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);

  // Reset state on rid change — enables patient rejoin without stale state
  useEffect(() => {
    setLoading(true);
    setError('');
    setEnding(false);
    setRoomUrl(null);
    setMeetingToken(null);
    setCallSeconds(0);
  }, [rid]);
  const connReportedRef = useRef(false);
  const alertedRef = useRef<Set<number>>(new Set());
  const autoFinishedRef = useRef(false);
  /** Prevents double router.back() when leave() triggers both 'left-meeting' and .then() callback */
  const leavingRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset all refs on mount — critical for patient rejoin (component may remount with same params)
  useEffect(() => {
    connReportedRef.current = false;
    alertedRef.current = new Set();
    autoFinishedRef.current = false;
    leavingRef.current = false;
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [rid]);

  // Doctor: timer control — médico controla quando iniciar a contagem
  const [timerStarted, setTimerStarted] = useState(false);
  const timerStartedRef = useRef(false);

  // Patient: time bank
  const [bankBalance, setBankBalance] = useState<{ minutes: number; seconds: number } | null>(null);
  const [, setConsultationType] = useState<string>('medico_clinico');

  // Transcrição: Whisper via useAudioRecorder (ambos gravam microfone, backend transcreve)
  const canStartRecording = consultationStartedAt || requestStatus === 'in_consultation' || requestStatus === 'paid';

  // Anamnesis & Transcript (doctor)
  const [panelOpen, setPanelOpen] = useState(false);
  const panelAnim = useRef(new Animated.Value(0)).current;
  const [, setTranscript] = useState('');
  const [anamnesis, setAnamnesis] = useState<Record<string, unknown> | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [evidence, setEvidence] = useState<{
    title: string;
    abstract: string;
    source: string;
    translatedAbstract?: string;
    relevantExcerpts?: string[];
    clinicalRelevance?: string;
    provider?: string;
  }[]>([]);
  const [isAiActive, setIsAiActive] = useState(false);
  const [transcriptionError, setTranscriptionError] = useState<string | null>(null);
  const [showBackgroundHint, setShowBackgroundHint] = useState(true);
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
    isDoctor,
    onRemoteJoined: () => {
      if (!connReportedRef.current && rid) {
        connReportedRef.current = true;
        reportCallConnected(rid).catch(() => {});
      }
    },
    onCallEnded: (reason) => {
      // Skip navigation if we're already handling leave in onEndPress .then() callback
      // This prevents the double router.back() bug that makes patient unable to rejoin
      if (leavingRef.current && reason === 'left') return;
      if (reason === 'ejected') Alert.alert('Tempo esgotado', 'O tempo contratado expirou.');
      if (reason === 'meeting-ended') Alert.alert('Sessão encerrada', 'A videochamada foi encerrada.');
      cleanup();
      router.back();
    },
    onError: (msg) => setError(msg),
  });

  const audioRecorder = useAudioRecorder(rid, isDoctor ? 'local' : 'remote');
  const audioRecorderRef = useRef(audioRecorder);
  audioRecorderRef.current = audioRecorder;

  // Whisper: inicia gravação automaticamente quando consulta iniciada e na sala
  useEffect(() => {
    if (!canStartRecording || callState !== 'joined' || !rid) return;
    audioRecorderRef.current.start().catch(() => {});
    return () => {
      audioRecorderRef.current.stop().catch(() => {});
    };
  }, [canStartRecording, callState, rid]);

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
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- dynamic import for SignalR
      const signalR = require('@microsoft/signalr');
      let apiBase = apiClient.getBaseUrl(); // e.g. 'http://192.168.x.x:5000' or '' for web
      apiBase = apiBase.replace(/\/api\/?$/, '');
      // Get token from stored auth (same key used by api-client.ts)
      let authToken = '';
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional native module
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        authToken = (await AsyncStorage.getItem('@renoveja:auth_token')) ?? '';
      } catch {}

      if (!authToken) {
        console.warn('[SignalR] No auth token found — cannot connect');
        return;
      }

      const builder = new signalR.HubConnectionBuilder()
        .withUrl(`${apiBase}/hubs/video`, {
          accessTokenFactory: () => authToken,
        })
        .withAutomaticReconnect();
      if (signalR.LogLevel != null) {
        const logLevel = __DEV__ ? signalR.LogLevel.Information : signalR.LogLevel.Warning;
        builder.configureLogging(logLevel);
      }
      const conn = builder.build();

      conn.on('TranscriptUpdate', (data: any) => {
        const text = data?.fullText ?? data?.FullText ?? '';
        if (text) {
          setTranscript(text);
          setIsAiActive(true);
          setTranscriptionError(null);
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

      conn.on('TranscriptionError', (data: any) => {
        const msg = data?.message ?? data?.Message ?? 'Erro na transcrição';
        setTranscriptionError(msg);
      });

      conn.on('EvidenceUpdate', (data: any) => {
        const items = data?.items ?? data?.Items ?? [];
        if (Array.isArray(items)) {
          setEvidence(items.map((e: any) => ({
            title: e?.title ?? e?.Title ?? '',
            abstract: e?.abstract ?? e?.Abstract ?? '',
            source: e?.source ?? e?.Source ?? '',
            translatedAbstract: e?.translatedAbstract ?? e?.TranslatedAbstract,
            relevantExcerpts: e?.relevantExcerpts ?? e?.RelevantExcerpts ?? undefined,
            clinicalRelevance: e?.clinicalRelevance ?? e?.ClinicalRelevance ?? undefined,
            provider: e?.provider ?? e?.Provider ?? 'PubMed',
          })));
        }
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
        if (req.status) setRequestStatus(req.status);
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

  // Doctor: start consultation + connect SignalR. Auto-start quando paciente entra (evita perder transcrição).
  // Ponto 4: StartConsultation → status InConsultation; ReportCallConnected (ambos) → ConsultationStartedAt.
  const handleStartTimer = useCallback(async () => {
    if (!rid || timerStartedRef.current) return;
    timerStartedRef.current = true;
    setTimerStarted(true);
    try {
      const result = await startConsultation(rid);
      // Backend retorna { request, chronicWarning }.
      const req = result.request;

      // Exibir aviso de paciente crônico se aplicável (CFM 2.314/2022)
      if (result.chronicWarning) {
        // TODO: exibir alerta ao médico com result.chronicWarning
        console.warn('[Consultation] Chronic warning:', result.chronicWarning);
      }

      // If not set yet (waiting for both parties), we start the timer locally
      // so the doctor sees immediate feedback.
      if (req.consultationStartedAt) {
        setConsultationStartedAt(req.consultationStartedAt);
      } else {
        // Start timer locally — the server will sync later
        setConsultationStartedAt(new Date().toISOString());
      }
      // Also report doctor as connected to help trigger server-side timer
      reportCallConnected(rid).catch(() => {});
      connectSignalR();
      // Transcrição via Whisper — useAudioRecorder inicia automaticamente; ambos veem ao vivo via SignalR.
    } catch (e: any) {
      console.warn('Failed to start consultation:', e?.message);
      // Still set local timer so UI isn't stuck
      if (!consultationStartedAt) {
        setConsultationStartedAt(new Date().toISOString());
      }
    }
  }, [rid, connectSignalR, consultationStartedAt]);

  // Auto-start robusto: quando médico e paciente já estão conectados na sala,
  // inicia consulta automaticamente para evitar perder transcrição por falta de clique.
  useEffect(() => {
    if (callState !== 'joined' || !isDoctor || !rid) return;
    if (!remoteParticipant) return;
    if (timerStartedRef.current) return;
    handleStartTimer().catch(() => {});
  }, [callState, isDoctor, rid, remoteParticipant, handleStartTimer]);

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

  // Report call connected: ambos reportam ao entrar na sala (não esperam ver o outro — evita timer zerado).
  // Backend define consultationStartedAt quando médico E paciente tiverem reportado.
  useEffect(() => {
    if (callState !== 'joined' || !rid || connReportedRef.current) return;
    connReportedRef.current = true;
    if (__DEV__) console.warn('[VideoCall] reportCallConnected —', isDoctor ? 'médico' : 'paciente');
    reportCallConnected(rid).catch(() => {
      connReportedRef.current = false; // retry em próxima render
    });
  }, [callState, rid, isDoctor]);

  // Patient: ao entrar na chamada, busca status imediatamente e após 500ms (Daily pode atrasar participant list)
  useEffect(() => {
    if (isDoctor || !rid || callState !== 'joined') return;
    const fetchStatus = () => {
      fetchRequestById(rid)
        .then(r => {
          if (r.consultationStartedAt) setConsultationStartedAt(r.consultationStartedAt);
          if (r.status) setRequestStatus(r.status);
          if (__DEV__ && !r.consultationStartedAt) {
            console.warn('[VideoCall] Patient fetch: consultationStartedAt ainda null, poll continuará');
          }
        })
        .catch(() => {});
    };
    fetchStatus();
    const t = setTimeout(fetchStatus, 500);
    return () => clearTimeout(t);
  }, [isDoctor, rid, callState]);

  // Patient: ao receber RequestUpdated (ex.: médico iniciou, chamada conectada), atualiza status imediatamente
  const refetchRequestForPatient = useCallback(() => {
    if (isDoctor || !rid) return;
    fetchRequestById(rid)
      .then(r => {
        if (r.consultationStartedAt) {
          setConsultationStartedAt(r.consultationStartedAt);
          if (__DEV__) console.warn('[VideoCall] Patient: consultationStartedAt recebido via RequestUpdated');
        }
        if (r.status) setRequestStatus(r.status);
      })
      .catch(() => {});
  }, [isDoctor, rid]);
  useRequestUpdated(isDoctor ? undefined : rid, refetchRequestForPatient);

  // Server-synced timer (médico e paciente usam consultationStartedAt do backend)
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

  // Patient: poll consultationStartedAt — 500ms até timer iniciar (evita timer zerado por delay)
  useEffect(() => {
    if (isDoctor || !rid || consultationStartedAt) return;
    const fetchSync = () => {
      fetchRequestById(rid)
        .then(r => {
          if (r.consultationStartedAt) setConsultationStartedAt(r.consultationStartedAt);
          if (r.status) setRequestStatus(r.status);
        })
        .catch(() => {});
    };
    fetchSync();
    const poll = setInterval(fetchSync, 500);
    return () => clearInterval(poll);
  }, [isDoctor, rid, consultationStartedAt]);

  // Countdown / Auto-finish
  const doEndRef = useRef<(autoFinish?: boolean) => Promise<void>>(async () => {});
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
        text: 'OK', onPress: () => doEndRef.current(true),
      }]);
    }
  }, [callSeconds, contractedMinutes]);

  // Dica UX: esconder após 8s (usuário pode usar o celular durante a chamada)
  useEffect(() => {
    if (callState !== 'joined') return;
    const t = setTimeout(() => setShowBackgroundHint(false), 8000);
    return () => clearTimeout(t);
  }, [callState]);

  // Picture-in-Picture (Android): ao minimizar, pop-up flutuante estilo WhatsApp/Discord
  // — arrastável, redimensionável (pinch/double-tap), chamada continua em segundo plano
  useEffect(() => {
    if (Platform.OS !== 'android' || callState !== 'joined') return;
    if (!ExpoPip.isAvailable?.()) return;
    ExpoPip.setPictureInPictureParams?.({
      autoEnterEnabled: true,
      seamlessResizeEnabled: true,
      title: isDoctor ? 'Consulta — Paciente' : 'Consulta — Médico',
      subtitle: 'Arraste para mover • Toque para expandir',
      width: 360,
      height: 480,
    });
    return () => {
      ExpoPip.setPictureInPictureParams?.({ autoEnterEnabled: false });
    };
  }, [callState, isDoctor]);

  // Cleanup
  const cleanup = useCallback(() => {
    if (Platform.OS === 'android' && ExpoPip.setPictureInPictureParams) {
      ExpoPip.setPictureInPictureParams({ autoEnterEnabled: false });
    }
    if (timerRef.current) clearInterval(timerRef.current);
    audioRecorderRef.current.stop().catch(() => {});
    disconnectSignalR();
  }, [disconnectSignalR]);

  // End call
  const doEnd = useCallback(async (autoFinish = false) => {
    if (isDoctor && !autoFinish) { setShowNotes(true); return; }
    await leave();
    if (autoFinish) { try { await autoFinishConsultation(rid); } catch {} }
    cleanup();
    router.back();
  }, [isDoctor, leave, rid, cleanup, router]);
  doEndRef.current = doEnd;

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
    nav.replace(router, `/consultation-summary/${rid}`);
  }, [leave, rid, clinicalNotes, cleanup, router]);

  const onEndPress = useCallback(() => {
    if (isDoctor) {
      const title = 'Encerrar consulta';
      const msg = 'Conforme Resolução CFM nº 2.454/2026, a decisão final é sempre do médico.\n\nIsso encerra a consulta para ambos. Deseja encerrar agora?';
      Alert.alert(title, msg, [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Encerrar', style: 'destructive', onPress: () => doEnd(false) },
      ]);
    } else {
      // Paciente: só sai da chamada — pode voltar enquanto houver minutos; só o médico encerra
      const rem = contractedMinutes ? contractedMinutes * 60 - callSeconds : null;
      const unusedMin = rem != null && rem > 0 ? Math.floor(rem / 60) : 0;
      const msg = unusedMin > 0
        ? `Você ainda tem ~${unusedMin} minuto(s) restante(s).\n\nVocê pode voltar à sala a qualquer momento pelo detalhe do pedido. Só o médico pode encerrar a consulta.`
        : 'Você pode voltar à sala pelo detalhe do pedido enquanto houver tempo. Só o médico encerra a consulta.\n\nDeseja sair agora?';
      Alert.alert('Sair da chamada', msg, [
        { text: 'Continuar', style: 'cancel' },
        {
          text: unusedMin > 0 ? 'Sair e guardar saldo' : 'Sair',
          style: 'destructive',
          onPress: () => {
            leavingRef.current = true;
            leave().then(() => {
              cleanup();
              // Navigate to request-detail (not back) so patient sees clear rejoin button
              nav.replace(router, `/request-detail/${rid}`);
            }).catch(() => { leavingRef.current = false; });
          },
        },
      ]);
    }
  }, [isDoctor, doEnd, contractedMinutes, callSeconds, leave, cleanup, router, rid]);

  // Android: botão Voltar durante a chamada — mostrar confirmação em vez de sair direto
  useEffect(() => {
    if (Platform.OS !== 'android' || callState !== 'joined') return;
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      onEndPress();
      return true;
    });
    return () => handler.remove();
  }, [callState, onEndPress]);

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
        <Text style={{ color: colors.textMuted }}>Voltar</Text>
      </TouchableOpacity>
    </View>
  );

  const hasAna = anamnesis && Object.keys(anamnesis).length > 0;
  const hasMeds = Array.isArray(anamnesis?.medicamentos_sugeridos) && anamnesis.medicamentos_sugeridos.length > 0;
  const hasExams = Array.isArray(anamnesis?.exames_sugeridos) && anamnesis.exames_sugeridos.length > 0;
  const hasSug = suggestions.length > 0;
  const hasEv = evidence.some((e) =>
    (e.relevantExcerpts && e.relevantExcerpts.length > 0) || e.clinicalRelevance || e.translatedAbstract
  );
  const panelHas = hasAna || hasMeds || hasExams || hasSug || hasEv;

  const panelX = panelAnim.interpolate({ inputRange: [0, 1], outputRange: [PANEL_WIDTH + 20, 0] });

  // PiP: remote sempre principal — evita SurfaceView conflict no overlay pequeno do Android
  // Local é mostrado como mini-preview apenas quando NÃO em PiP
  const _localIsMain = false;
  const remoteIsMain = true;

  return (
    <View style={S.container}>
      {/* Remote video — full screen normal; overlay pequeno em PiP */}
      {remoteParticipant?.videoTrack?.persistentTrack != null ? (
        <View collapsable={false} style={remoteIsMain ? S.remote : S.pipRemote}>
          <DailyMediaView
            videoTrack={remoteParticipant.videoTrack.persistentTrack}
            audioTrack={remoteParticipant.audioTrack?.persistentTrack ?? null}
            mirror={false} zOrder={remoteIsMain ? 0 : 1} style={remoteIsMain ? S.remote : S.pipVid} objectFit="cover"
          />
        </View>
      ) : (
        <View style={[S.remote, S.noVid]}>
          <VideoCallWaiting
            colors={colors}
            callState={callState}
            isDoctor={isDoctor}
            timerStarted={timerStarted}
          />
        </View>
      )}

      {/* Local PiP — oculto em PiP (SurfaceView conflita com janela pequena Android) */}
      {localParticipant?.videoTrack?.persistentTrack != null && !isCameraOff && !isInPipMode && (
        <View collapsable={false} style={[S.pip, { top: insets.top + 52 }]}>
          <DailyMediaView
            videoTrack={localParticipant.videoTrack.persistentTrack}
            audioTrack={null} mirror={isFrontCamera} zOrder={1} style={S.pipVid} objectFit="cover"
          />
          {isMuted && (
            <View style={S.pipMute}><Ionicons name="mic-off" size={10} color={colors.white} /></View>
          )}
        </View>
      )}

      {/* Top bar — oculto em PiP para janela limpa */}
      {!isInPipMode && (
        <VideoCallTopBar
          colors={colors}
          topInset={insets.top}
          quality={quality}
          callSeconds={callSeconds}
          contractedMinutes={contractedMinutes}
          isAiActive={isAiActive}
        />
      )}

      {/* Doctor: panel toggle — oculto em PiP */}
      {!isInPipMode && isDoctor && callState === 'joined' && (
        <TouchableOpacity
          style={[S.panelBtn, { top: insets.top + 60 + 160 }, panelOpen && S.panelBtnOn]}
          onPress={togglePanel} activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={panelOpen ? 'Fechar painel de anamnese' : 'Abrir painel de anamnese IA'}
          accessibilityState={{ expanded: panelOpen }}
        >
          <Ionicons name={panelOpen ? 'chevron-forward' : 'document-text'} size={20} color={colors.white} />
          {panelHas && !panelOpen && <View style={S.panelDot} />}
        </TouchableOpacity>
      )}

      {/* Doctor: Start Timer / Recording Button — oculto em PiP */}
      {!isInPipMode && isDoctor && callState === 'joined' && !timerStarted && (
        <View style={S.startTimerOverlay}>
          <TouchableOpacity style={S.startTimerBtn} onPress={handleStartTimer} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel="Iniciar consulta, timer e transcrição">
            <Ionicons name="play-circle" size={28} color={colors.white} />
            <View>
              <Text style={S.startTimerTitle}>Iniciar Consulta</Text>
              <Text style={S.startTimerSub}>Timer, transcrição e anamnese IA</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Doctor: aviso quando transcrição falha (SignalR ou erro de envio Whisper) */}
      {!isInPipMode && isDoctor && (transcriptionError || audioRecorder.lastChunkError) && (
        <View style={[S.recIndicator, { top: insets.top + 60 + 140, backgroundColor: colors.warning + '40' }]}>
          <Ionicons name="warning" size={14} color={colors.warning} />
          <Text style={[S.recText, { color: colors.warning }]}>{transcriptionError || audioRecorder.lastChunkError}</Text>
        </View>
      )}

      {/* Patient: Time Bank Balance — oculto em PiP */}
      {!isInPipMode && !isDoctor && bankBalance && bankBalance.minutes > 0 && (
        <View style={[S.bankBadge, { top: insets.top + 60 }]}>
          <Ionicons name="time-outline" size={14} color={colors.success} />
          <Text style={S.bankText}>Saldo: {bankBalance.minutes} min</Text>
        </View>
      )}

      {/* Patient: indicador de transcrição Whisper — oculto em PiP */}
      {!isInPipMode && !isDoctor && callState === 'joined' && (
        <View style={[audioRecorder.isRecording ? S.recIndicatorActive : S.recIndicatorMuted, { top: insets.top + 60 + (bankBalance && bankBalance.minutes > 0 ? 44 : 0) }]}>
          {audioRecorder.isRecording ? (
            <>
              <View style={S.recDot} />
              <Text style={S.recText}>Transcrição ativa</Text>
            </>
          ) : canStartRecording ? (
            <Text style={[S.recText, { opacity: 0.7 }]}>Aguardando médico iniciar transcrição...</Text>
          ) : (
            <Text style={[S.recText, { opacity: 0.7 }]}>
              {requestStatus === 'paid' ? 'Aguardando médico na chamada...' : 'Aguardando médico iniciar a consulta'}
            </Text>
          )}
        </View>
      )}

      {/* Patient: só o médico encerra; paciente pode sair e voltar */}
      {!isInPipMode && !isDoctor && callState === 'joined' && contractedMinutes && callSeconds > 0 && (
        <View style={[S.earlyLeaveHint, { bottom: 80 + insets.bottom + 12 }]}>
          <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
          <Text style={S.earlyLeaveText}>
            Só o médico encerra a consulta (CFM 2.454/2026). Pode sair e voltar pelo detalhe do pedido.
          </Text>
        </View>
      )}

      {/* Doctor: Anamnesis panel — oculto em PiP */}
      {!isInPipMode && isDoctor && (
        <Animated.View
          style={[S.panel, { width: PANEL_WIDTH, top: insets.top + 48, bottom: 80 + insets.bottom, transform: [{ translateX: panelX }] }]}
          pointerEvents={panelOpen ? 'auto' : 'none'}
        >
          <DoctorAIPanel anamnesis={anamnesis} suggestions={suggestions} evidence={evidence} />
        </Animated.View>
      )}

      {/* Dica: pode usar o celular durante a chamada — some após 8s */}
      {!isInPipMode && showBackgroundHint && callState === 'joined' && (
        <View style={[S.backgroundHint, { bottom: (insets.bottom || 20) + 90 }]}>
          <Ionicons name="phone-portrait-outline" size={16} color={colors.primary} />
          <Text style={S.backgroundHintText}>
            {Platform.OS === 'android' && ExpoPip?.isAvailable?.()
              ? 'Minimizar para usar outros apps — popup arrastável, chamada continua'
              : 'Pode trocar de app — a chamada continua em segundo plano'}
          </Text>
          <TouchableOpacity onPress={() => setShowBackgroundHint(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} accessibilityRole="button" accessibilityLabel="Fechar dica">
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      )}

      {/* Controls — oculto em PiP; toque na janela expande o app */}
      {!isInPipMode && (
        <VideoCallControls
          colors={colors}
          insetBottom={insets.bottom}
          isMuted={isMuted}
          isCameraOff={isCameraOff}
          isDoctor={isDoctor}
          ending={ending}
          hasPip={Platform.OS === 'android' && !!(ExpoPip?.isAvailable?.())}
          onToggleMute={toggleMute}
          onToggleCamera={toggleCamera}
          onFlipCamera={flipCamera}
          onEnd={onEndPress}
          onEnterPip={Platform.OS === 'android' && ExpoPip?.isAvailable?.() ? () => ExpoPip.enterPipMode?.({ width: 360, height: 480 }) : undefined}
        />
      )}

      {/* Clinical notes modal */}
      <ClinicalNotesModal
        visible={showNotes}
        colors={colors}
        clinicalNotes={clinicalNotes}
        onChangeNotes={setClinicalNotes}
        onSkip={() => { setClinicalNotes(''); confirmEnd(); }}
        onConfirm={confirmEnd}
      />
    </View>
  );
}

// ──── Styles (light mode: overlays legíveis, fundo escuro só para área do vídeo) ────

type VideoColors = { primary: string; text: string; textMuted: string; textSecondary: string; white: string; black: string; error: string; warning: string; success: string; successLight: string; destructive: string; primaryLight: string; border: string; errorLight: string; surface: string; surfaceSecondary: string; background: string };

function makeStyles(colors: VideoColors, modalColors?: VideoColors) {
  const mc = modalColors || colors;
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { justifyContent: 'center', alignItems: 'center', gap: 12 },

  remote: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  noVid: { justifyContent: 'center', alignItems: 'center', gap: 12 },
  waitCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(44,177,255,0.12)', justifyContent: 'center', alignItems: 'center' },
  waitTitle: { color: colors.textMuted, fontSize: 16, fontWeight: '600' },
  waitSub: { color: colors.textSecondary, fontSize: 13 },

  pip: { position: 'absolute', left: 12, width: 100, height: 136, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary, zIndex: 15, backgroundColor: colors.surface },
  pipRemote: { position: 'absolute', right: 12, top: 8, width: 100, height: 136, borderRadius: 12, overflow: 'hidden', borderWidth: 2, borderColor: colors.primary, zIndex: 15, backgroundColor: colors.surface },
  pipVid: { flex: 1 },
  pipMute: { position: 'absolute', bottom: 4, left: 4, width: 18, height: 18, borderRadius: 9, backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center' },

  top: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, backgroundColor: 'rgba(15,23,42,0.92)', zIndex: 20 },
  topL: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  qPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  qDot: { width: 7, height: 7, borderRadius: 4 },
  qTxt: { fontSize: 12, fontWeight: '600' },
  aiPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, backgroundColor: 'rgba(44,177,255,0.15)' },
  aiDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  aiTxt: { fontSize: 12, fontWeight: '700', color: colors.primary },
  tPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: 'rgba(30,41,59,0.85)' },
  tPillUrg: { backgroundColor: 'rgba(251,191,36,0.4)' },
  tPillCrit: { backgroundColor: colors.destructive },
  tTxt: { color: colors.text, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'] },
  tTxtUrg: { color: colors.warning },
  tTxtCrit: { color: colors.white },

  panelBtn: { position: 'absolute', right: 0, zIndex: 25, width: 48, height: 48, borderTopLeftRadius: 12, borderBottomLeftRadius: 12, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  panelBtnOn: { backgroundColor: colors.text },
  panelDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.success },

  panel: { position: 'absolute', right: 0, zIndex: 22, backgroundColor: colors.surface, borderTopLeftRadius: 16, borderBottomLeftRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: -4, height: 0 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 8 },
  panelInner: { padding: 14, gap: 16 },

  sec: { gap: 8 },
  secH: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  secT: { fontSize: 12, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.5 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8, backgroundColor: 'rgba(44,177,255,0.1)' },
  badgeTxt: { fontSize: 12, fontWeight: '700', color: colors.primary },
  copyBtn: { marginLeft: 'auto', padding: 4, borderRadius: 6, backgroundColor: 'rgba(44,177,255,0.1)' },
  speakerCountPills: { flexDirection: 'row', gap: 6, marginLeft: 4 },
  doctorCountPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(44,177,255,0.16)' },
  patientCountPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8, backgroundColor: 'rgba(34,197,94,0.16)' },
  doctorCountTxt: { fontSize: 12, fontWeight: '700', color: colors.primaryLight },
  patientCountTxt: { fontSize: 12, fontWeight: '700', color: colors.success },

  af: { gap: 2, paddingLeft: 4 },
  afL: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  afLT: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.3, textTransform: 'uppercase' },
  afV: { fontSize: 13, color: colors.border, lineHeight: 19 },
  rfBlock: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 8, padding: 8, gap: 4 },
  rfTxt: { fontSize: 12, color: colors.error, lineHeight: 18 },

  sugItem: { flexDirection: 'row', gap: 6, alignItems: 'flex-start', paddingLeft: 4 },
  sugDng: { backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: 6, padding: 6 },
  sugTxt: { fontSize: 12, color: colors.primaryLight, lineHeight: 18, flex: 1 },

  medItem: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  medItemBlock: { marginBottom: 10 },
  medNum: { fontSize: 12, fontWeight: '700', color: colors.primaryLight, minWidth: 16 },
  medNome: { fontSize: 12, color: colors.text, lineHeight: 18, flex: 1, fontWeight: '600' },
  medText: { fontSize: 12, color: colors.border, lineHeight: 18, flex: 1 },
  medIndicacao: { fontSize: 11, color: colors.textMuted, marginTop: 2, marginLeft: 22, lineHeight: 16 },
  examItemBlock: { marginBottom: 10 },
  examDetail: { fontSize: 11, color: colors.textSecondary, marginTop: 2, marginLeft: 22, lineHeight: 16 },
  panelDisclaimer: { fontSize: 10, color: colors.textMuted, marginTop: 4, fontStyle: 'italic' },

  evItem: { backgroundColor: 'rgba(51,65,85,0.5)', borderRadius: 8, padding: 10, gap: 6 },
  evItemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  evTitle: { fontSize: 12, fontWeight: '700', color: colors.primaryLight, lineHeight: 16, flex: 1 },
  evProviderBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  evProviderBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  evProviderBadgeSmall: { paddingHorizontal: 5, paddingVertical: 1 },
  evProviderBadgeTxt: { fontSize: 9, fontWeight: '600', color: colors.white },
  evProviderPubMed: { backgroundColor: 'rgba(34,139,34,0.85)' },
  evProviderEuropePmc: { backgroundColor: 'rgba(59,130,246,0.9)' },
  evProviderSemantic: { backgroundColor: 'rgba(139,92,246,0.85)' },
  evRelevance: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, backgroundColor: 'rgba(59,130,246,0.15)', borderRadius: 6, padding: 8 },
  evRelevanceTxt: { fontSize: 11, color: colors.primary, lineHeight: 15, flex: 1 },
  evExcerpt: { borderLeftWidth: 3, borderLeftColor: colors.primaryLight, paddingLeft: 8 },
  evExcerptTxt: { fontSize: 11, color: colors.border, fontStyle: 'italic', lineHeight: 15 },
  evAbstract: { fontSize: 11, color: colors.border, lineHeight: 16 },
  evSource: { fontSize: 10, color: colors.textMuted },

  panelEmpty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  peTitle: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },
  peSub: { fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 },
  panelFoot: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: 'rgba(30,41,59,0.8)', borderTopWidth: 1, borderTopColor: 'rgba(51,65,85,0.3)' },
  panelFootTxt: { fontSize: 12, color: colors.textSecondary },

  ctrl: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 20, paddingTop: 14, backgroundColor: 'rgba(15,23,42,0.95)' },
  cb: { width: 56, height: 64, borderRadius: 16, backgroundColor: colors.text, justifyContent: 'center', alignItems: 'center', gap: 4 },
  cbOn: { backgroundColor: 'rgba(239,68,68,0.6)' },
  endCb: { backgroundColor: colors.destructive },
  cLbl: { fontSize: 12, color: colors.white, fontWeight: '600' },

  loadTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  loadSub: { color: colors.textMuted, fontSize: 13 },
  errText: { color: colors.error, fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
  retryBtn: { marginTop: 12, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 12 },
  retryTxt: { color: colors.white, fontWeight: '700' },

  mOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  mCard: { backgroundColor: mc.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, gap: 12 },
  mHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  mTitle: { fontSize: 18, fontWeight: '700', color: mc.text },
  mSub: { fontSize: 13, color: mc.textMuted },
  mInput: { backgroundColor: mc.surface, borderRadius: 12, padding: 14, minHeight: 120, maxHeight: 200, color: mc.text, fontSize: 14, lineHeight: 22, borderWidth: 1, borderColor: mc.border },
  mActs: { flexDirection: 'row', gap: 12, marginTop: 8 },
  mBtnSec: { flex: 1, height: 48, borderRadius: 12, backgroundColor: mc.surfaceSecondary, justifyContent: 'center', alignItems: 'center' },
  mBtnSecT: { color: mc.textMuted, fontWeight: '600', fontSize: 14 },
  mBtnPri: { flex: 2, height: 48, borderRadius: 12, backgroundColor: mc.primary, justifyContent: 'center', alignItems: 'center' },
  mBtnPriT: { color: mc.white, fontWeight: '700', fontSize: 14 },

  // Doctor: Start Timer button
  startTimerOverlay: { position: 'absolute', left: 16, right: 16, bottom: 100, zIndex: 30, alignItems: 'center' },
  startTimerBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.success, paddingHorizontal: 24, paddingVertical: 16, borderRadius: 16, shadowColor: colors.success, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
  startTimerTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  startTimerSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },

  // Recording indicator
  backgroundHint: { position: 'absolute', left: 12, right: 12, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: 'rgba(44,177,255,0.12)', borderWidth: 1, borderColor: 'rgba(44,177,255,0.25)' },
  backgroundHintText: { flex: 1, fontSize: 12, color: colors.text, lineHeight: 18 },
  recIndicator: { position: 'absolute', left: 12, zIndex: 25, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.error },
  recIndicatorActive: { position: 'absolute' as const, left: 12, zIndex: 25, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.success },
  recIndicatorMuted: { position: 'absolute' as const, left: 12, zIndex: 25, flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.4)' },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.white },
  recText: { color: colors.white, fontSize: 12, fontWeight: '600' },
  recCountdownText: { color: 'rgba(255,255,255,0.95)', fontSize: 13, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },

  // Patient: Time Bank Badge
  bankBadge: { position: 'absolute', left: 12, zIndex: 25, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: 'rgba(22,163,74,0.2)' },
  bankText: { color: colors.success, fontSize: 12, fontWeight: '600' },

  // Patient: Early leave hint
  earlyLeaveHint: { position: 'absolute', left: 12, right: 12, zIndex: 25, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: 'rgba(30,41,59,0.92)' },
  earlyLeaveText: { color: colors.textMuted, fontSize: 12, flex: 1 },
  });
}
