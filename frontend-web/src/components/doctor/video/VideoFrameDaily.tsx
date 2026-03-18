/**
 * VideoFrameDaily — Daily.co via SDK (em vez de iframe puro).
 * Permite acessar transcription-message e enviar ao backend.
 * Inclui controles de vídeo (mic, câmera) como no mobile.
 */

import { useCallback, useRef, useState } from 'react';
import { DailyProvider, useCallFrame, useDaily, useDailyEvent } from '@daily-co/daily-react';
import { Maximize2, Minimize2, Mic, MicOff, Video, VideoOff } from 'lucide-react';
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

function CallJoinedReporter({ onCallJoined }: { onCallJoined: () => void }) {
  const reportedRef = useRef(false);
  const cb = useCallback(() => {
    if (!reportedRef.current) {
      reportedRef.current = true;
      onCallJoined();
    }
  }, [onCallJoined]);
  useDailyEvent('joined-meeting', cb);
  return null;
}

function VideoControlBar() {
  const daily = useDaily();
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);

  const toggleMic = useCallback(() => {
    if (!daily) return;
    daily.setLocalAudio(!micOn);
    setMicOn(!micOn);
  }, [daily, micOn]);

  const toggleCam = useCallback(() => {
    if (!daily) return;
    daily.setLocalVideo(!camOn);
    setCamOn(!camOn);
  }, [daily, camOn]);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 z-10">
      <button
        onClick={toggleMic}
        className={`p-3.5 rounded-full transition-colors shadow-lg ${
          micOn
            ? 'bg-gray-800/90 text-white hover:bg-gray-700'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
        aria-label={micOn ? 'Desativar microfone' : 'Ativar microfone'}
      >
        {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
      </button>
      <button
        onClick={toggleCam}
        className={`p-3.5 rounded-full transition-colors shadow-lg ${
          camOn
            ? 'bg-gray-800/90 text-white hover:bg-gray-700'
            : 'bg-red-600 text-white hover:bg-red-700'
        }`}
        aria-label={camOn ? 'Desativar câmera' : 'Ativar câmera'}
      >
        {camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
      </button>
    </div>
  );
}

function VideoFrameInner({
  roomUrl,
  requestId,
  isExpanded,
  onToggleExpand,
  onCallJoined,
  consultationActive,
}: VideoFrameDailyProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const call = useCallFrame({
    parentElRef: containerRef as React.MutableRefObject<HTMLElement>,
    options: { url: roomUrl },
    shouldCreateInstance: () => !!roomUrl,
  });

  return (
    <div className="relative w-full h-full min-h-[200px]">
      <div ref={containerRef} className="w-full h-full min-h-[200px] bg-gray-900" />
      {call && (
        <DailyProvider callObject={call}>
          <CallJoinedReporter onCallJoined={onCallJoined} />
          <TranscriptionForwarder requestId={requestId} consultationActive={consultationActive} />
          <VideoControlBar />
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
  );
}

export function VideoFrameDaily(props: VideoFrameDailyProps) {
  return (
    <div className={`relative transition-all duration-300 ${props.isExpanded ? 'w-[40%]' : 'w-[60%]'}`}>
      <VideoFrameInner {...props} />
    </div>
  );
}
