import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '../contexts/AuthContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import * as SplashScreen from 'expo-splash-screen';

// Push notifications foram removidas do Expo Go no SDK 53 - carregar provider só em development build
const isExpoGo = Constants.appOwnership === 'expo';
const PushNotificationProvider = isExpoGo
  ? ({ children }: { children: React.ReactNode }) => <>{children}</>
  : require('../contexts/PushNotificationContext').PushNotificationProvider;

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    setTimeout(() => {
      SplashScreen.hideAsync();
    }, 1000);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <PushNotificationProvider>
        <NotificationProvider>
        <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(patient)" />
        <Stack.Screen name="(doctor)" />
        <Stack.Screen name="new-request" options={{ presentation: 'modal' }} />
        <Stack.Screen name="request-detail/[id]" />
        <Stack.Screen name="doctor-request/[id]" />
        <Stack.Screen name="doctor-request/editor/[id]" />
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
        </NotificationProvider>
        </PushNotificationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
