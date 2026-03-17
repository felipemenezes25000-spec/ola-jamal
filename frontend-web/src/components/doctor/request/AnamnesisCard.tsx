/**
 * AnamnesisCard — Card de anamnese estruturada (web).
 * Alinhado ao mobile AnamnesisCard: medicamentos/exames sugeridos + botões de ação.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Copy, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MedicamentoSugerido {
  nome?: string;
  dose?: string;
  via?: string;
  posologia?: string;
  duracao?: string;
  indicacao?: string;
}

interface ExameSugerido {
  nome?: string;
  descricao?: string;
  codigo_tuss?: string;
}

type MedOrString = MedicamentoSugerido | string;
type ExamOrString = ExameSugerido | string;

function displayMedicamento(m: MedOrString): string {
  if (typeof m === 'string') return m;
  const parts = [m.nome, m.dose, m.via, m.posologia, m.duracao].filter(Boolean);
  const base = parts.join(' ');
  return m.indicacao ? `${base} (${m.indicacao})` : base;
}

function displayExame(e: ExamOrString): string {
  if (typeof e === 'string') return e;
  return e.nome ?? '';
}

function parseAnamnesis(json: string | null | undefined): Record<string, unknown> | null {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

interface AnamnesisCardProps {
  consultationAnamnesis: string | null | undefined;
  className?: string;
}

export function AnamnesisCard({
  consultationAnamnesis,
  className,
}: AnamnesisCardProps) {
  const data = parseAnamnesis(consultationAnamnesis);
  if (!data) return null;

  const meds = (data.medicamentos_sugeridos as MedOrString[] | undefined) ?? [];
  const exams = (data.exames_sugeridos as ExamOrString[] | undefined) ?? [];
  const alerts = (data.alertas_vermelhos as string[] | undefined) ?? [];
  const gravidade = data.classificacao_gravidade as string | undefined;

  const hasMeds = meds.length > 0;
  const hasExams = exams.length > 0;
  const hasContent = hasMeds || hasExams || alerts.length > 0 || gravidade;

  if (!hasContent) return null;

  const handleCopy = async () => {
    const text = JSON.stringify(data, null, 2);
    await navigator.clipboard.writeText(text);
    toast.success('Anamnese copiada');
  };

  const gravidadeColors: Record<string, string> = {
    verde: 'bg-emerald-100 text-emerald-700',
    amarelo: 'bg-amber-100 text-amber-700',
    laranja: 'bg-orange-100 text-orange-700',
    vermelho: 'bg-red-100 text-red-700',
  };

  return (
    <Card className={cn('border-l-4 border-l-primary', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Anamnese estruturada
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-xs font-semibold">
              <Sparkles className="h-3 w-3" /> IA
            </span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </Button>
        </div>
        <p className="text-xs text-muted-foreground italic">
          Gerado por IA — revisão médica obrigatória. CFM Res. 2.299/2021.
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">
        {gravidade && (
          <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium', gravidadeColors[gravidade] ?? 'bg-muted text-muted-foreground')}>
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            {gravidade === 'verde' && 'Baixa gravidade'}
            {gravidade === 'amarelo' && 'Gravidade moderada'}
            {gravidade === 'laranja' && 'Gravidade moderada-alta'}
            {gravidade === 'vermelho' && 'Gravidade alta'}
          </span>
        )}

        {alerts.length > 0 && (
          <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-2">ALERTAS DE GRAVIDADE</p>
            <ul className="space-y-1">
              {alerts.map((a, i) => (
                <li key={i} className="text-sm text-red-600 dark:text-red-300 flex gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasMeds && (
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Medicamentos sugeridos</p>
            <div className="flex flex-wrap gap-2">
              {meds.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(displayMedicamento(m));
                    toast.success('Copiado!');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-sm font-medium text-primary transition-colors"
                >
                  {displayMedicamento(m)}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasExams && (
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Exames sugeridos</p>
            <div className="flex flex-wrap gap-2">
              {exams.map((e, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(displayExame(e));
                    toast.success('Copiado!');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-100 dark:bg-amber-900/30 hover:bg-amber-200 dark:hover:bg-amber-900/50 text-sm font-medium text-amber-800 dark:text-amber-200 transition-colors"
                >
                  {displayExame(e)}
                </button>
              ))}
            </div>
          </div>
        )}

      </CardContent>
    </Card>
  );
}
