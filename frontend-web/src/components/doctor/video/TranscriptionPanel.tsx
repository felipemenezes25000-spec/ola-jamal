/**
 * TranscriptionPanel — Real-time transcription display for video consultations.
 *
 * Shows live transcript with [Médico]/[Paciente] labels, chat-like bubbles,
 * and empty state with Daily.co transcription info + CFM compliance notice.
 *
 * Design spec:
 * - Dark bg matching AI panel (#15202E)
 * - Purple accent (#8B5CF6) for doctor messages
 * - Responsive text sizes and padding
 */

import { useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Shield } from 'lucide-react';

interface TranscriptionPanelProps {
  transcript: string;
}

export function TranscriptionPanel({ transcript }: TranscriptionPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new transcript lines arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [transcript]);

  if (transcript.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center px-4">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-[#1E293B] flex items-center justify-center mb-3 sm:mb-4">
          <Mic className="h-6 w-6 sm:h-8 sm:w-8 text-gray-600" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Aguardando transcrição</p>
        <p className="text-xs text-gray-600 mt-1 max-w-xs">
          A transcrição em tempo real aparecerá aqui conforme a conversa acontece.
          Powered by Daily.co (transcrição nativa).
        </p>
        <div className="flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-[#1E293B] text-[10px] text-gray-500">
          <Shield className="h-3 w-3" />
          Resolução CFM 2.454/2026 — IA como auxílio
        </div>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="space-y-2 sm:space-y-3 overflow-auto">
      {transcript.split('\n').filter(Boolean).map((line, i) => {
        const isMedico = line.startsWith('[Médico]');
        const isPaciente = line.startsWith('[Paciente]');
        const text = line.replace(/^\[(Médico|Paciente)\]\s*/, '');
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className={`flex gap-2 sm:gap-3 ${isMedico ? 'justify-end' : ''}`}
          >
            <div className={`max-w-[90%] sm:max-w-[85%] p-2.5 sm:p-3 rounded-xl text-xs sm:text-sm ${
              isMedico
                ? 'bg-[#8B5CF6]/20 text-purple-100 ml-auto rounded-br-sm'
                : 'bg-[#1E293B] text-gray-300 rounded-bl-sm'
            }`}>
              <p className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-0.5 sm:mb-1 ${
                isMedico ? 'text-[#8B5CF6]' : isPaciente ? 'text-emerald-400' : 'text-gray-500'
              }`}>
                {isMedico ? 'Médico' : isPaciente ? 'Paciente' : 'Sistema'}
              </p>
              <p className="leading-relaxed">{text}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
