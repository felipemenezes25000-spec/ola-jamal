/**
 * Rota da videoconferência (Daily.co).
 * No Expo Go não há módulos nativos do Daily/WebRTC — esta rota mostra um aviso
 * e não carrega o código da chamada. Em development build (expo run:android/ios)
 * o conteúdo real é carregado dinamicamente de VideoCallScreenInner.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../lib/theme';

const IN_EXPO_GO = Constants.appOwnership === 'expo';

export default function VideoRequestIdRoute() {
  const router = useRouter();
  const [Inner, setInner] = useState<React.ComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (IN_EXPO_GO) return;
    import('../../components/video/VideoCallScreenInner')
      .then((m) => setInner(() => m.default))
      .catch((e) => setLoadError(e?.message ?? 'Falha ao carregar a tela de vídeo'));
  }, []);

  // Expo Go: mostrar aviso em vez de carregar Daily (evita Invariant Violation)
  if (IN_EXPO_GO) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="videocam-outline" size={56} color={colors.primary} />
          <Text style={styles.title}>Videoconferência</Text>
          <Text style={styles.message}>
            A videochamada usa módulos nativos (Daily.co / WebRTC) que não funcionam no Expo Go.
          </Text>
          <Text style={styles.hint}>
            Para testar a consulta por vídeo, use um build de desenvolvimento:{'\n'}
            <Text style={styles.code}>expo run:android</Text> ou <Text style={styles.code}>expo run:ios</Text>
          </Text>
          <TouchableOpacity style={styles.button} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Carregando tela real (development build)
  if (loadError) {
    return (
      <View style={styles.container}>
        <View style={styles.card}>
          <Ionicons name="alert-circle" size={48} color={colors.error} />
          <Text style={styles.errText}>{loadError}</Text>
          <TouchableOpacity style={styles.button} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={styles.buttonText}>Voltar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!Inner) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Carregando videochamada...</Text>
      </View>
    );
  }

  return <Inner />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 24,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 16,
    maxWidth: 400,
    alignSelf: 'center',
    marginTop: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  hint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  code: {
    fontFamily: 'monospace',
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  button: {
    marginTop: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    backgroundColor: colors.primary,
    borderRadius: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  errText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
