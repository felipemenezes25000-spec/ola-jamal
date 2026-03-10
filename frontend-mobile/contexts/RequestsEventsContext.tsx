import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import {
  startRequestsEventsConnection,
  stopRequestsEventsConnection,
  subscribeRequestsEvents,
  isRequestsEventsConnected,
  RequestUpdatedPayload,
  RequestUpdatedListener,
} from '../lib/requestsEvents';
import { useAuth } from './AuthContext';

export interface PendingRequestUpdate {
  requestId: string;
  message: string;
}

interface RequestsEventsContextType {
  /** Se a conexão SignalR com o hub de solicitações está ativa. */
  isConnected: boolean;
  /**
   * Inscreve um callback para ser chamado quando qualquer solicitação for atualizada (status, pagamento, assinatura, etc.).
   * Retorna função para cancelar a inscrição.
   */
  subscribe: (listener: RequestUpdatedListener) => () => void;
  /** Atualização de pedido recebida em tempo real — exibir banner na tela atual (ex.: Configurações). Limpar ao navegar ou dispensar. */
  pendingUpdate: PendingRequestUpdate | null;
  setPendingUpdate: (update: PendingRequestUpdate | null) => void;
}

const RequestsEventsContext = createContext<RequestsEventsContextType | undefined>(undefined);

export function RequestsEventsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [isConnected, setConnected] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState<PendingRequestUpdate | null>(null);

  useEffect(() => {
    if (!user) {
      stopRequestsEventsConnection().then(() => setConnected(false));
      return;
    }
    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 3;

    const RECONNECT_COOLDOWN_MS = 10_000;
    let lastReconnectAt = 0;

    const tryConnect = () => {
      if (cancelled) return;
      startRequestsEventsConnection().then((ok) => {
        if (!cancelled) setConnected(ok && isRequestsEventsConnected());
        // Se falhou e ainda não esgotou retries, tenta de novo em 10s (evita spam em cold start)
        if (!ok && !cancelled && retryCount < maxRetries) {
          retryCount++;
          setTimeout(tryConnect, 10_000);
        }
      });
    };
    tryConnect();

    const interval = setInterval(() => {
      if (!cancelled) setConnected(isRequestsEventsConnected());
    }, 5000);

    // Reconectar ao voltar do background — cooldown evita spam se usuário alterna apps rapidamente
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active' || cancelled || !user || isRequestsEventsConnected()) return;
      const now = Date.now();
      if (now - lastReconnectAt < RECONNECT_COOLDOWN_MS) return;
      lastReconnectAt = now;
      startRequestsEventsConnection().then((ok) => {
        if (!cancelled) setConnected(ok && isRequestsEventsConnected());
      });
    });

    return () => {
      cancelled = true;
      sub.remove();
      clearInterval(interval);
      stopRequestsEventsConnection();
    };
  }, [user]);

  const subscribe = useCallback((listener: RequestUpdatedListener) => {
    return subscribeRequestsEvents((payload: RequestUpdatedPayload) => {
      listener(payload);
    });
  }, []);

  return (
    <RequestsEventsContext.Provider value={{ isConnected, subscribe, pendingUpdate, setPendingUpdate }}>
      {children}
    </RequestsEventsContext.Provider>
  );
}

export function useRequestsEvents(): RequestsEventsContextType {
  const ctx = useContext(RequestsEventsContext);
  if (ctx === undefined) {
    throw new Error('useRequestsEvents must be used within RequestsEventsProvider');
  }
  return ctx;
}
