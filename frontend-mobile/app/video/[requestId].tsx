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
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
// FIX #9: Unificado imports — spacing, borderRadius e shadows todos de designSystem
import { useAppTheme } from '../../lib/ui/useAppTheme';
import { spacing, borderRadius, shadows } from '../../lib/designSystem';
import type { DesignColors } from '../../lib/designSystem';
import { isExpoGo } from '../../lib/expo-go';
import * as Sentry from '@sentry/react-native';

class VideoErrorBoundary extends React.Component<
  { children: React.ReactNode; onReset: () => void; colors: any },
  { hasError: boolean; error: Error | null }
> {
  state = { hasError: false, error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Report to Sentry so we can debug
    try {
      Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
    } catch {}
    if (__DEV__) console.error('[VideoErrorBoundary] Caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      const { colors, onReset } = this.props;
      return (
        <View style={{ flex: 1, backgroundColor: colors?.background ?? '#000', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <Ionicons name="warning-outline" size={56} color={colors?.error ?? '#ef4444'} />
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors?.text ?? '#fff', marginTop: 16, textAlign: 'center' }}>
            Erro na videochamada
          </Text>
          <Text style={{ fontSize: 14, color: colors?.textSecondary ?? '#aaa', marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            Ocorreu um erro inesperado.{'\n'}Tente novamente ou volte para o pedido.
          </Text>
          {__DEV__ && this.state.error && (
            <Text style={{ fontSize: 11, color: '#f87171', marginTop: 12, textAlign: 'center', maxWidth: 300 }}>
              {this.state.error.message}
            </Text>
          )}
          <TouchableOpacity
            style={{ marginTop: 20, backgroundColor: colors?.primary ?? '#0EA5E9', borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32 }}
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
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [Inner, setInner] = useState<React.ComponentType | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isExpoGo) return;
    import('../../components/video/VideoCallScreenInner')
      .then((m) => setInner(() => m.default))
      .catch((e) => {
        console.warn('[Video] Falha ao carregar módulo:', e?.message);
        setLoadError(e?.message ?? 'Não foi possível iniciar a videochamada.');
      });
  }, []);

  // Expo Go ou módulo não disponível → instruções amigáveis para o usuário
  if (isExpoGo || loadError) {
    const isDev = __DEV__;
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            hitSlop={12}
          >
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Consulta por Vídeo</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="videocam" size={40} color={colors.primary} />
          </View>

          {loadError ? (
            <>
              <Text style={styles.title}>Erro ao iniciar videochamada</Text>
              <Text style={styles.message}>
                Não conseguimos carregar o módulo de vídeo.{'\n'}
                Feche o aplicativo, abra novamente e tente entrar na consulta.
              </Text>
            </>
          ) : isDev ? (
            <>
              <Text style={styles.title}>Módulo de vídeo indisponível</Text>
              <Text style={styles.message}>
                Em modo de desenvolvimento (Expo Go), a videochamada não está disponível.{'\n'}
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
              <Ionicons name="arrow-back-outline" size={18} color={colors.white} />
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
                <Ionicons name="refresh-outline" size={18} color={colors.primary} />
                <Text style={styles.btnGhostText}>Tentar novamente</Text>
              </TouchableOpacity>
            )}
          </View>

          {Platform.OS !== 'web' && (
            <View style={styles.tipsRow}>
              <Tip icon="wifi-outline" text="Conexão estável" colors={colors} tipStyle={styles.tip} tipTextStyle={styles.tipText} />
              <Tip icon="mic-outline" text="Microfone liberado" colors={colors} tipStyle={styles.tip} tipTextStyle={styles.tipText} />
              <Tip icon="videocam-outline" text="Câmera liberada" colors={colors} tipStyle={styles.tip} tipTextStyle={styles.tipText} />
            </View>
          )}
        </View>
      </View>
    );
  }

  if (!Inner) {
    return (
      <View style={[styles.loadingScreen, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Iniciando videochamada…</Text>
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

// FIX #21: Tip recebe colors e styles via props para evitar recriar styles por instância
function Tip({ icon, text, colors, tipStyle, tipTextStyle }: { icon: keyof typeof import('@expo/vector-icons').Ionicons.glyphMap; text: string; colors: DesignColors; tipStyle: any; tipTextStyle: any }) {
  return (
    <View style={tipStyle}>
      <Ionicons name={icon} size={16} color={colors.primary} />
      <Text style={tipTextStyle}>{text}</Text>
    </View>
  );
}

function makeStyles(colors: DesignColors) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  card: {
    margin: spacing.md,
    marginTop: spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
    shadowColor: shadows.lg.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  hintCode: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: colors.text,
    fontWeight: '600',
  },
  hintOr: {
    fontSize: 12,
    color: colors.textMuted,
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
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    minHeight: 48,
  },
  btnPrimaryText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
  btnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    minHeight: 48,
  },
  btnGhostText: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 15,
  },
  tipsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  tip: {
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  tipText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  loadingSubtext: {
    fontSize: 13,
    color: colors.textMuted,
  },
  });
}
