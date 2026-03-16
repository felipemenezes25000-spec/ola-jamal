import React from 'react';
/**
 * ConsultationPostSection — Seção pós-consulta: anamnese, sugestões IA, evidências, transcrição.
 * Aparece quando type === 'consultation' e status inclui consultation_finished.
 */
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Lightbulb,
  BookOpen,
  Mic,
  Copy,
  FileText,
  FlaskConical,
  ExternalLink,
  Info,
  ClipboardCopy,
} from 'lucide-react';
import { toast } from 'sonner';
import { normalizeStatus } from '@/lib/doctor-helpers';
import type { MedicalRequest } from '@/services/doctorApi';

function parseAnamnesis(json: string | null | undefined): Record<string, unknown> | null {
  if (!json?.trim()) return null;
  try {
    const parsed = JSON.parse(json);
    return typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function parseSuggestions(json: string | null | undefined): string[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

interface SoapNotes {
  subjective?: string; objective?: string; assessment?: string; plan?: string;
  medical_terms?: { term: string; category: string; icd_code?: string | null }[];
}

function parseSoapNotes(json: string | null | undefined): SoapNotes | null {
  if (!json?.trim()) return null;
  try { return JSON.parse(json) as SoapNotes; } catch { return null; }
}

const SOAP_LABELS: Record<string, string> = {
  subjective: 'S — Subjetivo', objective: 'O — Objetivo',
  assessment: 'A — Avaliação', plan: 'P — Plano',
};

function renderAnamnesisField(obj: Record<string, unknown>): React.ReactNode[] {
  const keys = Object.keys(obj).filter((k) => !['medicamentos_sugeridos', 'exames_sugeridos'].includes(k));
  return keys.map((key) => {
    const v = obj[key];
    if (v == null || (typeof v === 'string' && !v.trim())) return null;
    const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    const val = Array.isArray(v) ? v.join(', ') : String(v);
    return (
      <div key={key} className="space-y-1">
        <p className="text-xs font-semibold text-primary uppercase tracking-wide">{label}</p>
        <p className="text-sm text-muted-foreground">{val}</p>
      </div>
    );
  });
}

export interface ConsultationPostSectionProps {
  request: MedicalRequest;
  requestId: string;
}

export function ConsultationPostSection({ request, requestId }: ConsultationPostSectionProps) {
  const navigate = useNavigate();
  const isConsultation = request.type === 'consultation';
  const isFinished = normalizeStatus(request.status) === 'consultation_finished';

  if (!isConsultation || !isFinished) return null;

  const anamnesis = parseAnamnesis(request.consultationAnamnesis);
  const suggestions = parseSuggestions(request.consultationAiSuggestions);
  const transcript = request.consultationTranscript?.trim() ?? '';
  const soapNotes = parseSoapNotes(request.consultationSoapNotes);

  const hasContent = anamnesis || suggestions.length > 0 || transcript || !!soapNotes;
  if (!hasContent) return null;

  const handleCopyTranscript = async () => {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    toast.success('Transcrição copiada');
  };

  const examsArr = (anamnesis?.exames_sugeridos as unknown[]) ?? [];
  const hasExams = examsArr.length > 0;

  return (
    <div className="space-y-4">
      {anamnesis && Object.keys(anamnesis).length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Anamnese estruturada</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-4">
            {renderAnamnesisField(anamnesis)}
          </CardContent>
        </Card>
      )}

      {soapNotes && (
        <Card className="shadow-sm border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" aria-hidden />
                Notas SOAP
                <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-0.5 rounded-md">IA</span>
              </CardTitle>
              <Button
                variant="ghost" size="sm"
                onClick={async () => {
                  const text = (['subjective','objective','assessment','plan'] as (keyof SoapNotes)[])
                    .map(k => ${SOAP_LABELS[k]}\n)
                    .join('\n\n');
                  await navigator.clipboard.writeText(text);
                  toast.success('Notas SOAP copiadas');
                }}
                className="gap-1.5"
              >
                <ClipboardCopy className="h-3.5 w-3.5" /> Copiar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            {(['subjective','objective','assessment','plan'] as (keyof SoapNotes)[]).map(k => {
              const val = soapNotes[k] as string | undefined;
              if (!val) return null;
              return (
                <div key={k} className="p-3 rounded-lg bg-muted/40 border border-border/40">
                  <p className="text-xs font-semibold text-primary uppercase tracking-wide mb-1">{SOAP_LABELS[k]}</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{val}</p>
                </div>
              );
            })}
            {(soapNotes.medical_terms ?? []).length > 0 && (
              <div className="pt-2 border-t border-border/30">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Termos médicos</p>
                <div className="flex flex-wrap gap-2">
                  {soapNotes.medical_terms!.map((t, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                      {t.term}{t.icd_code ?  () : ''}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {suggestions.length > 0 && (
        <Card className="shadow-sm border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" aria-hidden />
              Sugestões clínicas da IA
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ul className="space-y-2">
              {suggestions.map((item, i) => {
                const isRedFlag = item.startsWith('🚨');
                return (
                  <li
                    key={i}
                    className={`flex items-start gap-2 text-sm ${
                      isRedFlag ? 'text-destructive' : 'text-muted-foreground'
                    }`}
                  >
                    <Lightbulb className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{item.replace('🚨 ', '')}</span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir artigo
                  </a>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {transcript && (
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Mic className="h-4 w-4 text-primary" aria-hidden />
                Transcrição da consulta
              </CardTitle>
              <Button variant="outline" size="sm" onClick={handleCopyTranscript} className="gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
              Transcrição automática — pode conter imprecisões.
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{transcript}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row gap-2">
        <Button
          className="gap-2"
          onClick={() => {
            const meds = (anamnesis?.medicamentos_sugeridos as unknown[]) ?? [];
            const prefillMeds = meds.length > 0 ? JSON.stringify(meds) : undefined;
            navigate(`/pedidos/${requestId}/editor`, {
              state: prefillMeds ? { prefillMeds } : undefined,
            });
          }}
        >
          <FileText className="h-4 w-4" />
          Criar Receita Baseada na Consulta
        </Button>
        {hasExams && (
          <Button variant="outline" className="gap-2" disabled>
            <FlaskConical className="h-4 w-4" />
            Criar Pedido de Exame Baseado na Consulta (em breve)
          </Button>
        )}
      </div>
    </div>
  );
}

