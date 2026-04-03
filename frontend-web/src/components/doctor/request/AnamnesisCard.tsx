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

function safeArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const p = JSON.parse(val);
      if (Array.isArray(p)) return p;
    } catch {
      /* invalid JSON */
    }
  }
  return [];
}

function parseAnamnesis(
  json: string | null | undefined
): Record<string, unknown> | null {
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

  const meds = safeArray<MedOrString>(data.medicamentos_sugeridos);
  const exams = safeArray<ExamOrString>(data.exames_sugeridos);
  const alerts = safeArray<string>(data.alertas_vermelhos);
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
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-primary" />
            Anamnese estruturada
            <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold">
              <Sparkles className="h-3 w-3" /> IA
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            className="gap-1.5"
          >
            <Copy className="h-3.5 w-3.5" />
            Copiar
          </Button>
        </div>
        <p className="text-xs italic text-muted-foreground">
          Gerado por IA — revisão médica obrigatória. CFM Res. 2.299/2021.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {gravidade && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium',
              gravidadeColors[gravidade] ?? 'bg-muted text-muted-foreground'
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {gravidade === 'verde' && 'Baixa gravidade'}
            {gravidade === 'amarelo' && 'Gravidade moderada'}
            {gravidade === 'laranja' && 'Gravidade moderada-alta'}
            {gravidade === 'vermelho' && 'Gravidade alta'}
          </span>
        )}

        {alerts.length > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
            <p className="mb-2 text-xs font-bold text-red-700 dark:text-red-400">
              ALERTAS DE GRAVIDADE
            </p>
            <ul className="space-y-1">
              {alerts.map((a, i) => (
                <li
                  key={i}
                  className="flex gap-2 text-sm text-red-600 dark:text-red-300"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasMeds && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Medicamentos sugeridos
            </p>
            <div className="flex flex-wrap gap-2">
              {meds.map((m, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(displayMedicamento(m));
                    toast.success('Copiado!');
                  }}
                  className="rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
                >
                  {displayMedicamento(m)}
                </button>
              ))}
            </div>
          </div>
        )}

        {hasExams && (
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              Exames sugeridos
            </p>
            <div className="flex flex-wrap gap-2">
              {exams.map((e, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(displayExame(e));
                    toast.success('Copiado!');
                  }}
                  className="rounded-lg bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800 transition-colors hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:hover:bg-amber-900/50"
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
