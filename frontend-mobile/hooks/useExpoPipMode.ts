/**
 * PiP: usa o hook do expo-pip quando existir, com fallback estável.
 * Evita `ExpoPip?.useIsInPip?.()` na tela — padrão que pode variar entre renders e corromper a ordem dos hooks.
 */
import ExpoPip from 'expo-pip';

type PipState = { isInPipMode: boolean };

const readPipMode: () => PipState =
  typeof ExpoPip?.useIsInPip === 'function'
    ? (ExpoPip.useIsInPip as () => PipState)
    : () => ({ isInPipMode: false });

export function useExpoPipMode(): boolean {
  return readPipMode().isInPipMode;
}
