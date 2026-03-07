import React, { useEffect, useCallback, useState } from 'react';
import { Platform, View, StyleSheet } from 'react-native';
import { Stack, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: 1,
    },
  },
});
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { isExpoGo } from '../lib/expo-go';
import { useFonts } from '@expo-google-fonts/plus-jakarta-sans';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { RequestsEventsProvider } from '../contexts/RequestsEventsContext';
import { TriageAssistantProvider } from '../contexts/TriageAssistantProvider';
import { GlobalRequestUpdatedToast } from '../components/GlobalRequestUpdatedToast';
import { RequestUpdateBanner } from '../components/RequestUpdateBanner';
import { OfflineBanner } from '../components/OfflineBanner';
import { GlobalAssistantBanner } from '../components/triage/GlobalAssistantBanner';
import { ToastProvider } from '../components/ui/Toast';
import { ModalVisibilityProvider } from '../contexts/ModalVisibilityContext';
import { ColorSchemeProvider, useColorSchemeContext } from '../contexts/ColorSchemeContext';
import * as SplashScreen from 'expo-splash-screen';
import { motionTokens } from '../lib/ui/motion';

// Push notifications foram removidas do Expo Go no SDK 53 - carregar provider só em development build
const PushNotificationProvider = isExpoGo
  ? ({ children }: { children: React.ReactNode }) => <>{children}</>
  : require('../contexts/PushNotificationContext').PushNotificationProvider;

SplashScreen.preventAutoHideAsync();

function DynamicStatusBar() {
  const { isDark } = useColorSchemeContext();
  return <StatusBar style={isDark ? 'light' : 'dark'} />;
}

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
    <QueryClientProvider client={queryClient}>
    <ColorSchemeProvider>
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={onLayoutRootView}>
      <DynamicStatusBar />
      <AuthProvider>
        <PushNotificationProvider>
          <NotificationProvider>
            <ModalVisibilityProvider>
            <RequestsEventsProvider>
            <GlobalRequestUpdatedToast />
            <TriageAssistantProvider>
            <ToastProvider>
              <OfflineBanner />
              <View style={styles.layoutContent}>
                <Stack screenOptions={motionTokens.nav.rootStack}>
                <Stack.Screen name="index" />
                <Stack.Screen name="onboarding" options={{ animation: 'fade', headerShown: false }} />
                <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                <Stack.Screen name="(patient)" options={{ animation: 'fade' }} />
                <Stack.Screen name="(doctor)" options={{ animation: 'fade' }} />
                <Stack.Screen name="new-request" options={motionTokens.nav.modal} />

                {/* Fluxos paciente: transição mais suave */}
                <Stack.Screen name="request-detail/[id]" options={motionTokens.nav.softPush} />
                <Stack.Screen name="consultation-summary/[requestId]" options={motionTokens.nav.softPush} />
                <Stack.Screen name="care-plans/[carePlanId]" options={motionTokens.nav.softPush} />
                <Stack.Screen name="payment/[id]" options={motionTokens.nav.softPush} />
                <Stack.Screen name="payment/request/[requestId]" options={motionTokens.nav.softPush} />
                <Stack.Screen name="payment/card" options={motionTokens.nav.softPush} />
                <Stack.Screen name="video/[requestId]" options={motionTokens.nav.softPush} />

                {/* Fluxos médico: transição mais direta */}
                <Stack.Screen name="doctor-request/[id]" options={motionTokens.nav.snappyPush} />
                <Stack.Screen name="doctor-request/editor/[id]" options={motionTokens.nav.snappyPush} />
                <Stack.Screen name="doctor-patient/[patientId]" options={motionTokens.nav.snappyPush} />
                <Stack.Screen name="doctor-patient-summary/[patientId]" options={motionTokens.nav.snappyPush} />
                <Stack.Screen name="certificate/upload" options={motionTokens.nav.snappyPush} />

                {/* Utilitários globais */}
                <Stack.Screen name="settings" options={motionTokens.nav.softPush} />
                <Stack.Screen name="change-password" options={motionTokens.nav.softPush} />
                <Stack.Screen name="privacy" options={motionTokens.nav.softPush} />
                <Stack.Screen name="terms" options={motionTokens.nav.softPush} />
                <Stack.Screen name="about" options={motionTokens.nav.softPush} />
                <Stack.Screen name="help-faq" options={motionTokens.nav.softPush} />
                </Stack>
                <RequestUpdateBanner />
                <GlobalAssistantBanner />
              </View>
            </ToastProvider>
            </TriageAssistantProvider>
            </RequestsEventsProvider>
            </ModalVisibilityProvider>
          </NotificationProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
    </ColorSchemeProvider>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  layoutContent: { flex: 1 },
});
