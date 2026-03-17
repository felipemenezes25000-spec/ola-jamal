import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
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

// FIX #4: Separar em dois contexts para evitar re-renders cascata.
// StableContext: isConnected + subscribe (muda raramente)
// VolatileContext: pendingUpdate (muda a cada evento SignalR)

interface StableContextType {
  isConnected: boolean;
  subscribe: (listener: RequestUpdatedListener) => () => void;
}

interface VolatileContextType {
  pendingUpdate: PendingRequestUpdate | null;
  setPendingUpdate: (update: PendingRequestUpdate | null) => void;
}

// Tipo unificado para backward-compat do hook useRequestsEvents
export interface RequestsEventsContextType extends StableContextType, VolatileContextType {}

const StableContext = createContext<StableContextType | undefined>(undefined);
const VolatileContext = createContext<VolatileContextType | undefined>(undefined);

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
    // FIX #32: Aumentado de 3 para 8 retries com backoff exponencial
    // Em redes 4G/3G brasileiras, quedas momentâneas são comuns
    const maxRetries = 8;
    // FIX M12: track retry timeout so cleanup can cancel it
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const RECONNECT_COOLDOWN_MS = 10_000;
    let lastReconnectAt = 0;

    const tryConnect = () => {
      if (cancelled) return;
      startRequestsEventsConnection().then((ok) => {
        if (!cancelled) setConnected(ok && isRequestsEventsConnected());
        if (!ok && !cancelled && retryCount < maxRetries) {
          retryCount++;
          // FIX #32: Backoff exponencial: 5s, 10s, 20s, 40s, 60s, 60s, 60s, 60s
          const delay = Math.min(5_000 * Math.pow(2, retryCount - 1), 60_000);
          retryTimer = setTimeout(tryConnect, delay);
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
      if (retryTimer) clearTimeout(retryTimer);
      stopRequestsEventsConnection();
    };
  }, [user]);

  const subscribe = useCallback((listener: RequestUpdatedListener) => {
    return subscribeRequestsEvents((payload: RequestUpdatedPayload) => {
      listener(payload);
    });
  }, []);

  // FIX #4: Stable value só muda quando isConnected ou subscribe mudam
  const stableValue = useMemo(
    () => ({ isConnected, subscribe }),
    [isConnected, subscribe],
  );

  // FIX #4: Volatile value muda a cada pendingUpdate — só afeta consumers que leem pendingUpdate
  const volatileValue = useMemo(
    () => ({ pendingUpdate, setPendingUpdate }),
    [pendingUpdate],
  );

  return (
    <StableContext.Provider value={stableValue}>
      <VolatileContext.Provider value={volatileValue}>
        {children}
      </VolatileContext.Provider>
    </StableContext.Provider>
  );
}

/**
 * Hook unificado para backward-compat. Retorna ambos os contexts.
 * Se performance for crítica, use useRequestsEventsStable() para evitar re-renders do pendingUpdate.
 */
export function useRequestsEvents(): RequestsEventsContextType {
  const stable = useContext(StableContext);
  const volatile = useContext(VolatileContext);
  if (stable === undefined || volatile === undefined) {
    throw new Error('useRequestsEvents must be used within RequestsEventsProvider');
  }
  return { ...stable, ...volatile };
}

/** Hook otimizado que NÃO re-renderiza quando pendingUpdate muda. */
export function useRequestsEventsStable(): StableContextType {
  const ctx = useContext(StableContext);
  if (ctx === undefined) {
    throw new Error('useRequestsEventsStable must be used within RequestsEventsProvider');
  }
  return ctx;
}
