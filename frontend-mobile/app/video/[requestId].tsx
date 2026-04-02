/**
 * Rota da videoconferência (Daily.co).
 * Em Expo Go ou se o módulo nativo falhar: mostra instruções amigáveis.
 * Em development build funcional: carrega VideoCallScreenInner dinamicamente.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRequireAuth } from '../../hooks/useRequireAuth';
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { spacing, borderRadius } from '../../lib/designSystem';
import type { DesignColors } from '../../lib/designSystem';
import { isExpoGo } from '../../lib/expo-go';

// Design system constants for video dark mode
const VIDEO_BG = '#0B1120';
const PRIMARY = '#0EA5E9';

class VideoErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void; colors: any },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) console.error('[VideoErrorBoundary] Caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const { onReset } = this.props;
      return (
        <View style={{ flex: 1, backgroundColor: VIDEO_BG, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(239,68,68,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
            <Ionicons name="warning-outline" size={40} color="#EF4444" />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff', marginTop: 8, textAlign: 'center' }}>
            Erro na videochamada
          </Text>
          <Text style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            Ocorreu um erro inesperado.{'\n'}Tente novamente ou volte para o pedido.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={{ fontSize: 11, color: '#f87171', marginTop: 12, textAlign: 'center', maxWidth: 300 }}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity
            style={{ marginTop: 24, backgroundColor: PRIMARY, borderRadius: 24, paddingVertical: 14, paddingHorizontal: 32 }}
            onPress={() => { this.setState({ hasError: false, error: null }); onReset(); }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function VideoRequestIdRoute() {
  const router = useRouter();
  const { ready } = useRequireAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const isLandscape = screenW > screenH;
  const styles = useMemo(() => makeStyles(colors, isLandscape), [colors, isLandscape]);
  const [Inner, setInner] = useState<React.ComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (isExpoGo) return;
    import('../../components/video/VideoCallScreenInner')
      .then((m) => setInner(() => m.default))
      .catch((e) => {
        if (__DEV__) console.warn('[Video] Falha ao carregar módulo:', e?.message);
        setLoadError(e?.message ?? 'Não foi possível iniciar a videochamada.');
      });
  }, [ready]);

  // Expo Go ou módulo não disponível -> instruções amigáveis para o usuário
  if (isExpoGo || loadError) {
    const isDev = __DEV__;
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Dark header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Consulta por Video</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.cardContainer}>
          <View style={styles.card}>
            {/* Icon */}
            <View style={styles.iconCircle}>
              <Ionicons name="videocam" size={40} color={PRIMARY} />
            </View>

            {loadError ? (
              <>
                <Text style={styles.title}>Erro ao iniciar videochamada</Text>
                <Text style={styles.message}>
                  Nao conseguimos carregar o modulo de video.{'\n'}
                  Feche o aplicativo, abra novamente e tente entrar na consulta.
                </Text>
              </>
            ) : isDev ? (
              <>
                <Text style={styles.title}>Modulo de video indisponivel</Text>
                <Text style={styles.message}>
                  Em modo de desenvolvimento (Expo Go), a videochamada nao esta disponivel.{'\n'}
                  Use um build de desenvolvimento para testar.
                </Text>
                <View style={styles.hintBox}>
                  <Text style={styles.hintCode}>expo run:android</Text>
                  <Text style={styles.hintOr}>ou</Text>
                  <Text style={styles.hintCode}>expo run:ios</Text>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.title}>Consulta por vídeo</Text>
                <Text style={styles.message}>
                  Seu médico está aguardando você.{'\n'}
                  Certifique-se de ter uma boa conexão com a internet e que a câmera e o microfone estejam liberados.
                </Text>
              </>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={() => router.back()}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Voltar para o pedido"
              >
                <Ionicons name="arrow-back-outline" size={18} color="#fff" />
                <Text style={styles.btnPrimaryText}>Voltar para o pedido</Text>
              </TouchableOpacity>

              {(loadError && !isDev) && (
                <TouchableOpacity
                  style={styles.btnGhost}
                  onPress={() => {
                    setLoadError(null);
                    import('../../components/video/VideoCallScreenInner')
                      .then((m) => setInner(() => m.default))
                      .catch((e) => setLoadError(e?.message ?? 'Erro'));
                  }}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel="Tentar novamente"
                >
                  <Ionicons name="refresh-outline" size={18} color={PRIMARY} />
                  <Text style={styles.btnGhostText}>Tentar novamente</Text>
                </TouchableOpacity>
              )}
            </View>

            {Platform.OS !== 'web' && (
              <View style={styles.tipsRow}>
                <Tip icon="wifi-outline" text="Conexão estável" />
                <Tip icon="mic-outline" text="Microfone liberado" />
                <Tip icon="videocam-outline" text="Camera liberada" />
              </View>
            )}
          </View>
        </View>
      </View>
    );
  }

  if (!Inner) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <View style={styles.loadingIconCircle}>
          <Ionicons name="videocam" size={32} color={PRIMARY} />
        </View>
        <ActivityIndicator size="large" color={PRIMARY} style={{ marginTop: 20 }} />
        <Text style={styles.loadingText}>Iniciando videochamada...</Text>
        <Text style={styles.loadingSubtext}>Aguarde um momento</Text>
      </View>
    );
  }

  return (
    <VideoErrorBoundary colors={colors} onReset={() => { setInner(null); setLoadError(null); setTimeout(() => { import('../../components/video/VideoCallScreenInner').then((m) => setInner(() => m.default)).catch((e) => setLoadError(e?.message ?? 'Erro')); }, 500); }}>
      <Inner />
    </VideoErrorBoundary>
  );
}

function Tip({ icon, text }: { icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; text: string }) {
  return (
    <View style={tipStyles.tip}>
      <View style={tipStyles.tipIcon}>
        <Ionicons name={icon} size={16} color={PRIMARY} />
      </View>
      <Text style={tipStyles.tipText}>{text}</Text>
    </View>
  );
}

const tipStyles = StyleSheet.create({
  tip: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  tipIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: `${PRIMARY}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
  },
});

function makeStyles(_colors: DesignColors, isLandscape: boolean) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: VIDEO_BG,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    headerTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
    backBtn: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.1)',
    },
    cardContainer: {
      flex: 1,
      justifyContent: 'center',
      paddingHorizontal: isLandscape ? '15%' : spacing.md,
    },
    card: {
      backgroundColor: 'rgba(255,255,255,0.05)',
      borderRadius: 20,
      padding: spacing.xl,
      alignItems: 'center',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.08)',
    },
    iconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: `${PRIMARY}20`,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.xs,
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: '#fff',
      textAlign: 'center',
      letterSpacing: -0.3,
    },
    message: {
      fontSize: 14,
      color: 'rgba(255,255,255,0.6)',
      textAlign: 'center',
      lineHeight: 22,
    },
    hintBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: 'rgba(255,255,255,0.08)',
      borderRadius: 10,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    hintCode: {
      fontFamily: 'monospace',
      fontSize: 12,
      color: 'rgba(255,255,255,0.8)',
      fontWeight: '600',
    },
    hintOr: {
      fontSize: 12,
      color: 'rgba(255,255,255,0.4)',
    },
    actions: {
      width: '100%',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    btnPrimary: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: PRIMARY,
      borderRadius: 24,
      paddingVertical: 14,
      minHeight: 48,
    },
    btnPrimaryText: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 15,
    },
    btnGhost: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: 24,
      paddingVertical: 12,
      borderWidth: 1.5,
      borderColor: PRIMARY,
      minHeight: 48,
    },
    btnGhostText: {
      color: PRIMARY,
      fontWeight: '700',
      fontSize: 15,
    },
    tipsRow: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    loadingScreen: {
      flex: 1,
      backgroundColor: VIDEO_BG,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
    },
    loadingIconCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: `${PRIMARY}20`,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#fff',
    },
    loadingSubtext: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.5)',
    },
  });
}
