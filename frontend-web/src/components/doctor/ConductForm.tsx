/**
 * ConductForm — Formulário estruturado de conduta/prontuário.
 * 4 campos: Queixa/Duração, Evolução/Anamnese, Hipótese (CID), Conduta.
 * Paridade com mobile ConductForm.
 */
import { useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Lightbulb, FileText, Check } from 'lucide-react';
import { toast } from 'sonner';

export interface ConductFormData {
  queixaDuracao: string;
  evolucao: string;
  hipoteseCid: string;
  conduta: string;
}

function parseStructuredFromLegacy(text: string): ConductFormData {
  const lines = text.split('\n');
  const result: ConductFormData = { queixaDuracao: '', evolucao: '', hipoteseCid: '', conduta: '' };
  const buffer: Record<keyof ConductFormData, string[]> = {
    queixaDuracao: [],
    evolucao: [],
    hipoteseCid: [],
    conduta: [],
  };
  let current: keyof ConductFormData | null = null;

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    if (lower.startsWith('queixa')) {
      current = 'queixaDuracao';
      continue;
    }
    if (lower.startsWith('evolu') || lower.startsWith('anamnese')) {
      current = 'evolucao';
      continue;
    }
    if (lower.startsWith('hipóte') || lower.startsWith('hipote') || lower.startsWith('cid')) {
      current = 'hipoteseCid';
      continue;
    }
    if (lower.startsWith('conduta')) {
      current = 'conduta';
      continue;
    }
    if (current) buffer[current].push(line);
  }

  result.queixaDuracao = buffer.queixaDuracao.join('\n').trim();
  result.evolucao = buffer.evolucao.join('\n').trim();
  result.hipoteseCid = buffer.hipoteseCid.join('\n').trim();
  result.conduta = buffer.conduta.join('\n').trim();

  if (!result.queixaDuracao && !result.evolucao && !result.hipoteseCid && !result.conduta) {
    result.conduta = text.trim();
  }
  return result;
}

function combineToConductText(data: ConductFormData): string {
  const parts: string[] = [];
  if (data.queixaDuracao.trim()) parts.push(`Queixa e duração: ${data.queixaDuracao.trim()}`);
  if (data.evolucao.trim()) parts.push(`Evolução / Anamnese: ${data.evolucao.trim()}`);
  if (data.hipoteseCid.trim()) parts.push(`Hipótese diagnóstica (CID): ${data.hipoteseCid.trim()}`);
  if (data.conduta.trim()) parts.push(`Conduta: ${data.conduta.trim()}`);
  return parts.join('\n\n');
}

function parseAnamnesisForPrefill(json: string | null | undefined): Record<string, unknown> | null {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export interface ConductFormProps {
  initialData?: Partial<ConductFormData>;
  legacyConductNotes?: string;
  aiSuggestion?: string | null;
  anamnesisJson?: string | null;
  includeConductInPdf: boolean;
  onIncludeConductInPdfChange: (v: boolean) => void;
  saving: boolean;
  onSave: (data: ConductFormData, combinedText: string) => void;
}

export function ConductForm({
  initialData,
  legacyConductNotes,
  aiSuggestion,
  anamnesisJson,
  includeConductInPdf,
  onIncludeConductInPdfChange,
  saving,
  onSave,
}: ConductFormProps) {
  const initial = useMemo(() => {
    if (legacyConductNotes?.trim()) {
      return parseStructuredFromLegacy(legacyConductNotes);
    }
    return {
      queixaDuracao: initialData?.queixaDuracao ?? '',
      evolucao: initialData?.evolucao ?? '',
      hipoteseCid: initialData?.hipoteseCid ?? '',
      conduta: initialData?.conduta ?? '',
    };
  }, [legacyConductNotes, initialData]);

  const [form, setForm] = useState<ConductFormData>(initial);

  const setField = useCallback((key: keyof ConductFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(() => {
    const combined = combineToConductText(form);
    onSave(form, combined);
  }, [form, onSave]);

  const isEmpty =
    !form.queixaDuracao.trim() &&
    !form.evolucao.trim() &&
    !form.hipoteseCid.trim() &&
    !form.conduta.trim();

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion) return;
    const parsed = parseStructuredFromLegacy(aiSuggestion);
    if (parsed.queixaDuracao || parsed.evolucao || parsed.hipoteseCid || parsed.conduta) {
      setForm(parsed);
    } else {
      setForm((prev) => ({
        ...prev,
        conduta: prev.conduta ? `${prev.conduta}\n\n${aiSuggestion}` : aiSuggestion,
      }));
    }
    toast.success('Sugestão da IA aplicada');
  }, [aiSuggestion]);

  const prefillFromAnamnesis = useCallback(() => {
    const anamnesis = parseAnamnesisForPrefill(anamnesisJson);
    if (!anamnesis) return;
    setForm((prev) => {
      const next = { ...prev };
      if (!next.queixaDuracao.trim() && anamnesis.queixa_principal) {
        next.queixaDuracao = String(anamnesis.queixa_principal);
      }
      if (!next.evolucao.trim() && anamnesis.historia_doenca_atual) {
        next.evolucao = String(anamnesis.historia_doenca_atual);
      }
      if (!next.hipoteseCid.trim() && Array.isArray(anamnesis.diagnostico_diferencial)) {
        const dd = anamnesis.diagnostico_diferencial as Array<Record<string, string>>;
        if (dd.length > 0 && dd[0]) {
          const cid = dd[0].cid ?? '';
          const hipotese = dd[0].hipotese ?? '';
          if (cid || hipotese) {
            next.hipoteseCid = cid && hipotese ? `${cid} — ${hipotese}` : (cid || hipotese);
          }
        }
      }
      return next;
    });
    toast.success('Dados da anamnese aplicados');
  }, [anamnesisJson]);

  const FIELDS: { key: keyof ConductFormData; label: string; placeholder: string }[] = [
    {
      key: 'queixaDuracao',
      label: 'Queixa e duração',
      placeholder: 'Ex.: Dor lombar há 3 dias, de início súbito...',
    },
    {
      key: 'evolucao',
      label: 'Evolução / Anamnese',
      placeholder: 'Ex.: Paciente refere piora progressiva, sem irradiação...',
    },
    {
      key: 'hipoteseCid',
      label: 'Hipótese diagnóstica (CID)',
      placeholder: 'Ex.: M54.5 — Dor lombar baixa',
    },
    {
      key: 'conduta',
      label: 'Conduta',
      placeholder: 'Ex.: Visando continuidade do tratamento, prescrevo...',
    },
  ];

  return (
    <Card className="shadow-sm border-l-4 border-l-primary">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" aria-hidden />
          Prontuário / Conduta
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Campos estruturados para registro clínico padronizado
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {aiSuggestion && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
              <span className="font-semibold text-sm">Sugestão de conduta da IA</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">{aiSuggestion}</p>
            <Button variant="outline" size="sm" onClick={applyAiSuggestion} className="gap-1.5">
              <Lightbulb className="h-3.5 w-3.5" />
              Usar sugestão da IA
            </Button>
          </div>
        )}

        {anamnesisJson && isEmpty && (
          <Button variant="outline" size="sm" onClick={prefillFromAnamnesis} className="gap-1.5">
            Preencher a partir da anamnese
          </Button>
        )}

        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`conduct-${key}`}>{label}</Label>
            <Textarea
              id={`conduct-${key}`}
              placeholder={placeholder}
              value={form[key]}
              onChange={(e) => setField(key, e.target.value)}
              rows={key === 'evolucao' || key === 'conduta' ? 3 : 2}
              className="resize-none"
            />
          </div>
        ))}

        <div className="flex items-center gap-2">
          <button
            type="button"
            role="checkbox"
            aria-checked={includeConductInPdf}
            onClick={() => onIncludeConductInPdfChange(!includeConductInPdf)}
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 ${
              includeConductInPdf ? 'bg-primary border-primary' : 'border-muted-foreground'
            }`}
          >
            {includeConductInPdf && <Check className="w-3 h-3 text-primary-foreground" />}
          </button>
          <Label
            htmlFor="include-conduct-pdf"
            className="text-sm font-normal cursor-pointer"
            onClick={() => onIncludeConductInPdfChange(!includeConductInPdf)}
          >
            Incluir conduta no PDF
          </Label>
        </div>

        <Button onClick={handleSave} disabled={isEmpty || saving} className="w-full">
          {saving ? 'Salvando...' : 'Salvar no prontuário'}
        </Button>
      </CardContent>
    </Card>
  );
}
