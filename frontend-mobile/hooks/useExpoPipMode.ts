/**
 * PiP: estado "em modo PiP" via expo-pip.
 * - Só Android expõe PiP nativo; no iOS/web usamos fallback estável (sem chamar useIsInPip),
 *   evitando crash / módulo nativo inesperado.
 * - usePipState é escolhido uma vez no carregamento do módulo (Platform fixo por bundle).
 * - SAFETY: try-catch na chamada do hook para evitar crash se o módulo nativo falhar.
 */
import { Platform } from 'react-native';
import ExpoPip from 'expo-pip';

type PipState = { isInPipMode: boolean };

const usePipState: () => PipState =
  Platform.OS === 'android' && typeof ExpoPip?.useIsInPip === 'function'
    ? (ExpoPip.useIsInPip.bind(ExpoPip) as () => PipState)
    : () => ({ isInPipMode: false });

export function useExpoPipMode(): boolean {
  try {
    return usePipState().isInPipMode;
  } catch (e) {
    if (__DEV__) console.warn('[useExpoPipMode] PiP state read failed:', e);
    return false;
  }
}
