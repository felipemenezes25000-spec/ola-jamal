import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
// Import seguro: PushNotificationContext pode não estar montado (Expo Go, web)
function usePushNotificationSafe(): { lastNotificationAt: number } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('./PushNotificationContext');
    if (mod?.usePushNotification) return mod.usePushNotification();
  } catch { /* provider não disponível */ }
  return { lastNotificationAt: 0 };
}
import { getUnreadNotificationsCount, markAllNotificationsAsRead } from '../lib/api';

/** Intervalo de polling quando app está em primeiro plano (em ms). */
const POLL_INTERVAL_MS = 30_000;
/** Intervalo relaxado após várias consultas sem mudança. */
const POLL_INTERVAL_SLOW_MS = 60_000;
/** Número de polls sem mudança antes de mudar para intervalo lento. */
const UNCHANGED_THRESHOLD = 5;
/** Mínimo entre chamadas à API unread-count (evita spam em cascade). */
const MIN_INTERVAL_BETWEEN_CALLS_MS = 5_000;

interface NotificationContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
  /** Atualização otimista: zera badge imediatamente, chama API, rollback em erro. */
  markAllReadOptimistic: () => Promise<void>;
  /** Decrementa contador otimisticamente (ex.: ao marcar uma como lida). */
  decrementUnreadCount: () => void;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { lastNotificationAt } = usePushNotificationSafe();
  const [unreadCount, setUnreadCount] = useState(0);
  const appState = useRef(AppState.currentState);
  const unchangedPolls = useRef(0);
  const lastCount = useRef<number | null>(null);
  const lastCallAt = useRef<number>(0);
  const inFlight = useRef(false);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    const now = Date.now();
    if (inFlight.current) return;
    if (now - lastCallAt.current < MIN_INTERVAL_BETWEEN_CALLS_MS) return;
    inFlight.current = true;
    lastCallAt.current = now;
    try {
      const count = await getUnreadNotificationsCount();
      if (lastCount.current !== null && count === lastCount.current) {
        unchangedPolls.current += 1;
      } else {
        unchangedPolls.current = 0;
      }
      lastCount.current = count;
      setUnreadCount(count);
    } catch {
      setUnreadCount(0);
    } finally {
      inFlight.current = false;
    }
  }, [user?.id]);

  const markAllReadOptimistic = useCallback(async () => {
    setUnreadCount(0);
    lastCount.current = 0;
    try {
      await markAllNotificationsAsRead();
    } catch (e) {
      refreshUnreadCount();
      throw e;
    }
  }, [refreshUnreadCount]);

  const decrementUnreadCount = useCallback(() => {
    setUnreadCount((prev) => Math.max(0, prev - 1));
    lastCount.current = lastCount.current !== null ? Math.max(0, lastCount.current - 1) : null;
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    if (lastNotificationAt > 0) {
      refreshUnreadCount();
    }
  }, [lastNotificationAt, refreshUnreadCount]);

  // Polling quando app em primeiro plano - médico vê novas solicitações rapidamente
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active' && !cancelled) {
        refreshUnreadCount();
        appState.current = nextState;
      } else {
        appState.current = nextState;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    let timerId: ReturnType<typeof setTimeout>;
    const schedulePoll = () => {
      const delay = unchangedPolls.current >= UNCHANGED_THRESHOLD ? POLL_INTERVAL_SLOW_MS : POLL_INTERVAL_MS;
      timerId = setTimeout(() => {
        if (cancelled) return;
        if (appState.current === 'active') {
          refreshUnreadCount();
        }
        schedulePoll();
      }, delay);
    };
    schedulePoll();

    return () => {
      cancelled = true;
      subscription.remove();
      clearTimeout(timerId);
    };
  }, [user?.id, refreshUnreadCount]);

  const value = useMemo(
    () => ({ unreadCount, refreshUnreadCount, markAllReadOptimistic, decrementUnreadCount }),
    [unreadCount, refreshUnreadCount, markAllReadOptimistic, decrementUnreadCount]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  return context ?? {
    unreadCount: 0,
    refreshUnreadCount: async () => {},
    markAllReadOptimistic: async () => {},
    decrementUnreadCount: () => {},
  };
}
