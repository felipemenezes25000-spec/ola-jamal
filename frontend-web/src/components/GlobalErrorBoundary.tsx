/**
 * GlobalErrorBoundary — captura erros de renderização no nível raiz da web app.
 * Exibe tela de fallback em vez de tela branca.
 *
 * Uso: envolver <App /> em main.tsx
 */
import { Component, ErrorInfo, ReactNode } from 'react';

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
    if (import.meta.env.DEV) {
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
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          backgroundColor: '#f9fafb',
          color: '#111827',
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            O app encontrou um problema
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280', textAlign: 'center', maxWidth: 400, lineHeight: 1.6 }}>
            Algo inesperado aconteceu. Nossa equipe já foi notificada.
            Tente recarregar a página.
          </p>

          {import.meta.env.DEV && this.state.error && (
            <pre style={{
              marginTop: 16,
              padding: 12,
              background: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: 8,
              fontSize: 12,
              maxWidth: 600,
              overflowX: 'auto',
              textAlign: 'left',
            }}>
              {this.state.error.name}: {this.state.error.message}
            </pre>
          )}

          <button
            onClick={this.handleReset}
            style={{
              marginTop: 24,
              padding: '12px 28px',
              background: '#1a73e8',
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Tentar novamente
          </button>

          {this.state.errorId && (
            <p style={{ marginTop: 12, fontSize: 11, color: '#9ca3af' }}>
              ID: {this.state.errorId}
            </p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
