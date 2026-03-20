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
import { setAndroidOngoingMeetingActive } from '../lib/dailyAndroidForeground';
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

// ── Module-level singleton guard ──
// Prevents "Duplicate DailyIframe instances are not allowed" when the previous
// screen's async destroy() hasn't finished before the next screen calls createCallObject().
let globalCallInstance: DailyCall | null = null;
let destroyPromise: Promise<void> | null = null;

/** Serializes join/leave so two concurrent join() calls cannot both pass ensurePreviousDestroyed
 *  before createCallObject() (React Strict Mode / double effect / rapid re-entry). */
let dailyOpChain: Promise<void> = Promise.resolve();

function runDailyOpExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = dailyOpChain.then(() => fn());
  dailyOpChain = run.then(() => {}).catch(() => {});
  return run;
}

async function ensurePreviousDestroyed(): Promise<void> {
  if (destroyPromise) {
    await destroyPromise;
  }
  if (globalCallInstance) {
    destroyPromise = globalCallInstance
      .leave()
      .then(() => globalCallInstance?.destroy())
      .catch(() => {})
      .finally(() => {
        globalCallInstance = null;
        destroyPromise = null;
      });
    await destroyPromise;
  }
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

  // FIX M9: Store callbacks in refs to avoid stale closures in Daily event handlers
  const onRemoteJoinedRef = useRef(onRemoteJoined);
  onRemoteJoinedRef.current = onRemoteJoined;
  const onCallEndedRef = useRef(onCallEnded);
  onCallEndedRef.current = onCallEnded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const isDoctorRef = useRef(isDoctor);
  isDoctorRef.current = isDoctor;

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
    if (!call || typeof call.participants !== 'function') return;

    const participants = call.participants();
    if (!participants) return;

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

    /** Evita narrowing incorreto de callRef no catch (TS pensa que .current segue null após o guard do início). */
    let createdCall: DailyCall | null = null;

    try {
      await runDailyOpExclusive(async () => {
        if (callRef.current) return;

        setCallState('joining');
        setErrorMessage(null);

        // Wait for any previous Daily instance to be fully destroyed
        await ensurePreviousDestroyed();

        if (callRef.current) return;

        const call = Daily.createCallObject({
          audioSource: true,
          videoSource: true,
        });
        createdCall = call;
        callRef.current = call;
        globalCallInstance = call;

        // Android: inicia FGS/notificação ANTES do join — se o usuário minimizar durante a conexão, o SO já trata como chamada ativa (padrão Discord).
        setAndroidOngoingMeetingActive(true);

        // --- Event handlers ---

        call.on('joined-meeting' as DailyEvent, () => {
          setCallState('joined');
          updateParticipants();
          setAndroidOngoingMeetingActive(true);
        });

        call.on('participant-joined' as DailyEvent, (event: DailyParticipantEvent) => {
          updateParticipants();
          if (event && !event.participant?.local) {
            onRemoteJoinedRef.current?.();
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
              isDoctor: isDoctorRef.current,
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
            if (!isDoctorRef.current) {
              if (__DEV__) console.warn('[useDailyJoin] onCallEnded(remote-left)');
              onCallEndedRef.current?.('remote-left');
            }
          }
          if (localEjected) {
            if (__DEV__) console.warn('[useDailyJoin] onCallEnded(ejected)');
            onCallEndedRef.current?.('ejected');
          }
        });

        call.on('meeting-ended' as DailyEvent, (event: DailyMeetingEndedEvent) => {
          if (__DEV__) {
            console.warn('[useDailyJoin] meeting-ended', { isDoctor, event });
          }
          setCallState('idle');
          onCallEndedRef.current?.('meeting-ended');
        });

        call.on('left-meeting' as DailyEvent, () => {
          setCallState('idle');
          onCallEndedRef.current?.('left');
        });

        call.on('error' as DailyEvent, (event: DailyErrorEvent) => {
          const msg = event?.error?.msg ?? event?.errorMsg ?? 'Erro na chamada de vídeo';
          setCallState('error');
          setErrorMessage(msg);
          onErrorRef.current?.(msg);
        });

        // --- Join the call ---
        await call.join({ url: roomUrl, token });
      });
    } catch (err: unknown) {
      // FIX NM-7: Clean up event handlers and destroy call object on join failure
      // TS não liga atribuição dentro do callback async ao catch; falha costuma ser em call.join() após create.
      const callToCleanup = createdCall as DailyCall | null;
      if (callToCleanup) {
        try {
          callToCleanup.off('joined-meeting' as DailyEvent);
          callToCleanup.off('participant-joined' as DailyEvent);
          callToCleanup.off('participant-updated' as DailyEvent);
          callToCleanup.off('participant-left' as DailyEvent);
          callToCleanup.off('meeting-ended' as DailyEvent);
          callToCleanup.off('left-meeting' as DailyEvent);
          callToCleanup.off('error' as DailyEvent);
          await callToCleanup.destroy();
        } catch {
          // swallow — best-effort cleanup
        }
        callRef.current = null;
        globalCallInstance = null;
      }
      const msg = err instanceof Error ? err.message : 'Não foi possível entrar na sala';
      setCallState('error');
      setErrorMessage(msg);
      onErrorRef.current?.(msg);
    }
  // FIX M9: removed callback deps — refs are used inside, so join() is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps -- isDoctor/callbacks accessed via refs
  }, [roomUrl, token, updateParticipants]);

  // --- Leave ---

  const leave = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;

    await runDailyOpExclusive(async () => {
      try {
        setCallState('leaving');
        setAndroidOngoingMeetingActive(false);
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
        if (callRef.current === call) {
          callRef.current = null;
        }
        globalCallInstance = null;
        setCallState('idle');
        setLocalParticipant(null);
        setRemoteParticipant(null);
      }
    });
  }, []);

  /**
   * Ao trocar sala/token (outro request, retry, token renovado), encerrar a sessão anterior.
   * Sem isso, callState pode ficar "joined" e o auto-join não entra na sala nova.
   */
  const prevRoomTokenRef = useRef<{ roomUrl: string; token: string } | null>(null);
  useEffect(() => {
    const prev = prevRoomTokenRef.current;
    prevRoomTokenRef.current = { roomUrl, token };
    if (!prev) return;
    if (prev.roomUrl === roomUrl && prev.token === token) return;
    if (callRef.current) {
      void leave();
    }
  }, [roomUrl, token, leave]);

  // --- Cleanup on unmount ---
  useEffect(() => {
    return () => {
      const call = callRef.current;
      if (call) {
        callRef.current = null;
        // Track the async destroy so the next mount can await it
        destroyPromise = call
          .leave()
          .then(() => call.destroy())
          .catch(() => {})
          .finally(() => {
            globalCallInstance = null;
            destroyPromise = null;
          });
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
