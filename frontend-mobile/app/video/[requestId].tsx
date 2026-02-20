import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import { colors, spacing, borderRadius, gradients } from '../../lib/themeDoctor';
import { createVideoRoom, startConsultation, finishConsultation } from '../../lib/api';
import { apiClient } from '../../lib/api-client';
import { VideoRoomResponseDto } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import { PrimaryButton } from '../../components/ui/PrimaryButton';

export default function VideoCallScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [room, setRoom] = useState<VideoRoomResponseDto | null>(null);
  const [videoPageUrl, setVideoPageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const startCalledRef = useRef(false);

  const rid = (Array.isArray(requestId) ? requestId[0] : requestId) ?? '';

  useEffect(() => { initRoom(); }, [rid]);

  useEffect(() => {
    if (room && user?.role === 'doctor' && rid && !startCalledRef.current) {
      startCalledRef.current = true;
      startConsultation(rid).catch(() => {});
    }
  }, [room, user?.role, rid]);

  useEffect(() => {
    if (!room?.id || !rid) return;
    let cancelled = false;
    (async () => {
      const token = await apiClient.getAuthToken();
      if (cancelled || !token) return;
      const base = apiClient.getBaseUrl();
      const url = `${base}/api/video/call-page?requestId=${encodeURIComponent(rid)}&access_token=${encodeURIComponent(token)}&role=${user?.role === 'doctor' ? 'doctor' : 'patient'}`;
      if (!cancelled) setVideoPageUrl(url);
    })();
    return () => { cancelled = true; };
  }, [room?.id, rid, user?.role]);

  const ROOM_TIMEOUT_MS = 20000;

  const initRoom = async () => {
    try {
      if (!rid) throw new Error('ID inválido');
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Tempo esgotado. Tente novamente.')), ROOM_TIMEOUT_MS)
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
    Alert.alert('Encerrar', 'Deseja encerrar a videochamada?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Encerrar',
        style: 'destructive',
        onPress: async () => {
          if (user?.role === 'doctor' && rid) {
            setEnding(true);
            try {
              await finishConsultation(rid);
            } catch (e: any) {
              Alert.alert('Erro', e?.message || 'Não foi possível encerrar.');
            } finally {
              setEnding(false);
            }
          }
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Conectando à sala...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error || !room?.id) {
    const retry = () => {
      setError('');
      setLoading(true);
      setVideoPageUrl(null);
      initRoom();
    };
    return (
      <SafeAreaView style={styles.container}>
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

  if (!videoPageUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Preparando vídeo...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[...gradients.doctorHeader]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.header}
      >
        <Text style={styles.headerTitle}>Consulta em andamento</Text>
        <TouchableOpacity style={styles.endBtn} onPress={handleEnd} disabled={ending}>
          {ending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="call" size={20} color="#fff" />}
        </TouchableOpacity>
      </LinearGradient>
      <View style={styles.webviewContainer}>
        <WebView
          source={{ uri: videoPageUrl }}
          style={styles.webview}
          javaScriptEnabled
          domStorageEnabled
          mediaPlaybackRequiresUserAction={false}
          allowsInlineMediaPlayback
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl, gap: spacing.md },
  loadingText: { fontSize: 14, color: '#94A3B8' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  endBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.error,
    justifyContent: 'center', alignItems: 'center',
  },
  webviewContainer: { flex: 1 },
  webview: { flex: 1 },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#94A3B8' },
  errorDesc: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  errorActions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  retryBtn: { flex: 1 },
  backBtn: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
