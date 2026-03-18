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
  const createdForUrlRef = useRef<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !roomUrl) return;

    // Prevent duplicate creation for the same URL
    if (createdForUrlRef.current === roomUrl && callObject) return;

    // Cleanup any existing instance first
    if (callObject) {
      try { callObject.destroy(); } catch { /* ignore */ }
      setCallObject(null);
    }

    // Clear any leftover Daily iframes in the container
    container.querySelectorAll('iframe').forEach((el) => el.remove());

    destroyedRef.current = false;
    createdForUrlRef.current = roomUrl;

    let frame: DailyCall | null = null;

    try {
      frame = DailyIframe.createFrame(container, {
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

      frame.on('joined-meeting', () => {
        if (!destroyedRef.current) onCallJoined();
      });

      setCallObject(frame);
    } catch (err) {
      console.error('[VideoFrameDaily] Failed to create Daily frame:', err);
    }

    return () => {
      destroyedRef.current = true;
      createdForUrlRef.current = null;
      if (frame) {
        try { frame.destroy(); } catch { /* ignore */ }
      }
      setCallObject(null);
      // Clean up any leftover iframes
      container.querySelectorAll('iframe').forEach((el) => el.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
