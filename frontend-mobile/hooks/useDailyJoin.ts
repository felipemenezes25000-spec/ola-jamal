/**
 * useDailyJoin — Daily.co call lifecycle: create, join, event handling, leave.
 *
 * Manages:
 * - DailyCall object creation and ref
 * - Call state machine (idle → joining → joined → leaving → idle)
 * - Event handlers (participant-joined/left, meeting-ended, error)
 * - Participant tracking (local + remote)
 * - Android foreground service notification
 * - Cleanup on unmount
 *
 * Does NOT handle: media controls (mute/camera/flip) or network quality monitoring.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Platform, NativeModules } from 'react-native';
import Daily, {
  DailyCall,
  DailyEvent,
  DailyParticipant,
  DailyTrackState,
} from '@daily-co/react-native-daily-js';

// Tipos locais para eventos do Daily.co cujos tipos do pacote estão incompletos
interface DailyParticipantEvent {
  participant?: DailyParticipant & { session_id?: string };
  action?: string;
  reason?: string;
}
interface DailyMeetingEndedEvent {
  action?: string;
}
interface DailyErrorEvent {
  error?: { msg?: string };
  errorMsg?: string;
  action?: string;
}

export type CallState =
  | 'idle'
  | 'joining'
  | 'joined'
  | 'leaving'
  | 'error';

export interface ParticipantTrack {
  participantId: string;
  userName: string;
  isLocal: boolean;
  videoTrack: DailyTrackState | null;
  audioTrack: DailyTrackState | null;
  video: boolean;
  audio: boolean;
}

interface UseDailyJoinOptions {
  /** URL da sala Daily.co (ex: https://renove.daily.co/consult-xxx) */
  roomUrl: string;
  /** Meeting token gerado pelo backend */
  token: string;
  /** Se o usuário local é o médico. Médico permanece na sala quando paciente sai. */
  isDoctor?: boolean;
  /** Callback quando o participante remoto entra */
  onRemoteJoined?: () => void;
  /** Callback quando a chamada é encerrada */
  onCallEnded?: (reason?: string) => void;
  /** Callback para erros */
  onError?: (message: string) => void;
}

export interface UseDailyJoinReturn {
  callRef: React.MutableRefObject<DailyCall | null>;
  callState: CallState;
  localParticipant: ParticipantTrack | null;
  remoteParticipant: ParticipantTrack | null;
  errorMessage: string | null;
  join: () => Promise<void>;
  leave: () => Promise<void>;
}

export function useDailyJoin({
  roomUrl,
  token,
  isDoctor = false,
  onRemoteJoined,
  onCallEnded,
  onError,
}: UseDailyJoinOptions): UseDailyJoinReturn {
  const callRef = useRef<DailyCall | null>(null);
  const [callState, setCallState] = useState<CallState>('idle');
  const [localParticipant, setLocalParticipant] = useState<ParticipantTrack | null>(null);
  const [remoteParticipant, setRemoteParticipant] = useState<ParticipantTrack | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        // Foreground service mantém câmera/microfone ativos em PiP (Android)
        if (Platform.OS === 'android') {
          const DailyNativeUtils = NativeModules.DailyNativeUtils;
          if (DailyNativeUtils?.setShowOngoingMeetingNotification) {
            DailyNativeUtils.setShowOngoingMeetingNotification(
              true,
              'Consulta em andamento',
              'Toque para expandir',
              'ic_daily_videocam_24dp',
              'renoveja-call'
            );
          }
        }
      });

      call.on('participant-joined' as DailyEvent, (event: DailyParticipantEvent) => {
        updateParticipants();
        if (event && !event.participant?.local) {
          onRemoteJoined?.();
        }
      });

      call.on('participant-updated' as DailyEvent, () => {
        updateParticipants();
      });

      call.on('participant-left' as DailyEvent, (event: DailyParticipantEvent) => {
        const participant = event?.participant;
        const localSessionId = call.participants()?.local?.session_id;

        if (__DEV__) {
          console.warn('[useDailyJoin] participant-left', {
            participantLocal: participant?.local,
            participantSessionId: participant?.session_id,
            localSessionId,
            isDoctor,
            reason: event?.reason,
          });
        }

        const isLocalParticipant =
          participant?.session_id != null &&
          localSessionId != null &&
          participant.session_id === localSessionId;
        const remoteLeft = participant && !isLocalParticipant;
        const localEjected = isLocalParticipant;

        if (remoteLeft) {
          setRemoteParticipant(null);
          if (!isDoctor) {
            if (__DEV__) console.warn('[useDailyJoin] onCallEnded(remote-left)');
            onCallEnded?.('remote-left');
          }
        }
        if (localEjected) {
          if (__DEV__) console.warn('[useDailyJoin] onCallEnded(ejected)');
          onCallEnded?.('ejected');
        }
      });

      call.on('meeting-ended' as DailyEvent, (event: DailyMeetingEndedEvent) => {
        if (__DEV__) {
          console.warn('[useDailyJoin] meeting-ended', { isDoctor, event });
        }
        setCallState('idle');
        onCallEnded?.('meeting-ended');
      });

      call.on('left-meeting' as DailyEvent, () => {
        setCallState('idle');
        onCallEnded?.('left');
      });

      call.on('error' as DailyEvent, (event: DailyErrorEvent) => {
        const msg = event?.error?.msg ?? event?.errorMsg ?? 'Erro na chamada de vídeo';
        setCallState('error');
        setErrorMessage(msg);
        onError?.(msg);
      });

      // --- Join the call ---
      await call.join({ url: roomUrl, token });

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Não foi possível entrar na sala';
      setCallState('error');
      setErrorMessage(msg);
      onError?.(msg);
    }
  }, [roomUrl, token, isDoctor, updateParticipants, onRemoteJoined, onCallEnded, onError]);

  // --- Leave ---

  const leave = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;

    try {
      setCallState('leaving');
      if (Platform.OS === 'android') {
        const DailyNativeUtils = NativeModules.DailyNativeUtils;
        if (DailyNativeUtils?.setShowOngoingMeetingNotification) {
          DailyNativeUtils.setShowOngoingMeetingNotification(false, '', '', '', 'renoveja-call');
        }
      }
      call.off('joined-meeting' as DailyEvent);
      call.off('participant-joined' as DailyEvent);
      call.off('participant-updated' as DailyEvent);
      call.off('participant-left' as DailyEvent);
      call.off('meeting-ended' as DailyEvent);
      call.off('left-meeting' as DailyEvent);
      call.off('error' as DailyEvent);
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
  }, []);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      const call = callRef.current;
      if (call) {
        call.leave().catch(() => {});
        call.destroy().catch(() => {});
        callRef.current = null;
      }
    };
  }, []);

  return {
    callRef,
    callState,
    localParticipant,
    remoteParticipant,
    errorMessage,
    join,
    leave,
  };
}
