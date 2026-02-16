import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { colors, spacing, borderRadius } from '../../lib/theme';
import { createVideoRoom, startConsultation, finishConsultation } from '../../lib/api';
import { VideoRoomResponseDto } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';

export default function VideoCallScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [room, setRoom] = useState<VideoRoomResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [ending, setEnding] = useState(false);
  const startCalledRef = useRef(false);

  useEffect(() => { initRoom(); }, [requestId]);

  useEffect(() => {
    if (room && user?.role === 'doctor' && requestId && !startCalledRef.current) {
      startCalledRef.current = true;
      startConsultation(requestId).catch(() => {});
    }
  }, [room, user?.role, requestId]);

  const initRoom = async () => {
    try {
      if (!requestId) throw new Error('ID inválido');
      const videoRoom = await createVideoRoom(requestId);
      setRoom(videoRoom);
    } catch (e: any) {
      setError(e.message || 'Erro ao carregar sala');
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
          if (user?.role === 'doctor' && requestId) {
            setEnding(true);
            try {
              await finishConsultation(requestId);
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

  if (error || !room?.roomUrl) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="videocam-off" size={56} color="#475569" />
          <Text style={styles.errorTitle}>Sala não disponível</Text>
          <Text style={styles.errorDesc}>{error || 'A sala de vídeo ainda não foi criada.'}</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Consulta em Andamento</Text>
        <TouchableOpacity style={styles.endBtn} onPress={handleEnd} disabled={ending}>
          {ending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="call" size={20} color="#fff" />}
        </TouchableOpacity>
      </View>
      <View style={styles.webviewContainer}>
        <WebView
          source={{ uri: room.roomUrl }}
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
    padding: spacing.md,
  },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#fff' },
  endBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.error,
    justifyContent: 'center', alignItems: 'center',
  },
  webviewContainer: { flex: 1, borderRadius: borderRadius.lg, overflow: 'hidden', margin: spacing.sm },
  webview: { flex: 1 },
  errorTitle: { fontSize: 18, fontWeight: '600', color: '#94A3B8' },
  errorDesc: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  backBtn: {
    borderWidth: 2, borderColor: colors.primary, borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, marginTop: spacing.md,
  },
  backBtnText: { fontSize: 15, fontWeight: '600', color: colors.primary },
});
