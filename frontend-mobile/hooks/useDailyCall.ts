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
      call.setLocalAudio(!newMuted).catch((e) => { if (__DEV__) console.warn('[useDailyCall] setLocalAudio failed:', e); });
      return newMuted;
    });
  }, [callRef]);

  const toggleCamera = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    setIsCameraOff((prev) => {
      const newOff = !prev;
      call.setLocalVideo(!newOff).catch((e) => { if (__DEV__) console.warn('[useDailyCall] setLocalVideo failed:', e); });
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
      await call.cycleCamera();
      // Sucesso: agora sim inverte o estado
      setIsFrontCamera((prev) => !prev);
    } catch (e) {
      // Dispositivo não suporta cycleCamera — não inverte o estado
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
