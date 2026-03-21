/**
 * ConductForm — Formulário estruturado de conduta/prontuário (web).
 *
 * Alinhado 100% com o mobile ConductForm (529 linhas):
 * - 4 campos: Queixa/Duração, Evolução/Anamnese, Hipótese (CID), Conduta
 * - Auto-prefill a partir da anamnese IA (pós-consulta)
 * - Botão "Aplicar sugestão da IA"
 * - Botão "Preencher com anamnese"
 * - Toggle "Incluir conduta no PDF"
 * - Parse bidirecional: legado (texto único) ↔ estruturado (4 campos)
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { updateConduct } from '@/services/doctor-api-consultation';
import { toast } from 'sonner';
import {
  FileText, Loader2, Lightbulb, Sparkles, MessageCircle,
  Clock, Code, Clipboard, Save, Copy, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──

export interface ConductFormData {
  queixaDuracao: string;
  evolucao: string;
  hipoteseCid: string;
  conduta: string;
}

interface ConductFormProps {
  requestId: string;
  initialNotes: string;
  initialIncludeInPdf: boolean;
  aiSuggestion?: string | null;
  anamnesisJson?: string | null;
  consultationTranscript?: string | null;
  consultationSuggestions?: string[];
  onSaved?: () => void;
  className?: string;
}

// ── Parse helpers (aligned with mobile) ──

function parseAnamnesis(json: string | null | undefined): Record<string, unknown> | null {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function displayMedicamento(m: unknown): string {
  if (typeof m === 'string') return m;
  if (typeof m !== 'object' || !m) return '';
  const obj = m as Record<string, string>;
  const parts = [obj.nome, obj.dose, obj.via, obj.posologia, obj.duracao].filter(Boolean);
  const base = parts.join(' ');
  return obj.indicacao ? `${base} (${obj.indicacao})` : base;
}

function displayExame(e: unknown): string {
  if (typeof e === 'string') return e;
  if (typeof e !== 'object' || !e) return '';
  return (e as Record<string, string>).nome ?? '';
}

function parseStructuredFromLegacy(text: string): ConductFormData {
  const lines = text.split('\n');
  const result: ConductFormData = { queixaDuracao: '', evolucao: '', hipoteseCid: '', conduta: '' };
  let current: keyof ConductFormData | null = null;
  const buffer: Record<string, string[]> = {
    queixaDuracao: [], evolucao: [], hipoteseCid: [], conduta: [],
  };

  for (const line of lines) {
    const lower = line.toLowerCase().trim();
    if (lower.startsWith('queixa')) { current = 'queixaDuracao'; continue; }
    if (lower.startsWith('evolu') || lower.startsWith('anamnese')) { current = 'evolucao'; continue; }
    if (lower.startsWith('hipóte') || lower.startsWith('hipote') || lower.startsWith('cid')) { current = 'hipoteseCid'; continue; }
    if (lower.startsWith('conduta')) { current = 'conduta'; continue; }
    if (current) buffer[current].push(line);
  }

  result.queixaDuracao = buffer.queixaDuracao.join('\n').trim();
  result.evolucao = buffer.evolucao.join('\n').trim();
  result.hipoteseCid = buffer.hipoteseCid.join('\n').trim();
  result.conduta = buffer.conduta.join('\n').trim();

  // Se nenhum heading encontrado, colocar tudo em conduta
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

// ── Field definitions ──

const FIELDS: {
  key: keyof ConductFormData;
  label: string;
  placeholder: string;
  rows: number;
  icon: React.ElementType;
}[] = [
  {
    key: 'queixaDuracao',
    label: 'Queixa e duração',
    placeholder: 'Ex.: Dor lombar há 3 dias, de início súbito...',
    rows: 2,
    icon: MessageCircle,
  },
  {
    key: 'evolucao',
    label: 'Evolução / Anamnese',
    placeholder: 'Ex.: Paciente refere piora progressiva, sem irradiação, uso de analgésico sem melhora...',
    rows: 3,
    icon: Clock,
  },
  {
    key: 'hipoteseCid',
    label: 'Hipótese diagnóstica (CID)',
    placeholder: 'Ex.: M54.5 — Dor lombar baixa',
    rows: 1,
    icon: Code,
  },
  {
    key: 'conduta',
    label: 'Conduta',
    placeholder: 'Ex.: Visando continuidade do tratamento, prescrevo...',
    rows: 3,
    icon: Clipboard,
  },
];

/** Extract CID from the first diagnostico_diferencial item. */
function extractCid(anamnesis: Record<string, unknown> | null): string {
  if (!anamnesis) return '';
  const dd = anamnesis.diagnostico_diferencial;
  if (!Array.isArray(dd) || dd.length === 0) return '';
  const first = dd[0] as Record<string, string> | undefined;
  if (!first) return '';
  const cid = first.cid ?? '';
  const hipotese = first.hipotese ?? '';
  if (cid && hipotese) return `${cid} — ${hipotese}`;
  return cid || hipotese;
}

// ── Component ──

export function ConductForm({
  requestId,
  initialNotes,
  initialIncludeInPdf,
  aiSuggestion,
  anamnesisJson,
  consultationTranscript,
  consultationSuggestions,
  onSaved,
  className,
}: ConductFormProps) {
  const [includeInPdf, setIncludeInPdf] = useState(initialIncludeInPdf);
  const [saving, setSaving] = useState(false);
  const [aiExpanded, setAiExpanded] = useState(false);
  const autoPrefillDone = useRef(false);

  // Parse initial data
  const initial = useMemo(() => {
    if (initialNotes?.trim()) return parseStructuredFromLegacy(initialNotes);
    return { queixaDuracao: '', evolucao: '', hipoteseCid: '', conduta: '' };
  }, [initialNotes]);

  const [form, setForm] = useState<ConductFormData>(initial);

  // Auto-prefill from AI anamnesis (post-consultation, same logic as mobile)
  useEffect(() => {
    if (autoPrefillDone.current) return;
    const empty = !form.queixaDuracao.trim() && !form.evolucao.trim() && !form.hipoteseCid.trim() && !form.conduta.trim();
    if (!empty) return;
    if (!anamnesisJson && !aiSuggestion) return;

    autoPrefillDone.current = true;

    // Try structured parse from AI suggestion first
    if (aiSuggestion) {
      const parsed = parseStructuredFromLegacy(aiSuggestion);
      if (parsed.queixaDuracao || parsed.evolucao || parsed.hipoteseCid || parsed.conduta) {
        setForm(parsed);
        return;
      }
    }

    const anamnesis = parseAnamnesis(anamnesisJson);
    if (anamnesis) {
      setForm((prev) => {
        const next = { ...prev };
        if (!next.queixaDuracao.trim() && typeof anamnesis.queixa_principal === 'string') {
          next.queixaDuracao = anamnesis.queixa_principal;
        }
        if (!next.evolucao.trim() && typeof anamnesis.historia_doenca_atual === 'string') {
          next.evolucao = anamnesis.historia_doenca_atual;
        }
        if (!next.evolucao.trim() && consultationTranscript?.trim()) {
          next.evolucao = consultationTranscript.trim();
        }
        if (!next.hipoteseCid.trim()) {
          const cidFromDiag = extractCid(anamnesis);
          if (cidFromDiag) next.hipoteseCid = cidFromDiag;
        }
        if (!next.conduta.trim() && aiSuggestion) {
          next.conduta = aiSuggestion;
        }
        if (!next.conduta.trim() && consultationSuggestions?.length) {
          next.conduta = consultationSuggestions.join('\n\n').trim();
        }
        if (!next.conduta.trim()) {
          const condutaParts: string[] = [];
          const meds = anamnesis.medicamentos_sugeridos;
          if (Array.isArray(meds) && meds.length > 0) {
            condutaParts.push('Medicamentos: ' + meds.map((m) => displayMedicamento(m)).join('; '));
          }
          const exams = anamnesis.exames_sugeridos;
          if (Array.isArray(exams) && exams.length > 0) {
            condutaParts.push('Exames: ' + exams.map((e) => displayExame(e)).join('; '));
          }
          const orient = anamnesis.orientacoes_paciente;
          if (Array.isArray(orient) && orient.length > 0) {
            condutaParts.push('Orientações: ' + orient.join('; '));
          }
          if (condutaParts.length > 0) next.conduta = condutaParts.join('\n\n');
        }
        return next;
      });
    }
  }, [form, anamnesisJson, aiSuggestion, consultationTranscript, consultationSuggestions]);

  const setField = useCallback((key: keyof ConductFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const combined = combineToConductText(form);
      await updateConduct(requestId, { conductNotes: combined, includeConductInPdf: includeInPdf });
      toast.success('Conduta salva');
      onSaved?.();
    } catch {
      toast.error('Erro ao salvar conduta');
    } finally {
      setSaving(false);
    }
  }, [form, requestId, includeInPdf, onSaved]);

  const applyAiSuggestion = useCallback(() => {
    if (!aiSuggestion?.trim()) return;
    const parsed = parseStructuredFromLegacy(aiSuggestion);
    if (parsed.queixaDuracao || parsed.evolucao || parsed.hipoteseCid || parsed.conduta) {
      setForm(parsed);
    } else {
      setForm((prev) => ({ ...prev, conduta: prev.conduta ? `${prev.conduta}\n\n${aiSuggestion}` : aiSuggestion }));
    }
    toast.success('Sugestão da IA aplicada');
  }, [aiSuggestion]);

  const prefillFromAnamnesis = useCallback(() => {
    const anamnesis = parseAnamnesis(anamnesisJson);
    if (!anamnesis) { toast.info('Anamnese não disponível'); return; }

    setForm((prev) => {
      const next = { ...prev };
      if (!next.queixaDuracao.trim() && typeof anamnesis.queixa_principal === 'string') {
        next.queixaDuracao = anamnesis.queixa_principal;
      }
      if (!next.evolucao.trim() && typeof anamnesis.historia_doenca_atual === 'string') {
        next.evolucao = anamnesis.historia_doenca_atual;
      }
      if (!next.hipoteseCid.trim()) {
        const cidFromDiag = extractCid(anamnesis);
        if (cidFromDiag) next.hipoteseCid = cidFromDiag;
      }
      return next;
    });
    toast.success('Dados da anamnese aplicados');
  }, [anamnesisJson]);

  const handleCopyAll = useCallback(async () => {
    const text = combineToConductText(form);
    if (!text.trim()) { toast.info('Nenhum dado para copiar'); return; }
    await navigator.clipboard.writeText(text);
    toast.success('Conduta copiada');
  }, [form]);

  const isEmpty = !form.queixaDuracao.trim() && !form.evolucao.trim() && !form.hipoteseCid.trim() && !form.conduta.trim();
  const hasAnamnesis = !!parseAnamnesis(anamnesisJson);

  return (
    <Card className={cn('shadow-sm', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" aria-hidden />
            Prontuário / Conduta
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleCopyAll} className="gap-1.5 text-xs" disabled={isEmpty}>
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Campos estruturados para registro clínico padronizado
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-4">

        {/* AI Suggestion section */}
        {aiSuggestion?.trim() && (
          <div className="rounded-lg border border-primary/20 bg-primary/[0.03] overflow-hidden">
            <button
              type="button"
              onClick={() => setAiExpanded(!aiExpanded)}
              className="flex items-center justify-between w-full p-3 text-left hover:bg-primary/[0.05] transition-colors"
            >
              <span className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Lightbulb className="h-4 w-4" />
                Sugestão da IA
                <span className="text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded">IA</span>
              </span>
              {aiExpanded ? <ChevronUp className="h-4 w-4 text-primary" /> : <ChevronDown className="h-4 w-4 text-primary" />}
            </button>
            {aiExpanded && (
              <div className="px-3 pb-3 space-y-2 border-t border-primary/10">
                <p className="text-sm text-muted-foreground whitespace-pre-wrap pt-2">
                  {aiSuggestion.length > 500 ? aiSuggestion.slice(0, 500) + '...' : aiSuggestion}
                </p>
                <Button variant="outline" size="sm" onClick={applyAiSuggestion} className="gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Aplicar sugestão
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Prefill from anamnesis button */}
        {hasAnamnesis && isEmpty && (
          <Button variant="outline" size="sm" onClick={prefillFromAnamnesis} className="gap-1.5 w-full">
            <Sparkles className="h-3.5 w-3.5" /> Preencher com dados da anamnese
          </Button>
        )}

        {/* 4 structured fields */}
        {FIELDS.map(({ key, label, placeholder, rows, icon: FieldIcon }) => (
          <div key={key} className="space-y-1.5">
            <Label htmlFor={`conduct-${key}`} className="text-sm font-medium flex items-center gap-1.5">
              <FieldIcon className="h-3.5 w-3.5 text-muted-foreground" />
              {label}
            </Label>
            <Textarea
              id={`conduct-${key}`}
              value={form[key]}
              onChange={(e) => setField(key, e.target.value)}
              placeholder={placeholder}
              rows={rows}
              className="text-sm resize-y"
            />
          </div>
        ))}

        {/* Toggle include in PDF */}
        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="include-conduct-pdf"
            checked={includeInPdf}
            onChange={(e) => setIncludeInPdf(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <Label htmlFor="include-conduct-pdf" className="text-sm font-normal cursor-pointer">
            Incluir conduta no PDF do documento assinado
          </Label>
        </div>

        {/* Save button */}
        <Button onClick={handleSave} disabled={saving} className="gap-2 w-full sm:w-auto">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar conduta
        </Button>
      </CardContent>
    </Card>
  );
}
