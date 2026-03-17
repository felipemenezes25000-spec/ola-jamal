/**
 * GlobalErrorBoundary — captura erros de renderização no nível raiz do app.
 *
 * Diferente de ErrorBoundary (por tela), este componente envolve TODO o app
 * e garante que qualquer crash nos providers/contexts (AuthContext, QueryClient,
 * NotificationProvider etc.) seja capturado, reportado ao Sentry e exiba uma
 * tela de recuperação em vez de fechar silenciosamente.
 *
 * Uso: envolver o <RootLayout> inteiro em _layout.tsx
 */
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sentry } from '../lib/sentry';
import { trackError } from '../lib/analytics';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorId: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorId: `crash_${Date.now().toString(36)}`,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { errorId } = this.state;

    // 1. Sentry: captura com contexto completo da stack de componentes
    const sentryId = (Sentry as typeof Sentry | undefined)?.captureException?.(error, {
      extra: {
        componentStack: errorInfo.componentStack,
        errorId,
        platform: Platform.OS,
      },
      tags: {
        'crash.level': 'global',
        'crash.source': 'GlobalErrorBoundary',
      },
    });

    // 2. Analytics: registra o crash para funnel/relatório de saúde do app
    try {
      trackError('global_crash', error.message, 'RootLayout', {
        sentry_id: sentryId ?? 'not_captured',
        error_id: errorId ?? '',
        error_name: error.name,
      });
    } catch { /* analytics não pode falhar no handler de crash */ }

    if (__DEV__) {
      console.error('[GlobalErrorBoundary] Crash capturado:', error);
      console.error('[GlobalErrorBoundary] Stack de componentes:', errorInfo.componentStack);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorId: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.safe}>
          <View style={styles.container}>
            <View style={styles.iconWrap}>
              <Ionicons name="alert-circle-outline" size={64} color="#C0392B" />
            </View>
            <Text style={styles.title}>O app encontrou um problema</Text>
            <Text style={styles.subtitle}>
              Algo inesperado aconteceu. Nossa equipe já foi notificada.
              {'\n'}Tente recarregar o app.
            </Text>

            {this.state.error && (
              <View style={styles.devBox}>
                <Text style={styles.devLabel}>{__DEV__ ? 'DEV — erro capturado:' : 'Detalhes do erro:'}</Text>
                <Text style={styles.devText} numberOfLines={8} selectable>
                  {this.state.error.name}: {this.state.error.message}
                </Text>
              </View>
            )}

            <Pressable
              style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
              onPress={this.handleReset}
            >
              <Text style={styles.btnText}>Tentar novamente</Text>
            </Pressable>

            {this.state.errorId && (
              <Text style={styles.errorId}>ID: {this.state.errorId}</Text>
            )}
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  iconWrap: { marginBottom: 20 },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: '#6B6B6B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  devBox: {
    width: '100%',
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFEAA7',
  },
  devLabel: { fontSize: 11, fontWeight: '700', color: '#856404', marginBottom: 4 },
  devText: { fontSize: 11, color: '#533f03', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  btn: {
    backgroundColor: '#1A73E8',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  btnPressed: { opacity: 0.8 },
  btnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  errorId: { marginTop: 16, fontSize: 11, color: '#BBBBBB' },
});
