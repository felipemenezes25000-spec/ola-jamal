/**
 * ConsultationStats — Summary grid for the finish consultation dialog.
 *
 * Shows duration, transcription length, anamnesis fields, and suggestions count.
 */

import { Clock, Mic, Brain, Lightbulb } from 'lucide-react';

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

interface ConsultationStatsProps {
  timerSeconds: number;
  transcriptLength: number;
  filledAnamnesisFields: number;
  suggestionsCount: number;
}

export function ConsultationStats({
  timerSeconds,
  transcriptLength,
  filledAnamnesisFields,
  suggestionsCount,
}: ConsultationStatsProps) {
  return (
    <div className="rounded-xl bg-muted p-4 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Resumo da consulta</p>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Duração: {formatTimer(timerSeconds)}</span>
        </div>
        <div className="flex items-center gap-2">
          <Mic className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Transcrição: {transcriptLength > 0 ? `${transcriptLength} chars` : 'Não disponível'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Brain className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Anamnese: {filledAnamnesisFields > 0 ? `${filledAnamnesisFields} campos` : 'Não gerada'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
          <span>Sugestões: {suggestionsCount || 0}</span>
        </div>
      </div>
    </div>
  );
}
