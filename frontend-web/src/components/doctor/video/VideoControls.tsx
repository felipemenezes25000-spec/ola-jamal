/**
 * VideoTopBar + VideoFrame — Split-screen video call controls.
 *
 * VideoTopBar: "AO VIVO" indicator, timer, patient name, action buttons.
 * VideoFrame: Daily.co iframe with expand/minimize toggle.
 *
 * Design spec:
 * - Full-screen dark background (#0B1120)
 * - Top bar: green dot + "AO VIVO", timer "12:34", menu
 * - Bottom controls: 5 circular buttons (48px), end call 56px red
 * - Responsive: phone landscape, tablet, desktop
 *
 * Bug fix #6: Debounced action buttons to prevent double-click issues.
 */

import { useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, User, ExternalLink, PhoneOff,
  Timer, Sparkles, Maximize2, Minimize2,
} from 'lucide-react';

/** #6: Generic debounce hook for click handlers (300ms default) */
function useDebouncedAction(fn: () => void, delayMs = 300): () => void {
  const lastCallRef = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - lastCallRef.current < delayMs) return;
    lastCallRef.current = now;
    fn();
  }, [fn, delayMs]);
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

/* ── VideoTopBar ── */

interface VideoTopBarProps {
  consultationStarted: boolean;
  timerSeconds: number;
  contractedMinutes: number | null;
  patientName?: string;
  roomUrl: string;
  signalConnected: boolean;
  timeExceeded: boolean;
  timeWarning: boolean;
  onFinish: () => void;
  onBack: () => void;
}

export function VideoTopBar({
  consultationStarted,
  timerSeconds,
  contractedMinutes,
  patientName,
  roomUrl,
  signalConnected,
  timeExceeded,
  timeWarning,
  onFinish,
  onBack,
}: VideoTopBarProps) {
  // #6: Debounce finish/back buttons to prevent double-click
  const debouncedFinish = useDebouncedAction(onFinish);
  const debouncedBack = useDebouncedAction(onBack);

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#0B1120]/95 backdrop-blur-md border-b border-white/5 shrink-0 min-h-[48px] z-30">
      {/* Left: Back + Live indicator */}
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <Button
          variant="ghost" size="icon"
          onClick={() => {
            if (consultationStarted) {
              debouncedFinish();
            } else {
              debouncedBack();
            }
          }}
          className="text-gray-400 hover:text-white hover:bg-white/10 shrink-0 h-8 w-8 sm:h-9 sm:w-9"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
        </Button>

        {/* AO VIVO indicator */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            <span className="text-xs sm:text-sm text-emerald-400 font-semibold tracking-wide uppercase whitespace-nowrap">
              AO VIVO
            </span>
          </div>
          {signalConnected && (
            <Badge variant="outline" className="hidden sm:flex text-purple-400 border-purple-800/60 bg-purple-900/20 text-[10px] gap-1 py-0.5">
              <Sparkles className="h-3 w-3" /> IA Ativa
            </Badge>
          )}
        </div>
      </div>

      {/* Center: Timer */}
      <div className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1 sm:py-1.5 rounded-full font-mono text-xs sm:text-sm shrink-0 ${
        timeExceeded ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30' :
        timeWarning ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/30' :
        'bg-white/5 text-gray-300'
      }`}>
        <Timer className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        <span>{formatTimer(timerSeconds)}</span>
        {contractedMinutes && (
          <span className="text-gray-500 hidden sm:inline">/ {contractedMinutes}min</span>
        )}
      </div>

      {/* Right: Patient + actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {patientName && (
          <div className="hidden md:flex items-center gap-2 text-gray-400">
            <User className="h-4 w-4 shrink-0" />
            <span className="text-sm truncate max-w-[120px] lg:max-w-[200px]">{patientName}</span>
          </div>
        )}
        <Button
          variant="ghost" size="sm"
          className="hidden lg:flex text-gray-400 hover:text-white hover:bg-white/10 gap-1.5 text-xs"
          onClick={() => window.open(roomUrl, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Nova aba
        </Button>
        <Button
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white gap-1.5 text-xs h-8 px-3 sm:h-9 sm:px-4"
          onClick={debouncedFinish}
        >
          <PhoneOff className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Encerrar</span>
        </Button>
      </div>
    </div>
  );
}

/* ── VideoFrame ── */

interface VideoFrameProps {
  roomUrl: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onIframeLoad: () => void;
}

export function VideoFrame({
  roomUrl,
  isExpanded,
  onToggleExpand,
  onIframeLoad,
}: VideoFrameProps) {
  return (
    <div className={`relative transition-all duration-300 ${isExpanded ? 'w-[40%]' : 'w-[60%]'}`}>
      <iframe
        src={roomUrl}
        allow="camera; microphone; display-capture; autoplay; clipboard-write"
        className="w-full h-full border-0"
        title="Videochamada"
        onLoad={onIframeLoad}
      />
      <button
        onClick={onToggleExpand}
        className="absolute bottom-4 right-4 p-2 rounded-lg bg-gray-900/80 text-gray-400 hover:text-white transition-colors"
        aria-label={isExpanded ? 'Expandir vídeo' : 'Expandir painel'}
      >
        {isExpanded ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
      </button>
    </div>
  );
}
