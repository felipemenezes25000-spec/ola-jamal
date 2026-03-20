/**
 * useDailyCall — Orchestrator for Daily.co video calls.
 *
 * Composes:
 * - useDailyJoin: call lifecycle (create, join, events, leave, cleanup)
 * - useQualityMonitor: network quality polling
 *
 * Adds: media control functions (toggleMute, toggleCamera, flipCamera).
 *
 * Re-exports all types from sub-hooks for backward compatibility.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useDailyJoin } from './useDailyJoin';
import { useQualityMonitor } from './useQualityMonitor';

// Re-export types so existing imports from useDailyCall still work
export type { CallState, ParticipantTrack } from './useDailyJoin';
export type { ConnectionQuality } from './useQualityMonitor';

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
  const { quality } = useQualityMonitor(callRef, callState === 'joined');

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
        return;
      }
      let r: unknown;
      try {
        r = setAudio.call(call, !nextMuted);
      } catch (e) {
        revertUi();
        if (__DEV__) console.warn('[useDailyCall] setLocalAudio error:', e);
        return;
      }
      if (r != null && typeof (r as PromiseLike<unknown>).then === 'function') {
        return Promise.resolve(r)
          .then(applyUi)
          .catch((e: unknown) => {
            revertUi();
            if (__DEV__) console.warn('[useDailyCall] setLocalAudio failed:', e);
          });
      }
    } catch (e) {
      revertUi();
      if (__DEV__) console.warn('[useDailyCall] setLocalAudio error:', e);
      return;
    }
    applyUi();
  }, [callRef]);

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
        return;
      }
      let r: unknown;
      try {
        r = setVideo.call(call, !nextOff);
      } catch (e) {
        revertUi();
        if (__DEV__) console.warn('[useDailyCall] setLocalVideo error:', e);
        return;
      }
      if (r != null && typeof (r as PromiseLike<unknown>).then === 'function') {
        return Promise.resolve(r)
          .then(applyUi)
          .catch((e: unknown) => {
            revertUi();
            if (__DEV__) console.warn('[useDailyCall] setLocalVideo failed:', e);
          });
      }
    } catch (e) {
      revertUi();
      if (__DEV__) console.warn('[useDailyCall] setLocalVideo error:', e);
      return;
    }
    applyUi();
  }, [callRef]);

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
    join,
    leave,
    toggleMute,
    toggleCamera,
    flipCamera,
    /** Ref para o DailyCall (para startTranscription, etc). */
    callRef,
  };
}
