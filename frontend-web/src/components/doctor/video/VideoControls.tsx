/**
 * VideoTopBar + VideoFrame — Split-screen video call controls.
 *
 * VideoTopBar: status indicators, timer, patient name, action buttons.
 * VideoFrame: Daily.co iframe with expand/minimize toggle.
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft, User, ExternalLink, PhoneOff,
  Timer, Sparkles, Maximize2, Minimize2,
} from 'lucide-react';

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
  return (
    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/90 backdrop-blur-sm border-b border-gray-800 shrink-0">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost" size="icon"
          onClick={() => {
            if (consultationStarted) {
              onFinish();
            } else {
              onBack();
            }
          }}
          className="text-gray-400 hover:text-white hover:bg-gray-800"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>

        {/* Status indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-gray-300 font-medium">Consulta em andamento</span>
          </div>
          {signalConnected && (
            <Badge variant="outline" className="text-emerald-400 border-emerald-800 text-[10px] gap-1">
              <Sparkles className="h-3 w-3" /> IA Ativa
            </Badge>
          )}
        </div>
      </div>

      {/* Timer */}
      <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono text-sm ${
        timeExceeded ? 'bg-red-900/50 text-red-400' :
        timeWarning ? 'bg-amber-900/50 text-amber-400' :
        'bg-gray-800 text-gray-300'
      }`}>
        <Timer className="h-3.5 w-3.5" />
        <span>{formatTimer(timerSeconds)}</span>
        {contractedMinutes && (
          <span className="text-gray-500">/ {contractedMinutes}min</span>
        )}
      </div>

      {/* Patient + actions */}
      <div className="flex items-center gap-3">
        {patientName && (
          <div className="flex items-center gap-2 text-gray-400">
            <User className="h-4 w-4" />
            <span className="text-sm">{patientName}</span>
          </div>
        )}
        <Button
          variant="ghost" size="sm"
          className="text-gray-400 hover:text-white hover:bg-gray-800 gap-1.5"
          onClick={() => window.open(roomUrl, '_blank', 'noopener,noreferrer')}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Nova aba
        </Button>
        <Button
          size="sm"
          className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
          onClick={onFinish}
        >
          <PhoneOff className="h-3.5 w-3.5" /> Encerrar
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
