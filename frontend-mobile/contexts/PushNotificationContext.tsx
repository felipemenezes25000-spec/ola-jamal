import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform, Linking } from 'react-native';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuth } from './AuthContext';
import { registerPushToken, unregisterPushToken } from '../lib/api';
import { isExpoGo } from '../lib/expo-go';

// Push foi removido do Expo Go no SDK 53 — não carregar o módulo no Expo Go para evitar erro
// eslint-disable-next-line @typescript-eslint/no-require-imports -- conditional native module
const Notifications = isExpoGo ? null : require('expo-notifications');

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async (notification: any) => {
      // ── FILTRO POR ROLE ──
      // Se a notificação tem targetRole, só mostra se bater com o role ativo.
      // Isso evita que o médico receba heads-up de notificações de paciente e vice-versa.
      const data = notification?.request?.content?.data ?? {};
      const targetRole = data?.targetRole as string | undefined;

      // Importar user role dinâmicamente (evita circular dependency)
      let currentRole: string | null = null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const storedUser = await AsyncStorage.getItem('@renoveja:user');
        if (storedUser) {
          const parsed = JSON.parse(storedUser);
          currentRole = parsed?.role ?? null;
        }
      } catch {}

      // Se targetRole está definido e não bate com o role ativo, suprime completamente.
      // Evita que médico receba notificações de paciente (e vice-versa) quando o mesmo
      // dispositivo tem token registrado em ambas as contas.
      if (targetRole && currentRole && targetRole !== currentRole) {
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: false,
          shouldShowList: false,
        };
      }

      // Notificação relevante para o role ativo — mostrar com tudo
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      };
    },
  });
}

interface PushNotificationContextValue {
  lastNotificationAt: number;
}

const PushNotificationContext = createContext<PushNotificationContextValue | undefined>(undefined);

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const lastRegisteredToken = useRef<string | null>(null);
  const [lastNotificationAt, setLastNotificationAt] = useState(0);
  const userRef = useRef(user);
  const coldStartHandled = useRef(false);
  userRef.current = user;

  /**
   * Navega para a tela correta com base no deepLink da notificação.
   * 
   * PRIORIDADE:
   * 1. deepLink completo (renoveja://...) → Linking.openURL → resolve pelo expo-router
   * 2. requestId + targetRole → rota específica do role correto
   * 3. requestId + user.role (fallback legado)
   */
  const handleNotificationNavigation = useCallback(
    (data: Record<string, unknown>) => {
      const deepLink = data?.deepLink as string | undefined;
      const requestId = data?.requestId as string | undefined;
      const targetRole = data?.targetRole as string | undefined;

      // 1. Deep link completo → preferido (já contém a rota correta)
      if (typeof deepLink === 'string' && deepLink.startsWith('renoveja://')) {
        Linking.openURL(deepLink).catch(() => {});
        return;
      }

      // 2. Se temos requestId, navegar baseado em targetRole (não no role do user logado)
      if (requestId && typeof requestId === 'string') {
        const effectiveRole = targetRole || userRef.current?.role;
        const path = effectiveRole === 'doctor'
          ? `/doctor-request/${requestId}`
          : `/request-detail/${requestId}`;
        router.push(path as any);
      }
    },
    [router]
  );

  /** Trata notificação pendente do cold start (app foi aberto pelo tap na notificação). */
  useEffect(() => {
    if (!Notifications || !user?.role || coldStartHandled.current) return;
    coldStartHandled.current = true;
    Notifications.getLastNotificationResponseAsync()
      .then((response: any) => {
        if (!response) return;
        const data = response?.notification?.request?.content?.data ?? {};
        handleNotificationNavigation(data);
      })
      .catch(() => {});
  }, [user?.role, handleNotificationNavigation]);

  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      setLastNotificationAt(Date.now());
    });
    const responseSub = Notifications.addNotificationResponseReceivedListener((response: any) => {
      const data = response?.notification?.request?.content?.data ?? {};
      handleNotificationNavigation(data);
    });
    return () => {
      sub.remove();
      responseSub.remove();
    };
  }, [handleNotificationNavigation]);

  useEffect(() => {
    if (!Notifications) return; // Expo Go: push não disponível
    if (Platform.OS === 'web') return; // push token não suportado na web
    if (!user) {
      if (lastRegisteredToken.current) {
        unregisterPushToken(lastRegisteredToken.current).catch(() => {});
        lastRegisteredToken.current = null;
      }
      return;
    }

    let mounted = true;

    const registerToken = async () => {
      try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
        if (!projectId) {
          return; // Skip push registration; run "eas init" and add projectId to app.json
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: projectId as string,
        });
        const token = typeof tokenData?.data === 'string' ? tokenData.data : null;
        if (!token || !mounted) return;

        await registerPushToken(token, Platform.OS);
        lastRegisteredToken.current = token;
      } catch (error) {
        console.warn('Push token registration failed:', error);
      }
    };

    registerToken();

    return () => {
      mounted = false;
    };
  }, [user?.id, user]);

  return (
    <PushNotificationContext.Provider value={{ lastNotificationAt }}>
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotification() {
  const context = useContext(PushNotificationContext);
  return context ?? { lastNotificationAt: 0 };
}
