/**
 * TranscriptionPanel — Real-time transcription display for video consultations.
 *
 * Shows live transcript with [Médico]/[Paciente] labels, chat-like bubbles,
 * and empty state with Whisper info + CFM compliance notice.
 */

import { motion } from 'framer-motion';
import { Mic, Shield } from 'lucide-react';

interface TranscriptionPanelProps {
  transcript: string;
}

export function TranscriptionPanel({ transcript }: TranscriptionPanelProps) {
  if (transcript.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-gray-800 flex items-center justify-center mb-4">
          <Mic className="h-8 w-8 text-gray-600" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Aguardando transcrição</p>
        <p className="text-xs text-gray-600 mt-1 max-w-xs">
          A transcrição em tempo real aparecerá aqui conforme a conversa acontece.
          Powered by OpenAI Whisper.
        </p>
        <div className="flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full bg-gray-800 text-[10px] text-gray-500">
          <Shield className="h-3 w-3" />
          Resolução CFM 2.454/2026 — IA como auxílio
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {transcript.split('\n').filter(Boolean).map((line, i) => {
        const isMedico = line.startsWith('[Médico]');
        const isPaciente = line.startsWith('[Paciente]');
        const text = line.replace(/^\[(Médico|Paciente)\]\s*/, '');
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex gap-3 ${isMedico ? 'justify-end' : ''}`}
          >
            <div className={`max-w-[85%] p-3 rounded-xl text-sm ${
              isMedico
                ? 'bg-primary/20 text-primary-foreground ml-auto'
                : 'bg-gray-800 text-gray-300'
            }`}>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1 opacity-60">
                {isMedico ? 'Médico' : isPaciente ? 'Paciente' : 'Sistema'}
              </p>
              <p>{text}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
