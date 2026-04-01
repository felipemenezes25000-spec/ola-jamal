/**
 * useAppPermissions — Solicita permissões de câmera, microfone e notificações
 * uma única vez após login. Persiste flag em AsyncStorage para não pedir novamente.
 *
 * Chamado nos layouts de paciente e médico.
 */

import { useEffect, useRef } from 'react';
import { Platform, PermissionsAndroid } from 'react-native';
import * as Notifications from 'expo-notifications';
import { Audio } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PERMISSIONS_ASKED_KEY = '@renoveja:permissions_asked';

function getAndroidApiLevel(): number {
  if (Platform.OS !== 'android') return 0;
  return typeof Platform.Version === 'number'
    ? Platform.Version
    : parseInt(String(Platform.Version), 10);
}

/**
 * Pede câmera + microfone + notificações uma única vez após o login.
 * Não bloqueia — roda em background e falhas são silenciosas.
 * A flag persiste via AsyncStorage para evitar pedir a cada abertura do app.
 */
export function useAppPermissions() {
  const asked = useRef(false);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;

    (async () => {
      try {
        const alreadyAsked = await AsyncStorage.getItem(PERMISSIONS_ASKED_KEY);
        if (alreadyAsked === 'true') return;

        if (Platform.OS === 'android') {
          // Microfone
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          );
          // Câmera
          await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
          );
          // Notificações (API 33+)
          if (getAndroidApiLevel() >= 33) {
            await Notifications.requestPermissionsAsync();
          }
          // Bluetooth (API 31+) — opcional, silencioso
          if (getAndroidApiLevel() >= 31) {
            try {
              await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
              );
            } catch {
              // ignorar — bluetooth é opcional
            }
          }
        } else if (Platform.OS === 'ios') {
          // Microfone
          await Audio.requestPermissionsAsync();
          // Câmera
          await ImagePicker.requestCameraPermissionsAsync();
          // Notificações
          await Notifications.requestPermissionsAsync();
        }

        await AsyncStorage.setItem(PERMISSIONS_ASKED_KEY, 'true');
      } catch {
        // Silencioso — permissões serão pedidas novamente na próxima sessão
      }
    })();
  }, []);
}
