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

import { useState, useCallback } from 'react';
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

  // FIX M6: Use functional updater to avoid stale closure on isMuted/isCameraOff
  const toggleMute = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    setIsMuted((prev) => {
      const newMuted = !prev;
      try {
        const result = call.setLocalAudio?.(!newMuted);
        if (result && typeof result.catch === 'function') {
          result.catch((e: unknown) => { if (__DEV__) console.warn('[useDailyCall] setLocalAudio failed:', e); });
        }
      } catch (e) {
        if (__DEV__) console.warn('[useDailyCall] setLocalAudio error:', e);
      }
      return newMuted;
    });
  }, [callRef]);

  const toggleCamera = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    setIsCameraOff((prev) => {
      const newOff = !prev;
      try {
        const result = call.setLocalVideo?.(!newOff);
        if (result && typeof result.catch === 'function') {
          result.catch((e: unknown) => { if (__DEV__) console.warn('[useDailyCall] setLocalVideo failed:', e); });
        }
      } catch (e) {
        if (__DEV__) console.warn('[useDailyCall] setLocalVideo error:', e);
      }
      return newOff;
    });
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
