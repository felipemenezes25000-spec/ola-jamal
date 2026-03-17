import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken as unregisterPushTokenApi } from './api';
import { colors } from './theme';

// Configure notification behavior — role filtering is handled in PushNotificationContext
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotifications(
  userId: string
): Promise<string | null> {
  try {
    // Check if device is physical
    if (!Device.isDevice) {
      console.warn('Push notifications only work on physical devices');
      return null;
    }

    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permissions if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Permission not granted for push notifications');
      return null;
    }

    // Get the Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: 'beb0f102-cc22-45a9-80a6-7e735968e6d2',
    });

    const token = tokenData.data;

    // Save token to database via API
    try {
      await registerPushToken(token, Platform.OS);
    } catch (error) {
      console.error('Error saving push token:', error);
    }

    // ── Android Notification Channels ──
    // Canais separados permitem que o usuário configure granularmente no sistema Android.
    if (Platform.OS === 'android') {
      // Canal principal: documentos prontos, consultas prontas
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Importantes',
        description: 'Documentos prontos, consultas prontas',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: colors.info,
        enableLights: true,
        enableVibrate: true,
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });

      // Canal silencioso: atualizações de status, lembretes
      await Notifications.setNotificationChannelAsync('quiet', {
        name: 'Informativos',
        description: 'Atualizações de status, lembretes',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100],
        enableLights: false,
        enableVibrate: true,
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      // Canal de consulta: alta prioridade para médico pronto, consulta iniciando
      await Notifications.setNotificationChannelAsync('consultation', {
        name: 'Consultas',
        description: 'Médico pronto, consulta iniciando, chamada de vídeo',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
        lightColor: '#10B981',
        enableLights: true,
        enableVibrate: true,
        sound: 'default',
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        bypassDnd: false,
      });
    }

    return token;
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return null;
  }
}

export async function unregisterPushToken(userId: string, token: string): Promise<void> {
  try {
    await unregisterPushTokenApi(token);
  } catch (error) {
    console.error('Error unregistering push token:', error);
  }
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseReceivedListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}
