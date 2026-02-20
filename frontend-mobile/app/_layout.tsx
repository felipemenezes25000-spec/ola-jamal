import "../global.css";
import React, { useEffect, useCallback, useState } from 'react';
import { Platform } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from '@expo-google-fonts/plus-jakarta-sans';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ToastProvider } from '../components/ui/Toast';
import * as SplashScreen from 'expo-splash-screen';

// Push notifications foram removidas do Expo Go no SDK 53 - carregar provider só em development build
const isExpoGo = Constants.appOwnership === 'expo';
const PushNotificationProvider = isExpoGo
  ? ({ children }: { children: React.ReactNode }) => <>{children}</>
  : require('../contexts/PushNotificationContext').PushNotificationProvider;

SplashScreen.preventAutoHideAsync();

// Mostra o app em no máximo 1s (fontes opcionais; evita tela branca no dispositivo)
const MAX_WAIT_MS = 1000;

export default function RootLayout() {
  const pathname = usePathname();
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setForceShow(true), MAX_WAIT_MS);
    return () => clearTimeout(t);
  }, []);

  // Web: ao trocar de tela, remove foco do elemento ativo para evitar aviso "Blocked aria-hidden"
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const el = document.activeElement as HTMLElement | null;
    if (el?.blur) el.blur();
  }, [pathname]);

  const canShowApp = forceShow || fontsLoaded || !!fontError;

  const onLayoutRootView = useCallback(async () => {
    if (canShowApp) {
      await SplashScreen.hideAsync();
    }
  }, [canShowApp]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!canShowApp) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <StatusBar style="auto" />
      <AuthProvider>
        <PushNotificationProvider>
          <NotificationProvider>
            <ToastProvider>
              <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(patient)" />
                <Stack.Screen name="(doctor)" />
                <Stack.Screen name="new-request" options={{ presentation: 'modal' }} />
                <Stack.Screen name="request-detail/[id]" />
                <Stack.Screen name="doctor-request/[id]" />
                <Stack.Screen name="doctor-request/editor/[id]" />
                <Stack.Screen name="doctor-patient/[patientId]" />
                <Stack.Screen name="payment/[id]" />
                <Stack.Screen name="payment/card" />
                <Stack.Screen name="certificate/upload" />
                <Stack.Screen name="video/[requestId]" />
                <Stack.Screen name="settings" />
                <Stack.Screen name="change-password" />
                <Stack.Screen name="privacy" />
                <Stack.Screen name="terms" />
                <Stack.Screen name="about" />
                <Stack.Screen name="help-faq" />
              </Stack>
            </ToastProvider>
          </NotificationProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
