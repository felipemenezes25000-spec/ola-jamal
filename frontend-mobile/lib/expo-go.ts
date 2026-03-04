/**
 * Detecção de Expo Go — usado para desabilitar features que exigem módulos nativos.
 * - Videoconferência (Daily.co/WebRTC): não disponível no Expo Go
 * - Push notifications: removidas do Expo Go no SDK 53+
 *
 * Usa ExecutionEnvironment (recomendado) com fallback para appOwnership (legado).
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';

export const isExpoGo =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
  Constants.appOwnership === 'expo';
