/**
 * useDailyCall — Orchestrator for Daily.co video calls.
 *
 * Composes:
 * - useDailyJoin: call lifecycle (create, join, events, leave, cleanup)
 * - useQualityMonitor: network quality polling
 *
 * Adds: media control functions (toggleMute, toggleCamera, flipCamera).
 * Adds: Sentry error capture for media control failures (Bug #1, #5).
 * Adds: Retry mechanism for audio mode failure (Bug #5).
 *
 * Re-exports all types from sub-hooks for backward compatibility.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { Alert } from 'react-native';
import { useDailyJoin } from './useDailyJoin';
import { useQualityMonitor } from './useQualityMonitor';
import { captureException as sentryCaptureException } from '@sentry/react-native';
import { addBreadcrumb as sentryAddBreadcrumb } from '@sentry/core';

// Re-export types so existing imports from useDailyCall still work
export type { CallState, ParticipantTrack } from './useDailyJoin';
export type { ConnectionQuality } from './useQualityMonitor';

/** Max retries for audio/video toggle failures (Bug #5) */
const MEDIA_TOGGLE_MAX_RETRIES = 2;
const MEDIA_TOGGLE_RETRY_DELAY_MS = 500;

interface UseDailyCallOptions {
  /** URL da sala Daily.co (ex: https://renove.daily.co/consult-xxx) */
  roomUrl: string;
  /** Meeting token gerado pelo backend */
  token: string;
  /** Se o usuário local é o médico. Médico permanece na sala quando paciente sai; só médico encerra. */
  isDoctor?: boolean;
  /** Callback quando o participante remoto entra */
  onRemoteJoined?: () => void;
  /** Callback quando a chamada é encerrada */
  onCallEnded?: (reason?: string) => void;
  /** Callback para erros */
  onError?: (message: string) => void;
}

export function useDailyCall({
  roomUrl,
  token,
  isDoctor = false,
  onRemoteJoined,
  onCallEnded,
  onError,
}: UseDailyCallOptions) {
  // --- Call lifecycle (join, events, leave) ---
  const {
    callRef,
    callState,
    localParticipant,
    remoteParticipant,
    errorMessage,
    isReconnecting,
    join,
    leave,
  } = useDailyJoin({
    roomUrl,
    token,
    isDoctor,
    onRemoteJoined,
    onCallEnded,
    onError,
  });

  // --- Network quality polling (auto-starts when joined) ---
  const { quality } = useQualityMonitor(callRef, callState === 'joined' || callState === 'reconnecting');

  // --- Media controls ---

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);

  /** Espelho do estado para toggle sem efeitos colaterais dentro do updater do setState (Strict Mode pode rodar o updater 2x e quebrar o Daily). */
  const isMutedRef = useRef(false);
  const isCameraOffRef = useRef(false);
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);
  useEffect(() => { isCameraOffRef.current = isCameraOff; }, [isCameraOff]);

  /**
   * Bug #5: Retry helper for audio/video toggle with exponential backoff.
   * Shows user feedback on final failure.
   */
  const retryMediaToggle = useCallback(async (
    action: () => unknown,
    actionName: string,
    maxRetries: number = MEDIA_TOGGLE_MAX_RETRIES,
  ): Promise<boolean> => {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const result = action();
        if (result != null && typeof (result as PromiseLike<unknown>).then === 'function') {
          await Promise.resolve(result);
        }
        return true;
      } catch (e) {
        if (__DEV__) console.warn(`[useDailyCall] ${actionName} attempt ${attempt + 1} failed:`, e);

        if (attempt === maxRetries) {
          // Final failure — capture in Sentry and show user feedback
          sentryCaptureException(e instanceof Error ? e : new Error(`${actionName} failed after ${maxRetries + 1} attempts`), {
            tags: { component: 'useDailyCall', action: actionName },
          });
          Alert.alert(
            'Erro no áudio/vídeo',
            `Não foi possível ${actionName === 'setLocalAudio' ? 'alterar o microfone' : 'alterar a câmera'}. Tente novamente em alguns segundos.`,
            [{ text: 'OK' }],
          );
          return false;
        }

        sentryAddBreadcrumb({
          category: 'video.media',
          message: `${actionName} retry ${attempt + 1}/${maxRetries}`,
          level: 'warning',
        });

        await new Promise(r => setTimeout(r, MEDIA_TOGGLE_RETRY_DELAY_MS * (attempt + 1)));
      }
    }
    return false;
  }, []);

  /**
   * Atualiza estado da UI depois que o Daily confirma (Promise), para não montar DailyMediaView
   * antes do track existir — evita TypeError em MediaStream/toURL em alguns Android.
   */
  const toggleMute = useCallback((): void | Promise<void> => {
    const call = callRef.current;
    if (!call) return;
    const prevMuted = isMutedRef.current;
    const nextMuted = !prevMuted;
    isMutedRef.current = nextMuted;
    const applyUi = () => setIsMuted(nextMuted);
    const revertUi = () => {
      isMutedRef.current = prevMuted;
      setIsMuted(prevMuted);
    };
    try {
      const setAudio = call.setLocalAudio;
      if (typeof setAudio !== 'function') {
        revertUi();
        if (__DEV__) console.warn('[useDailyCall] setLocalAudio não disponível');
        sentryAddBreadcrumb({
          category: 'video.media',
          message: 'setLocalAudio not available',
          level: 'warning',
        });
        return;
      }
      let r: unknown;
      try {
        r = setAudio.call(call, !nextMuted);
      } catch (_e) {
        // Bug #5: Retry on sync failure
        return retryMediaToggle(
          () => setAudio.call(call, !nextMuted),
          'setLocalAudio',
        ).then((success) => {
          if (success) applyUi();
          else revertUi();
        });
      }
      if (r != null && typeof (r as PromiseLike<unknown>).then === 'function') {
        return Promise.resolve(r)
          .then(applyUi)
          .catch((e: unknown) => {
            // Bug #5: Retry on async failure
            return retryMediaToggle(
              () => setAudio.call(call, !nextMuted),
              'setLocalAudio',
            ).then((success) => {
              if (success) applyUi();
              else revertUi();
            });
          });
      }
    } catch (e) {
      revertUi();
      sentryCaptureException(e instanceof Error ? e : new Error('setLocalAudio outer error'), {
        tags: { component: 'useDailyCall', action: 'toggleMute' },
      });
      if (__DEV__) console.warn('[useDailyCall] setLocalAudio error:', e);
      return;
    }
    applyUi();
  }, [callRef, retryMediaToggle]);

  const toggleCamera = useCallback((): void | Promise<void> => {
    const call = callRef.current;
    if (!call) return;
    const prevOff = isCameraOffRef.current;
    const nextOff = !prevOff;
    isCameraOffRef.current = nextOff;
    const applyUi = () => setIsCameraOff(nextOff);
    const revertUi = () => {
      isCameraOffRef.current = prevOff;
      setIsCameraOff(prevOff);
    };
    try {
      const setVideo = call.setLocalVideo;
      if (typeof setVideo !== 'function') {
        revertUi();
        if (__DEV__) console.warn('[useDailyCall] setLocalVideo não disponível');
        sentryAddBreadcrumb({
          category: 'video.media',
          message: 'setLocalVideo not available',
          level: 'warning',
        });
        return;
      }
      let r: unknown;
      try {
        r = setVideo.call(call, !nextOff);
      } catch (_e) {
        return retryMediaToggle(
          () => setVideo.call(call, !nextOff),
          'setLocalVideo',
        ).then((success) => {
          if (success) applyUi();
          else revertUi();
        });
      }
      if (r != null && typeof (r as PromiseLike<unknown>).then === 'function') {
        return Promise.resolve(r)
          .then(applyUi)
          .catch((e: unknown) => {
            return retryMediaToggle(
              () => setVideo.call(call, !nextOff),
              'setLocalVideo',
            ).then((success) => {
              if (success) applyUi();
              else revertUi();
            });
          });
      }
    } catch (e) {
      revertUi();
      sentryCaptureException(e instanceof Error ? e : new Error('setLocalVideo outer error'), {
        tags: { component: 'useDailyCall', action: 'toggleCamera' },
      });
      if (__DEV__) console.warn('[useDailyCall] setLocalVideo error:', e);
      return;
    }
    applyUi();
  }, [callRef, retryMediaToggle]);

  // FIX #16: Só atualiza isFrontCamera APÓS cycleCamera() ser bem-sucedido.
  // Anteriormente, o estado era invertido antes do await, e o catch silenciava a falha,
  // deixando UI e câmera real dessincronizados.
  const flipCamera = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;

    try {
      if (typeof call.cycleCamera !== 'function') {
        if (__DEV__) console.warn('[useDailyCall] cycleCamera não disponível');
        return;
      }
      await call.cycleCamera();
      setIsFrontCamera((prev) => !prev);
    } catch (e) {
      sentryCaptureException(e instanceof Error ? e : new Error('cycleCamera failed'), {
        tags: { component: 'useDailyCall', action: 'flipCamera' },
      });
      if (__DEV__) console.warn('[useDailyCall] cycleCamera falhou:', e);
    }
  }, [callRef]);

  return {
    callState,
    localParticipant,
    remoteParticipant,
    isMuted,
    isCameraOff,
    isFrontCamera,
    quality,
    errorMessage,
    /** True when reconnecting after network change */
    isReconnecting,
    join,
    leave,
    toggleMute,
    toggleCamera,
    flipCamera,
    /** Ref para o DailyCall (para startTranscription, etc). */
    callRef,
  };
}
