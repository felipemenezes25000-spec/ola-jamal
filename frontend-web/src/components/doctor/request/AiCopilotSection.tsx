/**
 * AiCopilotSection — Resumo IA expandível com risco e urgência.
 * Alinhado ao mobile AiCopilotSection.
 */
import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { parseAiSummary } from '@/lib/parseAiSummary';
import type { MedicalRequest } from '@/services/doctorApi';
import { Sparkles, Shield, AlertTriangle, AlertCircle, Clock, Copy, ChevronDown, ChevronUp } from 'lucide-react';
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

export function hasUsefulAiContent(
  aiSummary: string | null | undefined,
  aiRisk?: string | null,
  aiUrgency?: string | null
): boolean {
  if (aiRisk || aiUrgency) return true;
  if (!aiSummary || !aiSummary.trim()) return false;
  return aiSummary.replace(/\s/g, '').length > 50;
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
  const riskIcon = riskLevel === 'low' ? Shield : riskLevel === 'high' ? AlertCircle : AlertTriangle;
  const riskBg = riskLevel === 'low' ? 'bg-emerald-100 text-emerald-700' : riskLevel === 'high' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summaryText);
    toast.success('Resumo copiado');
  };

  return (
    <Card className={cn('border-primary/20 bg-primary/[0.02]', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <span className="font-semibold text-sm">Copiloto IA</span>
          {request.aiRiskLevel && (
            <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium', riskBg)}>
              {riskIcon({ className: 'h-3 w-3' })}
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
                  <div key={i} className={i > 0 ? 'pt-3 border-t border-border/50' : ''}>
                    <p className="text-xs font-bold text-primary uppercase tracking-wide mb-1">{block.header}</p>
                    {block.content && <p className="text-sm text-foreground">{block.content}</p>}
                  </div>
                );
              }
              if (block.type === 'bullet') {
                return (
                  <div key={i} className="flex gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                    <p className="text-sm text-foreground">{block.content}</p>
                  </div>
                );
              }
              return <p key={i} className="text-sm text-foreground">{block.content}</p>;
            })}
            {shouldTruncate && <p className="text-sm text-muted-foreground">...</p>}
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5 h-8">
                <Copy className="h-3.5 w-3.5" />
                Copiar resumo
              </Button>
              {blocks.length > 6 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded(!expanded)}
                  className="gap-1.5 h-8"
                >
                  {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {expanded ? 'Ver menos' : 'Ver mais'}
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
