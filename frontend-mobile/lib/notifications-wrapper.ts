/**
 * Wrapper para evitar carregar expo-notifications no Expo Go (SDK 53+ removeu push do Go).
 * Em Expo Go exporta stubs; em development build usa o módulo real.
 */
import Constants from 'expo-constants';

const isExpoGo = Constants.appOwnership === 'expo';

async function registerStub(): Promise<string | null> {
  return null;
}
async function unregisterStub(): Promise<void> {}

export let registerForPushNotifications: (userId: string) => Promise<string | null>;
export let unregisterPushToken: (userId: string, token: string) => Promise<void>;

if (isExpoGo) {
  registerForPushNotifications = registerStub;
  unregisterPushToken = unregisterStub;
} else {
  const notif = require('./notifications');
  registerForPushNotifications = notif.registerForPushNotifications;
  unregisterPushToken = notif.unregisterPushToken;
}
