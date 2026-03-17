/**
 * useWebPush — Hook para Web Push Notifications.
 *
 * Gerencia:
 * - Detecção de suporte (Notification API + PushManager)
 * - Pedido de permissão
 * - Subscription via Service Worker
 * - Registro/remoção do push token no backend
 *
 * O sw.js já tem handlers de push e notificationclick prontos.
 * VAPID key via VITE_VAPID_PUBLIC_KEY.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { registerPushToken, unregisterPushToken } from '@/services/doctorApi';

const VAPID_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushPermission = NotificationPermission | 'unsupported';

interface UseWebPushReturn {
  supported: boolean;
  permission: PushPermission;
  requestPermission: () => Promise<boolean>;
  unsubscribe: () => Promise<void>;
}

function detectSupport(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    !!VAPID_KEY
  );
}

function detectPermission(): PushPermission {
  if (!detectSupport()) return 'unsupported';
  return Notification.permission;
}

export function useWebPush(enabled: boolean): UseWebPushReturn {
  const [permission, setPermission] = useState<PushPermission>(detectPermission);
  const [supported] = useState(detectSupport);
  const subscriptionRef = useRef<PushSubscription | null>(null);

  const subscribeAndRegister = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_KEY!),
        });
      }

      subscriptionRef.current = subscription;
      const token = JSON.stringify(subscription.toJSON());
      await registerPushToken(token);
    } catch (err) {
      if (import.meta.env.DEV) console.warn('[WebPush] Subscription failed:', err);
    }
  }, []);

  // Auto-subscribe if permission already granted and enabled
  useEffect(() => {
    if (!enabled || !supported || Notification.permission !== 'granted') return;
    subscribeAndRegister();
  }, [enabled, supported, subscribeAndRegister]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!supported) return false;

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      await subscribeAndRegister();
      return true;
    }
    return false;
  }, [supported, subscribeAndRegister]);

  const unsubscribe = useCallback(async () => {
    try {
      const sub = subscriptionRef.current;
      if (sub) {
        const token = JSON.stringify(sub.toJSON());
        await unregisterPushToken(token);
        await sub.unsubscribe();
        subscriptionRef.current = null;
      }
    } catch {
      // silent
    }
  }, []);

  return { supported, permission, requestPermission, unsubscribe };
}
