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
 * - Sentry breadcrumbs & error capture for all video events
 * - 30s timeout on call.join()
 * - Automatic reconnect on network change (WiFi→4G)
 * - Proper event listener cleanup on unmount
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
import { captureException as sentryCaptureException } from '@sentry/react-native';
import { addBreadcrumb as sentryAddBreadcrumb } from '@sentry/core';

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
interface DailyNetworkEvent {
  type?: string;
  event?: string;
  threshold?: string;
  quality?: number;
}

export type CallState =
  | 'idle'
  | 'joining'
  | 'joined'
  | 'leaving'
  | 'reconnecting'
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
  /** True when reconnecting after network change */
  isReconnecting: boolean;
  join: () => Promise<void>;
  leave: () => Promise<void>;
}

// ── Module-level singleton guard ──
// Prevents "Duplicate DailyIframe instances are not allowed" when the previous
// screen's async destroy() hasn't finished before the next screen calls createCallObject().
let globalCallInstance: DailyCall | null = null;
let destroyPromise: Promise<void> | null = null;

/**
 * Enquanto leave()+destroy() rodam por ação do app, o Daily dispara `left-meeting` no meio do await.
 * Se onCallEnded navegar/desmontar antes do destroy(), o cleanup de unmount pode chamar leave() de novo
 * no mesmo objeto → erros nativos / mensagens tipo DailyIframe/DailyFrame.
 */
let programmaticLeaveInProgress = false;

/** Serializes join/leave so two concurrent join() calls cannot both pass ensurePreviousDestroyed
 *  before createCallObject() (React Strict Mode / double effect / rapid re-entry). */
let dailyOpChain: Promise<void> = Promise.resolve();

function runDailyOpExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = dailyOpChain.then(() => fn());
  dailyOpChain = run.then(() => {}).catch(() => {});
  return run;
}

/** Small delay to let Daily's native singleton registry clear after destroy(). */
const POST_DESTROY_DELAY_MS = 300;

/** Timeout for call.join() — prevents indefinite hang */
const JOIN_TIMEOUT_MS = 30_000;

async function ensurePreviousDestroyed(): Promise<void> {
  if (destroyPromise) {
    await destroyPromise;
  }
  if (globalCallInstance) {
    programmaticLeaveInProgress = true;
    destroyPromise = globalCallInstance
      .leave()
      .then(() => globalCallInstance?.destroy())
      .catch(() => {})
      .finally(() => {
        programmaticLeaveInProgress = false;
        globalCallInstance = null;
        destroyPromise = null;
      });
    await destroyPromise;
    // Daily's native bridge needs time to release the singleton after JS destroy() resolves.
    await new Promise(r => setTimeout(r, POST_DESTROY_DELAY_MS));
  }
}

/** Creates a timeout promise that rejects after `ms` milliseconds. Returns a cancel function. */
function createJoinTimeout(ms: number): { promise: Promise<never>; clear: () => void } {
  let id: ReturnType<typeof setTimeout> | undefined;
  const promise = new Promise<never>((_, reject) => {
    id = setTimeout(
      () => reject(new Error('Tempo limite para entrar na sala excedido. Verifique sua internet e tente novamente.')),
      ms,
    );
  });
  return {
    promise,
    clear: () => {
      if (id !== undefined) {
        clearTimeout(id);
        id = undefined;
      }
    },
  };
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
  const [isReconnecting, setIsReconnecting] = useState(false);

  // FIX M9: Store callbacks in refs to avoid stale closures in Daily event handlers
  const onRemoteJoinedRef = useRef(onRemoteJoined);
  onRemoteJoinedRef.current = onRemoteJoined;
  const onCallEndedRef = useRef(onCallEnded);
  onCallEndedRef.current = onCallEnded;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const isDoctorRef = useRef(isDoctor);
  isDoctorRef.current = isDoctor;

  // Track registered event handlers for proper cleanup (Bug #7)
  const registeredHandlersRef = useRef<{ event: string; handler: (evt?: any) => void }[]>([]);

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

  /** Register an event handler and track it for cleanup (Bug #7) */
  const registerHandler = useCallback((call: DailyCall, event: string, handler: (evt?: any) => void) => {
    call.on(event as DailyEvent, handler);
    registeredHandlersRef.current.push({ event, handler });
  }, []);

  /** Remove all registered event handlers from a call object (Bug #7) */
  const removeAllHandlers = useCallback((call: DailyCall) => {
    for (const { event, handler } of registeredHandlersRef.current) {
      try {
        call.off(event as DailyEvent, handler);
      } catch {
        // swallow — call may already be destroyed
      }
    }
    registeredHandlersRef.current = [];
  }, []);

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
        setIsReconnecting(false);

        sentryAddBreadcrumb({
          category: 'video.call',
          message: 'Joining Daily.co call',
          level: 'info',
          data: { roomUrl },
        });

        // Wait for any previous Daily instance to be fully destroyed
        await ensurePreviousDestroyed();

        if (callRef.current) return;

        // Retry createCallObject — Daily's native singleton may not be released
        // immediately after destroy(). Two retries with exponential back-off.
        let call: DailyCall | null = null;
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            call = Daily.createCallObject({
              audioSource: true,
              videoSource: true,
            });
            break; // success
          } catch (createErr: unknown) {
            const msg = createErr instanceof Error ? createErr.message : '';
            if (msg.includes('Duplicate') && attempt < 2) {
              if (__DEV__) console.warn(`[useDailyJoin] createCallObject attempt ${attempt + 1} hit duplicate — retrying`);
              sentryAddBreadcrumb({
                category: 'video.call',
                message: `createCallObject duplicate — retry ${attempt + 1}`,
                level: 'warning',
              });
              await new Promise(r => setTimeout(r, (attempt + 1) * 300));
              continue;
            }
            throw createErr;
          }
        }
        if (!call) return; // should never happen, but guard for TS
        createdCall = call;
        callRef.current = call;
        globalCallInstance = call;

        // Android: inicia FGS/notificação ANTES do join — se o usuário minimizar durante a conexão, o SO já trata como chamada ativa (padrão Discord).
        setAndroidOngoingMeetingActive(true);

        // --- Event handlers (Bug #7: all tracked via registerHandler for proper cleanup) ---

        const onJoinedMeeting = () => {
          setCallState('joined');
          setIsReconnecting(false);
          updateParticipants();
          setAndroidOngoingMeetingActive(true);
          sentryAddBreadcrumb({
            category: 'video.call',
            message: 'Joined Daily.co meeting',
            level: 'info',
          });
        };
        registerHandler(call, 'joined-meeting', onJoinedMeeting);

        const onParticipantJoined = (event: DailyParticipantEvent) => {
          updateParticipants();
          if (event && !event.participant?.local) {
            onRemoteJoinedRef.current?.();
            sentryAddBreadcrumb({
              category: 'video.call',
              message: 'Remote participant joined',
              level: 'info',
              data: { participantId: event.participant?.session_id },
            });
          }
        };
        registerHandler(call, 'participant-joined', onParticipantJoined);

        const onParticipantUpdated = () => {
          updateParticipants();
        };
        registerHandler(call, 'participant-updated', onParticipantUpdated);

        // Bug #3: track-started/track-stopped for proper track state transitions
        const onTrackStarted = () => {
          updateParticipants();
          sentryAddBreadcrumb({
            category: 'video.track',
            message: 'Track started',
            level: 'info',
          });
        };
        registerHandler(call, 'track-started', onTrackStarted);

        const onTrackStopped = () => {
          updateParticipants();
          sentryAddBreadcrumb({
            category: 'video.track',
            message: 'Track stopped',
            level: 'info',
          });
        };
        registerHandler(call, 'track-stopped', onTrackStopped);

        const onParticipantLeft = (event: DailyParticipantEvent) => {
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

          sentryAddBreadcrumb({
            category: 'video.call',
            message: 'Participant left',
            level: 'info',
            data: {
              isLocal: participant?.session_id === localSessionId,
              reason: event?.reason,
            },
          });

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
        };
        registerHandler(call, 'participant-left', onParticipantLeft);

        const onMeetingEnded = (event: DailyMeetingEndedEvent) => {
          if (__DEV__) {
            console.warn('[useDailyJoin] meeting-ended', { isDoctor, event });
          }
          sentryAddBreadcrumb({
            category: 'video.call',
            message: 'Meeting ended',
            level: 'info',
          });
          setCallState('idle');
          onCallEndedRef.current?.('meeting-ended');
        };
        registerHandler(call, 'meeting-ended', onMeetingEnded);

        const onLeftMeeting = () => {
          sentryAddBreadcrumb({
            category: 'video.call',
            message: 'Left meeting',
            level: 'info',
            data: { programmatic: programmaticLeaveInProgress },
          });
          setCallState('idle');
          if (!programmaticLeaveInProgress) {
            onCallEndedRef.current?.('left');
          }
        };
        registerHandler(call, 'left-meeting', onLeftMeeting);

        const onError = (event: DailyErrorEvent) => {
          const msg = event?.error?.msg ?? event?.errorMsg ?? 'Erro na chamada de vídeo';
          sentryCaptureException(new Error(`Daily.co error: ${msg}`), {
            tags: { component: 'useDailyJoin' },
            extra: { event },
          });
          sentryAddBreadcrumb({
            category: 'video.call',
            message: `Daily error: ${msg}`,
            level: 'error',
          });
          setCallState('error');
          setErrorMessage(msg);
          onErrorRef.current?.(msg);
        };
        registerHandler(call, 'error', onError);

        // Bug #4: Network change detection and automatic reconnect
        const onNetworkConnection = (event: DailyNetworkEvent) => {
          sentryAddBreadcrumb({
            category: 'video.network',
            message: `Network connection event: ${event?.type ?? event?.event ?? 'unknown'}`,
            level: 'warning',
            data: event,
          });
          if (__DEV__) console.warn('[useDailyJoin] network-connection', event);

          const eventType = event?.type ?? event?.event ?? '';
          if (eventType === 'interrupted' || eventType === 'change') {
            setIsReconnecting(true);
            setCallState('reconnecting');
          }
          if (eventType === 'connected') {
            setIsReconnecting(false);
            setCallState('joined');
          }
        };
        registerHandler(call, 'network-connection', onNetworkConnection);

        const onNetworkQualityChange = (event: DailyNetworkEvent) => {
          const threshold = event?.threshold;
          if (threshold === 'very-low') {
            sentryAddBreadcrumb({
              category: 'video.network',
              message: 'Network quality very low',
              level: 'warning',
              data: event,
            });
            setIsReconnecting(true);
            setCallState('reconnecting');
          } else if (threshold === 'low') {
            // Low but not very-low — show warning but don't set reconnecting
            sentryAddBreadcrumb({
              category: 'video.network',
              message: 'Network quality low',
              level: 'warning',
              data: event,
            });
          } else if (threshold === 'good' && isReconnecting) {
            setIsReconnecting(false);
            setCallState('joined');
          }
        };
        registerHandler(call, 'network-quality-change', onNetworkQualityChange);

        // --- Join the call with timeout (Bug #2) ---
        const joinTimeout = createJoinTimeout(JOIN_TIMEOUT_MS);
        try {
          await Promise.race([
            call.join({ url: roomUrl, token }),
            joinTimeout.promise,
          ]);
        } catch (joinErr) {
          joinTimeout.clear();
          throw joinErr;
        }
        joinTimeout.clear();
      });
    } catch (err: unknown) {
      // FIX NM-7: Clean up event handlers and destroy call object on join failure
      const callToCleanup = createdCall as DailyCall | null;
      if (callToCleanup) {
        try {
          removeAllHandlers(callToCleanup);
          await callToCleanup.destroy();
        } catch {
          // swallow — best-effort cleanup
        }
        callRef.current = null;
        globalCallInstance = null;
      }
      const msg = err instanceof Error ? err.message : 'Não foi possível entrar na sala';

      // Bug #1: Capture exception in Sentry
      sentryCaptureException(err instanceof Error ? err : new Error(msg), {
        tags: { component: 'useDailyJoin', action: 'join' },
        extra: { roomUrl },
      });

      setCallState('error');
      setErrorMessage(msg);
      setIsReconnecting(false);
      onErrorRef.current?.(msg);
    }
  // FIX M9: removed callback deps — refs are used inside, so join() is stable
  // eslint-disable-next-line react-hooks/exhaustive-deps -- isDoctor/callbacks accessed via refs
  }, [roomUrl, token, updateParticipants, registerHandler, removeAllHandlers, isReconnecting]);

  // --- Leave ---

  const leave = useCallback(async () => {
    const call = callRef.current;
    if (!call) return;

    await runDailyOpExclusive(async () => {
      programmaticLeaveInProgress = true;
      try {
        setCallState('leaving');
        setAndroidOngoingMeetingActive(false);

        sentryAddBreadcrumb({
          category: 'video.call',
          message: 'Leaving Daily.co call',
          level: 'info',
        });

        // Bug #7: Remove all tracked handlers instead of manual .off() calls
        removeAllHandlers(call);

        await call.leave();
        await call.destroy();
      } catch {
        // swallow — already left
      } finally {
        programmaticLeaveInProgress = false;
        if (callRef.current === call) {
          callRef.current = null;
        }
        globalCallInstance = null;
        setCallState('idle');
        setIsReconnecting(false);
        setLocalParticipant(null);
        setRemoteParticipant(null);
      }
    });
  }, [removeAllHandlers]);

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

  // --- Cleanup on unmount (Bug #7: ensures all listeners are removed) ---
  useEffect(() => {
    return () => {
      const call = callRef.current;
      if (call) {
        // Bug #7: Remove all tracked event handlers
        removeAllHandlers(call);

        callRef.current = null;
        programmaticLeaveInProgress = true;
        // Track the async destroy so the next mount can await it.
        // Includes post-destroy delay so the next createCallObject() doesn't race.
        destroyPromise = call
          .leave()
          .then(() => call.destroy())
          .then(() => new Promise<void>(r => setTimeout(r, POST_DESTROY_DELAY_MS)))
          .catch(() => {})
          .finally(() => {
            programmaticLeaveInProgress = false;
            globalCallInstance = null;
            destroyPromise = null;
          });
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    callRef,
    callState,
    localParticipant,
    remoteParticipant,
    errorMessage,
    isReconnecting,
    join,
    leave,
  };
}
