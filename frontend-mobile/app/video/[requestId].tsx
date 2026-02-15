import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Loading } from '../../components/Loading';
import { Button } from '../../components/Button';
import { createVideoRoom } from '../../lib/api';
import { VideoRoomResponseDto } from '../../types/database';
import { colors, spacing, typography, borderRadius } from '../../constants/theme';

export default function VideoCallScreen() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<VideoRoomResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { initRoom(); }, [requestId]);

  const initRoom = async () => {
    try {
      if (!requestId) throw new Error('ID inválido');
      // Backend createVideoRoom is idempotent - creates or returns existing room
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
      { text: 'Encerrar', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  if (loading) return (
    <SafeAreaView style={styles.container}>
      <Loading color={colors.primary} message="Conectando à sala..." />
    </SafeAreaView>
  );

  if (error || !room?.roomUrl) return (
    <SafeAreaView style={styles.container}>
      <View style={styles.errorContainer}>
        <Ionicons name="videocam-off" size={56} color={colors.gray300} />
        <Text style={styles.errorTitle}>Sala não disponível</Text>
        <Text style={styles.errorDesc}>{error || 'A sala de vídeo ainda não foi criada.'}</Text>
        <Button title="Voltar" onPress={() => router.back()} variant="outline" style={{ marginTop: spacing.lg }} />
      </View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Consulta em Andamento</Text>
        <TouchableOpacity style={styles.endBtn} onPress={handleEnd}>
          <Ionicons name="call" size={20} color={colors.white} />
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
  container: { flex: 1, backgroundColor: colors.gray900 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.md },
  headerTitle: { ...typography.bodySemiBold, color: colors.white },
  endBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.error, justifyContent: 'center', alignItems: 'center' },
  webviewContainer: { flex: 1, borderRadius: borderRadius.xl, overflow: 'hidden', margin: spacing.sm },
  webview: { flex: 1 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.xl },
  errorTitle: { ...typography.h4, color: colors.gray400, marginTop: spacing.md },
  errorDesc: { ...typography.bodySmall, color: colors.gray500, textAlign: 'center', marginTop: spacing.xs },
});
