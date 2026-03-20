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
 */

import DailyIframe, { type DailyCall } from '@daily-co/daily-js';
import { DailyProvider } from '@daily-co/daily-react';
import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { useWebTranscription } from '@/hooks/useWebTranscription';

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

interface VideoFrameDailyProps {
  roomUrl: string;
  requestId: string | null;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onCallJoined: () => void;
  consultationActive: boolean;
}

function TranscriptionForwarder({
  requestId,
  consultationActive,
}: {
  requestId: string | null;
  consultationActive: boolean;
}) {
  useWebTranscription({ requestId, consultationActive });
  return null;
}

export function VideoFrameDaily({
  roomUrl,
  requestId,
  isExpanded,
  onToggleExpand,
  onCallJoined,
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

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !roomUrl) return;

    destroyedRef.current = false;
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
          url: roomUrl,
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
      frame.on('joined-meeting', () => {
        if (!destroyedRef.current) onCallJoinedRef.current();
      });
      setCallObject(frame);
    });

    return () => {
      cancelled = true;
      destroyedRef.current = true;
      const toDestroy = frameRef.current;
      frameRef.current = null;
      if (activeWebDailyCall === toDestroy) {
        activeWebDailyCall = null;
      }
      setCallObject(null);
      void runDailyWebExclusive(async () => {
        await destroyDailyCallSafe(toDestroy);
        containerEl.querySelectorAll('iframe').forEach((node) => node.remove());
      });
    };
  }, [roomUrl]);

  return (
    <div className={`relative transition-all duration-300 ${isExpanded ? 'w-[40%]' : 'w-[60%]'}`}>
      <div className="relative w-full h-full min-h-[200px]">
        <div ref={containerRef} className="w-full h-full min-h-[200px] bg-gray-900" />

        {/* DailyProvider for transcription forwarding */}
        {callObject && (
          <DailyProvider callObject={callObject}>
            <TranscriptionForwarder
              requestId={requestId}
              consultationActive={consultationActive}
            />
          </DailyProvider>
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
