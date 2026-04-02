/**
 * AiCopilotSection — AI Copilot with purple (#8B5CF6) border and styling.
 * Lamp icon, risk badge, AI summary, "Ver analise completa" link.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { parseAiSummary } from '@/lib/parseAiSummary';
import { hasUsefulAiContent } from '@/lib/aiCopilotHelpers';
import type { MedicalRequest } from '@/services/doctorApi';
import { Lightbulb, Shield, AlertTriangle, AlertCircle, Clock, Copy, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const RISK_LABELS: Record<string, string> = {
  low: 'Risco baixo',
  medium: 'Risco médio',
  high: 'Risco alto',
};
const URGENCY_LABELS: Record<string, string> = {
  routine: 'Rotina',
  urgent: 'Urgente',
  emergency: 'Emergência',
};

function getRiskLabel(level: string | null | undefined): string {
  if (!level) return 'Risco não classificado';
  return RISK_LABELS[level.toLowerCase()] ?? 'Risco não classificado';
}

function getUrgencyLabel(level: string | null | undefined): string {
  if (!level) return 'Não informado';
  return URGENCY_LABELS[level.toLowerCase()] ?? 'Não informado';
}

interface AiCopilotSectionProps {
  request: MedicalRequest;
  className?: string;
}

export function AiCopilotSection({ request, className }: AiCopilotSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const summaryText = request.aiSummaryForDoctor?.trim() ?? '';
  const blocks = useMemo(() => parseAiSummary(summaryText), [summaryText]);

  if (!hasUsefulAiContent(request.aiSummaryForDoctor, request.aiRiskLevel, request.aiUrgency)) {
    return null;
  }

  const shouldTruncate = !expanded && blocks.length > 6;
  const displayBlocks = shouldTruncate ? blocks.slice(0, 6) : blocks;

  const riskLevel = request.aiRiskLevel?.toLowerCase();
  const RiskIcon = riskLevel === 'low' ? Shield : riskLevel === 'high' ? AlertCircle : AlertTriangle;
  const riskBg =
    riskLevel === 'low'
      ? 'bg-emerald-100 text-emerald-700'
      : riskLevel === 'high'
        ? 'bg-red-100 text-red-700'
        : 'bg-amber-100 text-amber-700';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(summaryText);
      toast.success('Resumo copiado');
    } catch {
      toast.error('Não foi possível copiar. Selecione o texto manualmente.');
    }
  };

  return (
    <Card
      className={cn(
        'border-2 border-violet-300 bg-violet-50/30 dark:bg-violet-950/10 dark:border-violet-500/40',
        className,
      )}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/40">
            <Lightbulb className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
          </div>
          <span className="font-semibold text-sm text-violet-900 dark:text-violet-200">
            Copiloto IA
          </span>
          {request.aiRiskLevel && (
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium',
                riskBg,
              )}
            >
              <RiskIcon className="h-3 w-3" />
              {getRiskLabel(request.aiRiskLevel)}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground italic mt-1">
          Sugestões geradas por IA — decisão final do médico.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {summaryText.length > 0 && (
          <div className="space-y-2">
            {displayBlocks.map((block, i) => {
              if (block.type === 'header') {
                return (
                  <div key={i} className={i > 0 ? 'pt-3 border-t border-violet-200/50 dark:border-violet-700/30' : ''}>
                    <p className="text-xs font-bold text-violet-700 dark:text-violet-300 uppercase tracking-wide mb-1">
                      {block.header}
                    </p>
                    {block.content && <p className="text-sm text-foreground">{block.content}</p>}
                  </div>
                );
              }
              if (block.type === 'bullet') {
                return (
                  <div key={i} className="flex gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-500 mt-2 shrink-0" />
                    <p className="text-sm text-foreground">{block.content}</p>
                  </div>
                );
              }
              return <p key={i} className="text-sm text-foreground">{block.content}</p>;
            })}
            {shouldTruncate && <p className="text-sm text-muted-foreground">...</p>}
            <div className="flex items-center gap-2 pt-2 border-t border-violet-200/50 dark:border-violet-700/30">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="gap-1.5 h-8 text-violet-700 hover:text-violet-800 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/30"
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar resumo
              </Button>
              {blocks.length > 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="gap-1.5 h-8 text-violet-700 hover:text-violet-800 hover:bg-violet-100 dark:text-violet-300 dark:hover:bg-violet-900/30"
                >
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {expanded ? 'Ver menos' : 'Ver análise completa'}
                </Button>
              )}
            </div>
          </div>
        )}
        {request.aiUrgency && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Urgência: {getUrgencyLabel(request.aiUrgency)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
