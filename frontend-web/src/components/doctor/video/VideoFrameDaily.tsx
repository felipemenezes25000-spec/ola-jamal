/**
 * VideoFrameDaily — Daily.co prebuilt UI com lifecycle gerenciado manualmente.
 *
 * Usa DailyIframe.createFrame() em vez de useCallFrame para evitar:
 * - "duplicate dailyiframe" ao remontar o componente
 * - Vídeo/áudio não funcionar por falta de join
 * - Controles ausentes
 *
 * O prebuilt Daily UI já inclui: botão de entrar, câmera, mic, leave, fullscreen.
 * A transcrição é encaminhada ao backend via useWebTranscription (DailyProvider).
 *
 * Bug fixes:
 * - #1  Transcription waits for 'joined-meeting' + 150ms buffer before starting
 * - #2  'left-meeting' handler cleans up state and notifies parent
 * - #3  .destroy() called on unmount with proper cleanup
 * - #4  'network-connection' event → reconnecting UI + auto-reconnect
 * - #5  visibilitychange listener keeps transcription alive when tab hidden
 * - #7  'camera-error' / 'mic-error' handlers with user-friendly messages
 * - #8  'track-stopped' on screen-share tracks updates UI
 * - #9  30s connection timeout with error state + retry
 * - #10 Responsive CSS for small screens
 */

import DailyIframe, { type DailyCall } from '@daily-co/daily-js';
import { DailyProvider } from '@daily-co/daily-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { Maximize2, Minimize2, WifiOff, Loader2, AlertTriangle, RefreshCw, MonitorOff } from 'lucide-react';
import { useWebTranscription } from '@/hooks/useWebTranscription';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Serializa destroy/create — Daily.co só permite um iframe/prebuilt por aba (evita "Duplicate DailyIframe"). */
let dailyWebOpChain: Promise<void> = Promise.resolve();
/** Instância global na aba (ref do componente zera ao desmontar; o SDK pode manter iframe até destroy concluir). */
let activeWebDailyCall: DailyCall | null = null;

function runDailyWebExclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = dailyWebOpChain.then(() => fn());
  dailyWebOpChain = run.then(() => {}).catch(() => {});
  return run;
}

async function destroyDailyCallSafe(call: DailyCall | null): Promise<void> {
  if (!call) return;
  try {
    const r = call.destroy() as void | Promise<void>;
    if (r && typeof (r as Promise<void>).then === 'function') {
      await r;
    }
  } catch {
    /* ignore */
  }
}

/** Connection timeout in milliseconds (#9) */
const CONNECTION_TIMEOUT_MS = 30_000;

interface VideoFrameDailyProps {
  roomUrl: string;
  meetingToken: string;
  requestId: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCallJoined: () => void;
  onCallLeft?: () => void;
  consultationActive: boolean;
}

function TranscriptionForwarder({
  requestId,
  consultationActive,
  meetingJoined,
}: {
  requestId: string | null;
  consultationActive: boolean;
  meetingJoined: boolean;
}) {
  useWebTranscription({ requestId, consultationActive, meetingJoined });
  return null;
}

export function VideoFrameDaily({
  roomUrl,
  meetingToken,
  requestId,
  isExpanded,
  onToggleExpand,
  onCallJoined,
  onCallLeft,
  consultationActive,
}: VideoFrameDailyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [callObject, setCallObject] = useState<DailyCall | null>(null);
  const destroyedRef = useRef(false);
  /** Instância atual — não depender só do state para destroy (evita closure stale em Strict Mode / re-runs). */
  const frameRef = useRef<DailyCall | null>(null);
  /** Evita recriar iframe quando o pai re-renderiza e passa nova referência de callback. */
  const onCallJoinedRef = useRef(onCallJoined);
  useEffect(() => { onCallJoinedRef.current = onCallJoined; }, [onCallJoined]);
  const onCallLeftRef = useRef(onCallLeft);
  useEffect(() => { onCallLeftRef.current = onCallLeft; }, [onCallLeft]);

  // --- Bug #2: meeting joined state for transcription gating ---
  const [meetingJoined, setMeetingJoined] = useState(false);

  // --- Bug #4: network reconnecting state ---
  const [reconnecting, setReconnecting] = useState(false);

  // --- Bug #8: screen share active state ---
  const [screenShareActive, setScreenShareActive] = useState(false);

  // --- Bug #9: connection timeout state ---
  const [connectionTimedOut, setConnectionTimedOut] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Guard against duplicate onCallLeft invocations (left-meeting + error can both fire)
  const callLeftFiredRef = useRef(false);

  // --- Bug #9: retry handler ---
  const handleRetry = useCallback(() => {
    setConnectionTimedOut(false);
    // Destroy current and re-trigger the effect
    const toDestroy = frameRef.current;
    frameRef.current = null;
    if (activeWebDailyCall === toDestroy) {
      activeWebDailyCall = null;
    }
    setCallObject(null);
    setMeetingJoined(false);
    void runDailyWebExclusive(async () => {
      await destroyDailyCallSafe(toDestroy);
      containerRef.current?.querySelectorAll('iframe').forEach((el) => el.remove());
    });
    // Force effect re-run by setting a new retry key
    setRetryKey((k) => k + 1);
  }, []);

  // --- Bug #5: visibility change handler to keep connection alive ---
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    function handleVisibilityChange() {
      if (!frameRef.current) return;
      try {
        if (document.visibilityState === 'hidden') {
          // Keep the connection alive by setting bandwidth to minimum instead of pausing
          frameRef.current.setBandwidth({ kbs: 50, trackConstraints: { width: 320, height: 240, frameRate: 5 } });
        } else {
          // Restore full bandwidth when tab visible again
          frameRef.current.setBandwidth({ kbs: 'NO_CAP', trackConstraints: { width: 1280, height: 720, frameRate: 30 } });
        }
      } catch {
        /* ignore — frame may be destroyed */
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [callObject]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !roomUrl) return;

    destroyedRef.current = false;
    callLeftFiredRef.current = false;
    // Reset all state when roomUrl/retryKey changes — intentional synchronous setState
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMeetingJoined(false);
    setReconnecting(false);
    setScreenShareActive(false);
    setConnectionTimedOut(false);
    let cancelled = false;
    /** Cópia estável para o cleanup (evita ref mutada antes do async terminar). */
    const containerEl = container;

    void runDailyWebExclusive(async () => {
      await destroyDailyCallSafe(activeWebDailyCall);
      activeWebDailyCall = null;
      await destroyDailyCallSafe(frameRef.current);
      frameRef.current = null;
      setCallObject(null);

      if (cancelled) return;

      containerEl.querySelectorAll('iframe').forEach((el) => el.remove());

      let frame: DailyCall | null = null;
      try {
        frame = DailyIframe.createFrame(containerEl, {
          iframeStyle: {
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '0',
          },
          showLeaveButton: true,
          showFullscreenButton: true,
          showLocalVideo: true,
          showParticipantsBar: true,
          lang: 'pt',
          theme: {
            colors: {
              accent: '#0EA5E9',
              accentText: '#FFFFFF',
              background: '#111827',
              backgroundAccent: '#1F2937',
              baseText: '#F9FAFB',
              border: '#374151',
              mainAreaBg: '#030712',
              mainAreaBgAccent: '#111827',
              mainAreaText: '#F9FAFB',
            },
          },
        });
      } catch (err) {
        console.error('[VideoFrameDaily] Failed to create Daily frame:', err);
        return;
      }

      if (cancelled) {
        await destroyDailyCallSafe(frame);
        return;
      }

      activeWebDailyCall = frame;
      frameRef.current = frame;

      // --- Bug #9: connection timeout ---
      timeoutRef.current = setTimeout(() => {
        if (!destroyedRef.current && frameRef.current) {
          setConnectionTimedOut(true);
          toast.error('Tempo limite de conexão atingido. A videochamada pode estar indisponível.');
        }
      }, CONNECTION_TIMEOUT_MS);

      // --- Bug #1 + #2: joined-meeting handler with buffer for transcription ---
      frame.on('joined-meeting', () => {
        // Clear connection timeout
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        setConnectionTimedOut(false);

        if (!destroyedRef.current) {
          onCallJoinedRef.current();
          // #1: Small buffer to ensure Daily connection is fully established before transcription
          setTimeout(() => {
            if (!destroyedRef.current) {
              setMeetingJoined(true);
            }
          }, 150);
        }
      });

      // --- Bug #2: left-meeting handler — cleanup all state (guard against double-fire) ---
      frame.on('left-meeting', () => {
        if (destroyedRef.current || callLeftFiredRef.current) return;
        callLeftFiredRef.current = true;
        setMeetingJoined(false);
        setScreenShareActive(false);
        setReconnecting(false);
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        onCallLeftRef.current?.();
      });

      // --- Bug #4: network-connection handler for reconnecting UI ---
      frame.on('network-connection', (event) => {
        if (destroyedRef.current) return;
        const ev = event as { action?: string; type?: string };
        if (ev.type === 'disconnected' || ev.action === 'interrupted') {
          setReconnecting(true);
          toast.warning('Conexão interrompida. Tentando reconectar...', { id: 'daily-reconnecting' });
        } else if (ev.type === 'connected' || ev.action === 'connected') {
          setReconnecting(false);
          toast.success('Conexão restabelecida.', { id: 'daily-reconnecting' });
        }
      });

      // --- Bug #7: camera-error handler ---
      frame.on('camera-error', (event) => {
        if (destroyedRef.current) return;
        const ev = event as { error?: { type?: string }; errorMsg?: { errorMsg?: string } };
        const errorType = ev.error?.type ?? 'unknown';
        let message = 'Erro ao acessar a câmera.';
        if (errorType === 'not-found') {
          message = 'Câmera não encontrada. Verifique se está conectada.';
        } else if (errorType === 'not-allowed' || errorType === 'permissions') {
          message = 'Permissão de câmera negada. Verifique as configurações do navegador.';
        } else if (errorType === 'constraints') {
          message = 'A câmera não suporta as configurações solicitadas.';
        }
        toast.error(message, {
          duration: 8000,
          action: {
            label: 'Tentar novamente',
            onClick: () => {
              try { frameRef.current?.setLocalVideo(true); } catch { /* ignore */ }
            },
          },
        });
      });

      // --- Bug #7: mic-error handler ---
      frame.on('nonfatal-error', (event) => {
        if (destroyedRef.current) return;
        const ev = event as { type?: string; errorMsg?: string };
        if (ev.type === 'mic-error') {
          let message = 'Erro ao acessar o microfone.';
          if (ev.errorMsg?.includes('not-found')) {
            message = 'Microfone não encontrado. Verifique se está conectado.';
          } else if (ev.errorMsg?.includes('not-allowed') || ev.errorMsg?.includes('permissions')) {
            message = 'Permissão de microfone negada. Verifique as configurações do navegador.';
          }
          toast.error(message, {
            duration: 8000,
            action: {
              label: 'Tentar novamente',
              onClick: () => {
                try { frameRef.current?.setLocalAudio(true); } catch { /* ignore */ }
              },
            },
          });
        }
      });

      // --- Bug #8: track-stopped for screen share detection ---
      frame.on('track-stopped', (event) => {
        if (destroyedRef.current) return;
        const ev = event as { track?: { kind?: string }; participant?: { local?: boolean; screen?: boolean } };
        if (ev.participant?.screen === false && ev.participant?.local) {
          setScreenShareActive(false);
          toast.info('Compartilhamento de tela encerrado.');
        }
      });

      frame.on('track-started', (event) => {
        if (destroyedRef.current) return;
        const ev = event as { track?: { kind?: string }; participant?: { local?: boolean; screen?: boolean } };
        if (ev.participant?.screen && ev.participant?.local) {
          setScreenShareActive(true);
        }
      });

      // --- Bug #2: handle unexpected errors that end the call (guard against double-fire) ---
      frame.on('error', (event) => {
        if (destroyedRef.current || callLeftFiredRef.current) return;
        callLeftFiredRef.current = true;
        console.error('[VideoFrameDaily] Daily error:', event);
        const ev = event as { errorMsg?: string };
        toast.error(ev.errorMsg ?? 'Erro na videochamada. Tente reconectar.');
        setMeetingJoined(false);
        onCallLeftRef.current?.();
      });

      setCallObject(frame);

      await frame.join({ url: roomUrl, token: meetingToken });
    });

    // --- Bug #3: cleanup .destroy() on unmount ---
    return () => {
      cancelled = true;
      destroyedRef.current = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      const toDestroy = frameRef.current;
      frameRef.current = null;
      if (activeWebDailyCall === toDestroy) {
        activeWebDailyCall = null;
      }
      setCallObject(null);
      setMeetingJoined(false);
      void runDailyWebExclusive(async () => {
        await destroyDailyCallSafe(toDestroy);
        containerEl.querySelectorAll('iframe').forEach((node) => node.remove());
      });
    };
  }, [roomUrl, meetingToken, retryKey]);

  return (
    // --- Bug #10: responsive layout for small screens ---
    <div className={`relative transition-all duration-300 ${isExpanded ? 'w-[40%]' : 'w-[60%]'} max-md:!w-full max-md:h-[50vh] max-md:min-h-[250px]`}>
      <div className="relative w-full h-full min-h-[200px]">
        <div ref={containerRef} className="w-full h-full min-h-[200px] bg-gray-900" />

        {/* DailyProvider for transcription forwarding */}
        {callObject && (
          <DailyProvider callObject={callObject}>
            <TranscriptionForwarder
              requestId={requestId}
              consultationActive={consultationActive}
              meetingJoined={meetingJoined}
            />
          </DailyProvider>
        )}

        {/* --- Bug #4: Reconnecting overlay --- */}
        {reconnecting && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/80 backdrop-blur-sm">
            <WifiOff className="h-10 w-10 text-amber-400 mb-3 animate-pulse" />
            <p className="text-amber-300 font-medium text-sm">Reconectando...</p>
            <p className="text-gray-500 text-xs mt-1">Aguarde, tentando restabelecer a conexão</p>
            <Loader2 className="h-5 w-5 animate-spin text-amber-400 mt-3" />
          </div>
        )}

        {/* --- Bug #9: Connection timeout overlay --- */}
        {connectionTimedOut && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950/90 backdrop-blur-sm">
            <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
            <p className="text-red-300 font-medium text-sm">Tempo de conexão esgotado</p>
            <p className="text-gray-500 text-xs mt-1 max-w-xs text-center">
              Não foi possível conectar à videochamada em {CONNECTION_TIMEOUT_MS / 1000}s.
            </p>
            <Button
              onClick={handleRetry}
              variant="outline"
              size="sm"
              className="mt-4 gap-2 border-red-800 text-red-300 hover:bg-red-950"
            >
              <RefreshCw className="h-4 w-4" /> Tentar novamente
            </Button>
          </div>
        )}

        {/* --- Bug #8: Screen share indicator --- */}
        {screenShareActive && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-900/80 text-emerald-300 text-xs font-medium">
            <MonitorOff className="h-3.5 w-3.5" />
            Compartilhando tela
          </div>
        )}

        <button
          onClick={onToggleExpand}
          className="absolute top-4 right-4 p-2 rounded-lg bg-gray-900/80 text-gray-400 hover:text-white transition-colors z-10"
          aria-label={isExpanded ? 'Expandir vídeo' : 'Expandir painel'}
        >
          {isExpanded ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}
