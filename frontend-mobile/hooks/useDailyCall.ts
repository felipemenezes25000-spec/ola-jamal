import { useState, useEffect, useRef, useCallback } from 'react';
import Daily, {
  DailyCall,
  DailyEvent,
  DailyParticipant,
  DailyEventObjectParticipant,
  DailyTrackState,
} from '@daily-co/react-native-daily-js';

export type CallState =
  | 'idle'
  | 'joining'
  | 'joined'
  | 'leaving'
  | 'error';

export type ConnectionQuality = 'good' | 'poor' | 'bad' | 'unknown';

export interface ParticipantTrack {
  participantId: string;
  userName: string;
  isLocal: boolean;
  videoTrack: DailyTrackState | null;
  audioTrack: DailyTrackState | null;
  video: boolean;
  audio: boolean;
}

interface UseDailyCallOptions {
  /** URL da sala Daily.co (ex: https://renove.daily.co/consult-xxx) */
  roomUrl: string;
  /** Meeting token gerado pelo backend */
  token: string;
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
  onRemoteJoined,
  onCallEnded,
  onError,
}: UseDailyCallOptions) {
  const callRef = useRef<DailyCall | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [localParticipant, setLocalParticipant] = useState<ParticipantTrack | null>(null);
  const [remoteParticipant, setRemoteParticipant] = useState<ParticipantTrack | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isFrontCamera, setIsFrontCamera] = useState(true);
  const [quality, setQuality] = useState<ConnectionQuality>('unknown');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const statsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Helpers ---

  const extractTrack = useCallback((p: DailyParticipant): ParticipantTrack => ({
    participantId: p.session_id,
    userName: p.user_name ?? 'Participante',
    isLocal: p.local,
    videoTrack: p.tracks?.video ?? null,
    audioTrack: p.tracks?.audio ?? null,
    video: p.tracks?.video?.state === 'playable',
    audio: p.tracks?.audio?.state === 'playable',
  }), []);

  const updateParticipants = useCallback(() => {
    const call = callRef.current;
    if (!call) return;

    const participants = call.participants();
    if (participants.local) {
      setLocalParticipant(extractTrack(participants.local));
    }

    const remoteIds = Object.keys(participants).filter(k => k !== 'local');
    if (remoteIds.length > 0) {
      setRemoteParticipant(extractTrack(participants[remoteIds[0]]));
    } else {
      setRemoteParticipant(null);
    }
  }, [extractTrack]);

  // --- Network quality monitoring ---

  const startQualityMonitor = useCallback(() => {
    if (statsIntervalRef.current) return;
    statsIntervalRef.current = setInterval(() => {
      const call = callRef.current;
      if (!call) return;

      const stats = call.getNetworkStats?.();
      if (stats && typeof stats === 'object' && 'threshold' in stats) {
        const threshold = (stats as { threshold: string }).threshold;
        if (threshold === 'good') setQuality('good');
        else if (threshold === 'low') setQuality('poor');
        else setQuality('bad');
      }
    }, 5000);
  }, []);

  const stopQualityMonitor = useCallback(() => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  }, []);

  // --- Join ---

  const join = useCallback(async () => {
    if (callRef.current) return;

    try {
      setCallState('joining');
      setErrorMessage(null);

      const call = Daily.createCallObject({
        audioSource: true,
        videoSource: true,
      });
      callRef.current = call;

      // --- Event handlers ---

      call.on('joined-meeting' as DailyEvent, () => {
        setCallState('joined');
        updateParticipants();
        startQualityMonitor();
      });

      call.on('participant-joined' as DailyEvent, (event: any) => {
        updateParticipants();
        if (event && !event.participant?.local) {
          onRemoteJoined?.();
        }
      });

      call.on('participant-updated' as DailyEvent, () => {
        updateParticipants();
      });

      call.on('participant-left' as DailyEvent, (event: any) => {
        if (event && !event.participant?.local) {
          setRemoteParticipant(null);
          onCallEnded?.('remote-left');
        }
        if (event?.participant?.local) {
          onCallEnded?.('ejected');
        }
      });

      call.on('left-meeting' as DailyEvent, () => {
        setCallState('idle');
        stopQualityMonitor();
        onCallEnded?.('left');
      });

      call.on('error' as DailyEvent, (event: any) => {
        const msg = event?.error?.msg ?? event?.errorMsg ?? 'Erro na chamada de vídeo';
        setCallState('error');
        setErrorMessage(msg);
        stopQualityMonitor();
        onError?.(msg);
      });

      // --- Join the call ---
      await call.join({ url: roomUrl, token });

    } catch (err: any) {
      const msg = err?.message ?? 'Não foi possível entrar na sala';
      setCallState('error');
      setErrorMessage(msg);
      onError?.(msg);
    }
  }, [roomUrl, token, updateParticipants, startQualityMonitor, stopQualityMonitor, onRemoteJoined, onCallEnded, onError]);

  // --- Leave ---

  const leave = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;

    try {
      setCallState('leaving');
      stopQualityMonitor();
      await call.leave();
      await call.destroy();
    } catch {
      // swallow — already left
    } finally {
      callRef.current = null;
      setCallState('idle');
      setLocalParticipant(null);
      setRemoteParticipant(null);
    }
  }, [stopQualityMonitor]);

  // --- Controls ---

  const toggleMute = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    const newMuted = !isMuted;
    await call.setLocalAudio(!newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  const toggleCamera = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;
    const newOff = !isCameraOff;
    await call.setLocalVideo(!newOff);
    setIsCameraOff(newOff);
  }, [isCameraOff]);

  const flipCamera = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;

    const newFront = !isFrontCamera;
    setIsFrontCamera(newFront);

    try {
      await call.cycleCamera();
    } catch {
      // Some devices don't support this
    }
  }, [isFrontCamera]);

  // --- Cleanup on unmount ---

  useEffect(() => {
    return () => {
      const call = callRef.current;
      if (call) {
        call.leave().catch(() => {});
        call.destroy().catch(() => {});
        callRef.current = null;
      }
      stopQualityMonitor();
    };
  }, [stopQualityMonitor]);

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
  };
}
