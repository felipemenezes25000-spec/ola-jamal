import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from './AuthContext';
import { usePushNotification } from './PushNotificationContext';
import { getUnreadNotificationsCount } from '../lib/api';

/** Intervalo de polling quando app está em primeiro plano (em ms). */
const POLL_INTERVAL_MS = 30_000;

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

  const refreshUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await getUnreadNotificationsCount();
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
    const interval = setInterval(() => {
      if (appState.current === 'active') {
        refreshUnreadCount();
      }
    }, POLL_INTERVAL_MS);

    return () => {
      subscription.remove();
      clearInterval(interval);
    };
  }, [user?.id, refreshUnreadCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  return context ?? { unreadCount: 0, refreshUnreadCount: async () => {} };
}
