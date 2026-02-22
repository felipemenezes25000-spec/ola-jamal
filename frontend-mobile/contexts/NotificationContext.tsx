import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { usePushNotification } from './PushNotificationContext';
import { getUnreadNotificationsCount } from '../lib/api';

/** Intervalo de polling quando app está em primeiro plano (em ms). */
const POLL_INTERVAL_MS = 30_000;
/** Intervalo relaxado após várias consultas sem mudança. */
const POLL_INTERVAL_SLOW_MS = 60_000;
/** Número de polls sem mudança antes de mudar para intervalo lento. */
const UNCHANGED_THRESHOLD = 5;

interface NotificationContextValue {
  unreadCount: number;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { lastNotificationAt } = usePushNotification();
  const [unreadCount, setUnreadCount] = useState(0);
  const appState = useRef(AppState.currentState);
  const unchangedPolls = useRef(0);
  const lastCount = useRef<number | null>(null);

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
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
    }
  }, [user?.id]);

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

    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'active') {
        refreshUnreadCount();
        appState.current = nextState;
      } else {
        appState.current = nextState;
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    // Usa intervalo adaptativo: rápido enquanto há mudanças, lento quando estável
    let timerId: ReturnType<typeof setTimeout>;
    const schedulePoll = () => {
      const delay = unchangedPolls.current >= UNCHANGED_THRESHOLD ? POLL_INTERVAL_SLOW_MS : POLL_INTERVAL_MS;
      timerId = setTimeout(() => {
        if (appState.current === 'active') {
          refreshUnreadCount();
        }
        schedulePoll();
      }, delay);
    };
    schedulePoll();

    return () => {
      subscription.remove();
      clearTimeout(timerId);
    };
  }, [user?.id, refreshUnreadCount]);

  const value = useMemo(() => ({ unreadCount, refreshUnreadCount }), [unreadCount, refreshUnreadCount]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  return context ?? { unreadCount: 0, refreshUnreadCount: async () => {} };
}
