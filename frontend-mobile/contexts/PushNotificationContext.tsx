import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useAuth } from './AuthContext';
import { registerPushToken, unregisterPushToken } from '../lib/api';

// Push foi removido do Expo Go no SDK 53 — não carregar o módulo no Expo Go para evitar erro
const isExpoGo = Constants.appOwnership === 'expo';
const Notifications = isExpoGo ? null : require('expo-notifications');

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

interface PushNotificationContextValue {
  lastNotificationAt: number;
}

const PushNotificationContext = createContext<PushNotificationContextValue | undefined>(undefined);

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const lastRegisteredToken = useRef<string | null>(null);
  const [lastNotificationAt, setLastNotificationAt] = useState(0);

  useEffect(() => {
    if (!Notifications) return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      setLastNotificationAt(Date.now());
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!Notifications) return; // Expo Go: push não disponível
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
  }, [user?.id]);

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
