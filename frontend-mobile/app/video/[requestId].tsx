import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
  Animated,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { colors, spacing, borderRadius } from '../../lib/themeDoctor';
import { createVideoRoom, startConsultation, finishConsultation, fetchRequestById, autoFinishConsultation, reportCallConnected } from '../../lib/api';
import { apiClient } from '../../lib/api-client';
import { VideoRoomResponseDto } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { PrimaryButton } from '../../components/ui/PrimaryButton';

type ConnectionQuality = 'connecting' | 'good' | 'poor' | 'bad';

interface CallState {
  muted: boolean;
  cameraOff: boolean;
  quality: ConnectionQuality;
  aiActive: boolean;
  transcriptSnippet: string;
}

export default function VideoCallScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<WebView>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startCalledRef = useRef(false);
  const connectedReportedRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const [room, setRoom] = useState<VideoRoomResponseDto | null>(null);
  const [videoPageUrl, setVideoPageUrl] = useState<string | null>(null);
  const [permissionsReady, setPermissionsReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const [callSeconds, setCallSeconds] = useState(0);
  const [contractedMinutes, setContractedMinutes] = useState<number | null>(null);
  const [consultationStartedAt, setConsultationStartedAt] = useState<string | null>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const alertedRef = useRef<Set<number>>(new Set());
  const autoFinishedRef = useRef(false);
  const [callState, setCallState] = useState<CallState>({
    muted: false,
    cameraOff: false,
    quality: 'connecting',
    aiActive: false,
    transcriptSnippet: '',
  });
  const [showTranscriptPanel, setShowTranscriptPanel] = useState(false);

  const rid = (Array.isArray(requestId) ? requestId[0] : requestId) ?? '';
  const isDoctor = user?.role === 'doctor';

  // Pulsing animation for "IA ativa" badge
  useEffect(() => {
    if (!callState.aiActive) return;
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [callState.aiActive, pulseAnim]);

  useEffect(() => { initRoom(); }, [rid]);

  useEffect(() => {
    if (room && isDoctor && rid && !startCalledRef.current) {
      startCalledRef.current = true;
      startConsultation(rid).catch(() => {});
    }
  }, [room, isDoctor, rid]);

  // Request permissions on Android (WebView handles it too, but ask early)
  useEffect(() => {
    if (!room?.id || !rid) return;
    let cancelled = false;
    (async () => {
      if (Platform.OS === 'android') {
        try {
          await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.CAMERA,
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          ]);
        } catch {}
      }
      if (!cancelled) setPermissionsReady(true);
    })();
    return () => { cancelled = true; };
  }, [room?.id, rid]);

  // Build video page URL
  useEffect(() => {
    if (!room?.id || !rid || !permissionsReady) return;
    let cancelled = false;
    (async () => {
      const token = await apiClient.getAuthToken();
      if (cancelled || !token) return;
      const base = apiClient.getBaseUrl();
      const url = `${base}/api/video/call-page?requestId=${encodeURIComponent(rid)}&access_token=${encodeURIComponent(token)}&role=${isDoctor ? 'doctor' : 'patient'}`;
      if (!cancelled) setVideoPageUrl(url);
    })();
    return () => { cancelled = true; };
  }, [room?.id, rid, isDoctor, permissionsReady]);

  // Timer sincronizado com o servidor: só conta quando o médico já iniciou (consultationStartedAt)
  useEffect(() => {
    if (!consultationStartedAt) return;
    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - new Date(consultationStartedAt).getTime()) / 1000);
      setCallSeconds(Math.max(0, elapsed));
    };
    updateElapsed();
    timerRef.current = setInterval(updateElapsed, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [consultationStartedAt]);

  // Fetch request: minutos contratados, status e momento em que a consulta começou (para paciente)
  useEffect(() => {
    if (!rid) return;
    let cancelled = false;
    fetchRequestById(rid)
      .then(req => {
        if (cancelled) return;
        if (req.contractedMinutes) setContractedMinutes(req.contractedMinutes);
        setRequestStatus(req.status ?? null);
        if (req.status === 'in_consultation' && (req.consultationStartedAt ?? (req as { consultation_started_at?: string }).consultation_started_at)) {
          const started = req.consultationStartedAt ?? (req as { consultation_started_at?: string }).consultation_started_at;
          setConsultationStartedAt(started);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [rid]);

  // Paciente: polling até o médico iniciar (status → in_consultation)
  useEffect(() => {
    if (isDoctor || !rid || !videoPageUrl || consultationStartedAt) return;
    if (requestStatus !== 'consultation_ready') return;
    const poll = () => {
      fetchRequestById(rid).then(req => {
        setRequestStatus(req.status ?? null);
        if (req.status === 'in_consultation') {
          const started = req.consultationStartedAt ?? (req as { consultation_started_at?: string }).consultation_started_at;
          if (started) setConsultationStartedAt(started);
        }
      }).catch(() => {});
    };
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [isDoctor, rid, videoPageUrl, consultationStartedAt, requestStatus]);

  // Countdown logic — monitor callSeconds against contractedMinutes
  useEffect(() => {
    if (contractedMinutes == null || contractedMinutes <= 0) return;
    const contractedSeconds = contractedMinutes * 60;
    const remainingSeconds = contractedSeconds - callSeconds;

    if (remainingSeconds === 120 && !alertedRef.current.has(120)) {
      alertedRef.current.add(120);
      Alert.alert('Atenção', 'Sua consulta termina em 2 minutos.');
    }
    if (remainingSeconds === 60 && !alertedRef.current.has(60)) {
      alertedRef.current.add(60);
      Alert.alert('Atenção', 'Sua consulta termina em 1 minuto.');
    }
    if (remainingSeconds <= 0 && !autoFinishedRef.current) {
      autoFinishedRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      Alert.alert(
        'Tempo esgotado',
        'O tempo contratado expirou. A consulta será encerrada.',
        [{
          text: 'OK',
          onPress: async () => {
            webviewRef.current?.injectJavaScript(`
              try { if(window.__localStream) { window.__localStream.getTracks().forEach(t => t.stop()); } } catch(e) {}
              true;
            `);
            try {
              await autoFinishConsultation(rid);
            } catch {}
            router.back();
          },
        }]
      );
    }
  }, [callSeconds, contractedMinutes, rid]);

  const initRoom = async () => {
    try {
      if (!rid) throw new Error('ID inválido');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo esgotado. Tente novamente.')), 25000)
      );
      const videoRoom = await Promise.race([createVideoRoom(rid), timeoutPromise]);
      setRoom(videoRoom);
    } catch (e: any) {
      setError(e?.message || 'Erro ao carregar sala');
    } finally {
      setLoading(false);
    }
  };

  const handleEnd = () => {
    Alert.alert('Encerrar consulta', 'Deseja encerrar a videochamada agora?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Encerrar',
        style: 'destructive',
        onPress: async () => {
          // Tell WebView to close tracks first
          webviewRef.current?.injectJavaScript(`
            try { if(window.__localStream) { window.__localStream.getTracks().forEach(t => t.stop()); } } catch(e) {}
            true;
          `);
          if (isDoctor && rid) {
            setEnding(true);
            try {
              await finishConsultation(rid);
            } catch (e: any) {
              Alert.alert('Erro', e?.message || 'Não foi possível encerrar.');
            } finally {
              setEnding(false);
            }
          }
          if (timerRef.current) clearInterval(timerRef.current);
          router.back();
        },
      },
    ]);
  };

  // Inject JS to toggle mute
  const handleMuteToggle = useCallback(() => {
    const nextMuted = !callState.muted;
    webviewRef.current?.injectJavaScript(`
      (function() {
        try {
          if(window.__localStream) {
            window.__localStream.getAudioTracks().forEach(t => { t.enabled = ${!nextMuted}; });
          }
          if(window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'muteState',muted:${nextMuted}}));
          }
        } catch(e) {}
      })();
      true;
    `);
    setCallState((prev) => ({ ...prev, muted: nextMuted }));
  }, [callState.muted]);

  // Inject JS to toggle camera
  const handleCameraToggle = useCallback(() => {
    const nextOff = !callState.cameraOff;
    webviewRef.current?.injectJavaScript(`
      (function() {
        try {
          if(window.__localStream) {
            window.__localStream.getVideoTracks().forEach(t => { t.enabled = ${!nextOff}; });
          }
          if(window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({type:'cameraState',off:${nextOff}}));
          }
        } catch(e) {}
      })();
      true;
    `);
    setCallState((prev) => ({ ...prev, cameraOff: nextOff }));
  }, [callState.cameraOff]);

  // Inject JS to flip camera
  const handleFlipCamera = useCallback(() => {
    webviewRef.current?.injectJavaScript(`
      (function() {
        try {
          if(window.__flipCamera) { window.__flipCamera(); }
        } catch(e) {}
      })();
      true;
    `);
  }, []);

  // Reportar ao backend quando WebRTC estiver conectado (timer só começa quando médico e paciente estiverem conectados)
  const reportConnectedOnce = useCallback(() => {
    if (!rid || connectedReportedRef.current) return;
    connectedReportedRef.current = true;
    reportCallConnected(rid)
      .then((res: { consultationStartedAt?: string | null }) => {
        const started = res?.consultationStartedAt ?? (res as { consultation_started_at?: string })?.['consultation_started_at'];
        if (started) setConsultationStartedAt(started);
      })
      .catch(() => { connectedReportedRef.current = false; });
  }, [rid]);

  // Messages from WebView
  const handleWebViewMessage = useCallback((e: any) => {
    try {
      const data = JSON.parse(e.nativeEvent.data);
      if (data?.type === 'error') {
        Alert.alert('Erro no vídeo', data.message);
      } else if (data?.type === 'mediaStatus') {
        if (data.status === 'error' && data.message) {
          Alert.alert('Câmera e microfone', data.message);
        }
      } else if (data?.type === 'end') {
        handleEnd();
      } else if (data?.type === 'muteState') {
        setCallState((prev) => ({ ...prev, muted: !!data.muted }));
      } else if (data?.type === 'cameraState') {
        setCallState((prev) => ({ ...prev, cameraOff: !!data.off }));
      } else if (data?.type === 'quality') {
        setCallState((prev) => ({ ...prev, quality: data.quality as ConnectionQuality }));
        if (data.quality === 'good' || data.quality === 'poor') reportConnectedOnce();
      } else if (data?.type === 'aiActive') {
        setCallState((prev) => ({ ...prev, aiActive: !!data.active }));
      } else if (data?.type === 'transcriptSnippet') {
        setCallState((prev) => ({ ...prev, transcriptSnippet: data.text || '' }));
      }
    } catch {}
  }, [reportConnectedOnce]);

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const qualityColor = {
    connecting: '#64748B',
    good: '#22C55E',
    poor: '#F59E0B',
    bad: '#EF4444',
  }[callState.quality];

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Conectando à sala...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Error ─────────────────────────────────────────────────
  if (error || !room?.id) {
    const retry = () => {
      setError('');
      setLoading(true);
      setVideoPageUrl(null);
      initRoom();
    };
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="videocam-off" size={56} color="#475569" />
          <Text style={styles.errorTitle}>Sala não disponível</Text>
          <Text style={styles.errorDesc}>{error || 'A sala de vídeo ainda não foi criada.'}</Text>
          <View style={styles.errorActions}>
            <PrimaryButton label="Tentar novamente" onPress={retry} style={styles.retryBtn} />
            <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
              <Text style={styles.backBtnText}>Voltar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Waiting for URL ───────────────────────────────────────
  if (!videoPageUrl) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>
            {Platform.OS === 'android' && !permissionsReady
              ? 'Solicitando câmera e microfone...'
              : 'Preparando vídeo...'}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const bottomPadding = Math.max(insets.bottom, 16);

  // ─── Main call screen ──────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* WebView — full screen */}
      <WebView
        ref={webviewRef}
        source={{
          uri: videoPageUrl,
          headers: videoPageUrl.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : undefined,
        }}
        style={StyleSheet.absoluteFill}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        mediaCapturePermissionGrantType="grant"
        onPermissionRequest={(req) => { req.grant(req.getResources()); }}
        onMessage={handleWebViewMessage}
        onError={() => setError('Falha ao carregar a sala de vídeo.')}
      />

      {/* ── Paciente: aviso quando o médico ainda não iniciou ─ */}
      {!consultationStartedAt && (requestStatus === 'consultation_ready' || requestStatus === 'in_consultation') && (
        <View style={[styles.waitingBanner, { paddingTop: insets.top + 10 }]}>
          <Ionicons name="time" size={20} color="#F59E0B" />
          <Text style={styles.waitingBannerText}>O tempo só começa quando você e o {isDoctor ? 'paciente' : 'médico'} estiverem conectados na chamada.</Text>
        </View>
      )}

      {/* ── Top HUD ───────────────────────────────────────── */}
      <View style={[styles.topHud, { paddingTop: insets.top + 8 }]}>
        {/* Timer — só mostra quando a consulta já começou (consultationStartedAt); countdown se há minutos contratados */}
        {(() => {
          if (!consultationStartedAt) {
            return (
              <View style={styles.timerChip}>
                <View style={[styles.recDot, { backgroundColor: qualityColor }]} />
                <Text style={styles.timerText}>--:--</Text>
              </View>
            );
          }
          const isCountdown = contractedMinutes != null && contractedMinutes > 0;
          const contractedSec = (contractedMinutes ?? 0) * 60;
          const remainingSec = Math.max(0, contractedSec - callSeconds);
          const timerLabel = isCountdown ? formatTimer(remainingSec) : formatTimer(callSeconds);
          const isUrgent = isCountdown && remainingSec <= 120;
          return (
            <View style={[styles.timerChip, isUrgent && { backgroundColor: 'rgba(239,68,68,0.85)' }]}>
              <View style={[styles.recDot, { backgroundColor: isUrgent ? '#fff' : qualityColor }]} />
              <Text style={styles.timerText}>{isCountdown ? `⏳ ${timerLabel}` : timerLabel}</Text>
            </View>
          );
        })()}

        {/* Quality */}
        <View style={[styles.qualityChip, { borderColor: qualityColor }]}>
          <Ionicons
            name={callState.quality === 'good' ? 'wifi' : callState.quality === 'connecting' ? 'sync' : 'wifi-outline'}
            size={12}
            color={qualityColor}
          />
          <Text style={[styles.qualityText, { color: qualityColor }]}>
            {callState.quality === 'connecting' ? 'Conectando' : callState.quality === 'good' ? 'Boa' : callState.quality === 'poor' ? 'Instável' : 'Fraca'}
          </Text>
        </View>

        {/* IA badge (doctor only) */}
        {isDoctor && callState.aiActive && (
          <Animated.View style={[styles.iaChip, { opacity: pulseAnim }]}>
            <Ionicons name="sparkles" size={12} color="#A78BFA" />
            <Text style={styles.iaText}>IA ativa</Text>
          </Animated.View>
        )}
      </View>

      {/* ── Transcript snippet overlay (doctor only) ──────── */}
      {isDoctor && callState.transcriptSnippet.length > 0 && (
        <TouchableOpacity
          style={styles.transcriptSnippet}
          onPress={() => setShowTranscriptPanel(!showTranscriptPanel)}
          activeOpacity={0.9}
        >
          <Ionicons name="mic" size={12} color="#94A3B8" />
          <Text style={styles.transcriptSnippetText} numberOfLines={2}>
            {callState.transcriptSnippet}
          </Text>
          <Ionicons name={showTranscriptPanel ? 'chevron-up' : 'chevron-down'} size={12} color="#64748B" />
        </TouchableOpacity>
      )}

      {/* ── Bottom controls bar ───────────────────────────── */}
      <View style={[styles.controlBar, { paddingBottom: bottomPadding }]}>
        {/* Mute */}
        <TouchableOpacity
          style={[styles.controlBtn, callState.muted && styles.controlBtnActive]}
          onPress={handleMuteToggle}
          activeOpacity={0.8}
        >
          <Ionicons
            name={callState.muted ? 'mic-off' : 'mic'}
            size={22}
            color={callState.muted ? '#EF4444' : '#fff'}
          />
          <Text style={[styles.controlLabel, callState.muted && styles.controlLabelActive]}>
            {callState.muted ? 'Desmutar' : 'Mudo'}
          </Text>
        </TouchableOpacity>

        {/* Camera */}
        <TouchableOpacity
          style={[styles.controlBtn, callState.cameraOff && styles.controlBtnActive]}
          onPress={handleCameraToggle}
          activeOpacity={0.8}
        >
          <Ionicons
            name={callState.cameraOff ? 'videocam-off' : 'videocam'}
            size={22}
            color={callState.cameraOff ? '#EF4444' : '#fff'}
          />
          <Text style={[styles.controlLabel, callState.cameraOff && styles.controlLabelActive]}>
            {callState.cameraOff ? 'Ligar cam.' : 'Câmera'}
          </Text>
        </TouchableOpacity>

        {/* Flip camera */}
        <TouchableOpacity style={styles.controlBtn} onPress={handleFlipCamera} activeOpacity={0.8}>
          <Ionicons name="camera-reverse" size={22} color="#fff" />
          <Text style={styles.controlLabel}>Virar</Text>
        </TouchableOpacity>

        {/* End call */}
        <TouchableOpacity style={styles.endBtn} onPress={handleEnd} disabled={ending} activeOpacity={0.8}>
          {ending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Ionicons name="call" size={26} color="#fff" />
          }
          <Text style={styles.endBtnLabel}>Encerrar</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  loadingText: { fontSize: 14, color: '#94A3B8', marginTop: 8 },

  waitingBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(245,158,11,0.2)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(245,158,11,0.4)',
    zIndex: 19,
  },
  waitingBannerText: {
    flex: 1,
    fontSize: 13,
    color: '#FCD34D',
    fontWeight: '500',
  },
  // Top HUD
  topHud: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
    gap: 8,
    zIndex: 20,
  },
  timerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
  },
  recDot: { width: 7, height: 7, borderRadius: 4 },
  timerText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  qualityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,23,42,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  qualityText: { fontSize: 11, fontWeight: '600' },
  iaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(109,40,217,0.35)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#7C3AED44',
  },
  iaText: { color: '#A78BFA', fontSize: 11, fontWeight: '600' },

  // Transcript snippet
  transcriptSnippet: {
    position: 'absolute',
    bottom: 120,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(15,23,42,0.88)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 15,
    borderWidth: 1,
    borderColor: '#334155',
  },
  transcriptSnippetText: { flex: 1, color: '#CBD5E1', fontSize: 12, lineHeight: 17 },

  // Bottom controls
  controlBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingTop: 14,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(15,23,42,0.9)',
    zIndex: 20,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 58,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  controlBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.18)',
  },
  controlLabel: { color: '#CBD5E1', fontSize: 10, fontWeight: '500', textAlign: 'center' },
  controlLabelActive: { color: '#EF4444' },
  endBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    backgroundColor: '#EF4444',
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    minWidth: 74,
  },
  endBtnLabel: { color: '#fff', fontSize: 10, fontWeight: '600' },

  // Error screen
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#94A3B8', textAlign: 'center' },
  errorDesc: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  errorActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  retryBtn: { flex: 1 },
  backBtn: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
