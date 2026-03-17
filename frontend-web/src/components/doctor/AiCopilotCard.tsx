/**
 * AiCopilotCard — Card expandível com resumo da IA, badges de risco e urgência.
 * Paridade com mobile AiCopilotSection.
 */
import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sparkles, ChevronDown, ChevronUp, Copy, Info } from 'lucide-react';
import { toast } from 'sonner';
import { getRiskBadge } from '@/lib/doctor-helpers';
import { hasUsefulAiContent } from '@/lib/aiCopilotHelpers';

const URGENCY_LABELS: Record<string, string> = {
  routine: 'Rotina',
  urgent: 'Urgente',
  emergency: 'Emergência',
};

const URGENCY_COLORS: Record<string, string> = {
  routine: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  urgent: 'bg-amber-100 text-amber-800 border-amber-300',
  emergency: 'bg-red-100 text-red-800 border-red-300',
};

function getUrgencyLabel(level: string | null | undefined): string {
  if (!level) return 'Não informado';
  return URGENCY_LABELS[level.toLowerCase()] ?? level;
}

function getUrgencyColor(level: string | null | undefined): string {
  if (!level) return 'bg-gray-100 text-gray-800 border-gray-300';
  return URGENCY_COLORS[level.toLowerCase()] ?? 'bg-gray-100 text-gray-800 border-gray-300';
}

export interface AiCopilotCardProps {
  aiSummaryForDoctor?: string | null;
  aiRiskLevel?: string | null;
  aiUrgency?: string | null;
}

export function AiCopilotCard({ aiSummaryForDoctor, aiRiskLevel, aiUrgency }: AiCopilotCardProps) {
  const [expanded, setExpanded] = useState(false);
  const summaryText = aiSummaryForDoctor?.trim() ?? '';
  const riskBadge = getRiskBadge(aiRiskLevel);

  if (!hasUsefulAiContent(aiSummaryForDoctor, aiRiskLevel, aiUrgency)) {
    return null;
  }

  const handleCopy = async () => {
    if (!summaryText) return;
    await navigator.clipboard.writeText(summaryText);
    toast.success('Resumo copiado para a área de transferência');
  };

  return (
    <Card className="border-primary/20 bg-primary/[0.02] shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 flex-1">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden />
            <span className="font-semibold text-sm">Copiloto IA</span>
          </div>
          {riskBadge && (
            <Badge variant="outline" className={riskBadge.color}>
              {riskBadge.label}
            </Badge>
          )}
          {aiUrgency && (
            <Badge variant="outline" className={getUrgencyColor(aiUrgency)}>
              {getUrgencyLabel(aiUrgency)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" aria-hidden />
          <span className="italic">Gerado por IA — revisão médica obrigatória</span>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        {summaryText.length > 0 && (
          <>
            <div
              className={`transition-all duration-200 ${
                !expanded && summaryText.length > 200 ? 'max-h-[120px] overflow-hidden' : ''
              }`}
            >
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{summaryText}</p>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border/50">
              <Button variant="outline" size="sm" onClick={handleCopy} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copiar resumo
              </Button>
              {summaryText.length > 200 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setExpanded((e) => !e)}
                  className="gap-1.5"
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Ver menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Expandir
                    </>
                  )}
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
