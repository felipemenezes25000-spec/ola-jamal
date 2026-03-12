/**
 * DoctorAIPanel — Painel lateral do médico durante a videoconsulta (web).
 * Alinhado ao mobile: gravidade Manchester, CID, alertas, diferencial,
 * anamnese completa, medicamentos, exames, orientações, perguntas, evidências.
 */
import { useState, useMemo, useCallback } from 'react';
import { Clipboard, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import type {
  TabKey,
  MedSugerido,
  ExameSugerido,
  DiagDiferencial,
  PerguntaSugerida,
  InteracaoCruzada,
  EvidenceItem,
} from './ai-panel/types';
import {
  TABS,
  ANA_FIELDS,
  parseMed,
  parseExam,
} from './ai-panel/types';
import { AIIndicators } from './ai-panel/AIIndicators';
import { AISuggestionView } from './ai-panel/AISuggestionView';
import { AIMetadataPanel } from './ai-panel/AIMetadataPanel';

interface DoctorAIPanelProps {
  anamnesis: Record<string, unknown> | null;
  suggestions: (string | { text?: string; suggestion?: string })[];
  evidence: EvidenceItem[];
}

export function DoctorAIPanel({ anamnesis, suggestions, evidence }: DoctorAIPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('consulta');
  const [expandedEvidence, setExpandedEvidence] = useState<Set<number>>(new Set());
  const [expandedMeds, setExpandedMeds] = useState<Set<number>>(new Set());

  const cidSugerido = (anamnesis?.cid_sugerido as string) ?? '';
  const cidDescricao = (anamnesis?.cid_descricao as string) ?? '';
  const confiancaCid = (anamnesis?.confianca_cid as string) ?? '';
  const denominadorComum = (anamnesis?.denominador_comum as string)?.trim() || undefined;
  const gravidade = (anamnesis?.classificacao_gravidade as string) ?? '';
  const diagDiferencial: DiagDiferencial[] = useMemo(() => {
    try {
      return Array.isArray(anamnesis?.diagnostico_diferencial)
        ? (anamnesis!.diagnostico_diferencial as DiagDiferencial[])
        : [];
    } catch {
      return [];
    }
  }, [anamnesis]);
  const exameFisicoDirigido = (anamnesis?.exame_fisico_dirigido as string) ?? '';
  const orientacoesPaciente: string[] = useMemo(() => {
    try {
      return Array.isArray(anamnesis?.orientacoes_paciente) ? (anamnesis!.orientacoes_paciente as string[]) : [];
    } catch {
      return [];
    }
  }, [anamnesis]);
  const criteriosRetorno: string[] = useMemo(() => {
    try {
      return Array.isArray(anamnesis?.criterios_retorno) ? (anamnesis!.criterios_retorno as string[]) : [];
    } catch {
      return [];
    }
  }, [anamnesis]);
  const perguntasSugeridas: PerguntaSugerida[] = useMemo(() => {
    try {
      if (!Array.isArray(anamnesis?.perguntas_sugeridas)) return [];
      return (anamnesis!.perguntas_sugeridas as unknown[]).map((p: unknown) =>
        typeof p === 'string'
          ? { pergunta: p, objetivo: '', hipoteses_afetadas: '', impacto_na_conduta: '', prioridade: 'media' as const }
          : {
              pergunta: (p as PerguntaSugerida).pergunta ?? '',
              objetivo: (p as PerguntaSugerida).objetivo ?? '',
              hipoteses_afetadas: (p as PerguntaSugerida).hipoteses_afetadas ?? '',
              impacto_na_conduta: (p as PerguntaSugerida).impacto_na_conduta ?? '',
              prioridade: ((p as PerguntaSugerida).prioridade ?? 'media') as 'alta' | 'media' | 'baixa',
            }
      ).filter((p: PerguntaSugerida) => p.pergunta.length > 0);
    } catch {
      return [];
    }
  }, [anamnesis]);
  const lacunasAnamnese: string[] = useMemo(() => {
    try {
      return Array.isArray(anamnesis?.lacunas_anamnese) ? (anamnesis!.lacunas_anamnese as string[]) : [];
    } catch {
      return [];
    }
  }, [anamnesis]);
  const alertasVermelhos: string[] = useMemo(() => {
    try {
      return Array.isArray(anamnesis?.alertas_vermelhos) ? (anamnesis!.alertas_vermelhos as string[]) : [];
    } catch {
      return [];
    }
  }, [anamnesis]);
  const meds: MedSugerido[] = useMemo(() => {
    try {
      return Array.isArray(anamnesis?.medicamentos_sugeridos) ? (anamnesis!.medicamentos_sugeridos as MedSugerido[]) : [];
    } catch {
      return [];
    }
  }, [anamnesis]);
  const exames: ExameSugerido[] = useMemo(() => {
    try {
      return Array.isArray(anamnesis?.exames_sugeridos) ? (anamnesis!.exames_sugeridos as ExameSugerido[]) : [];
    } catch {
      return [];
    }
  }, [anamnesis]);
  const interacoesCruzadas: InteracaoCruzada[] = useMemo(() => {
    try {
      return Array.isArray(anamnesis?.interacoes_cruzadas)
        ? (anamnesis!.interacoes_cruzadas as InteracaoCruzada[])
        : [];
    } catch {
      return [];
    }
  }, [anamnesis]);

  const hasAna = anamnesis && Object.keys(anamnesis).length > 0;

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência`);
  }, []);

  const toggleEvidenceExpand = useCallback((idx: number) => {
    setExpandedEvidence((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleMedExpand = useCallback((idx: number) => {
    setExpandedMeds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const filteredEvidence = useMemo(
    () => evidence.filter((e) => e.title?.trim()),
    [evidence]
  );

  const buildFullSummary = useCallback(() => {
    const GRAVITY_LABELS: Record<string, string> = {
      verde: 'Não Urgente',
      amarelo: 'Pouco Urgente',
      laranja: 'Urgente',
      vermelho: 'Emergência',
    };
    const parts: string[] = [];
    if (cidSugerido) parts.push(`HIPÓTESE: ${cidSugerido}${cidDescricao ? ` — ${cidDescricao}` : ''}`);
    if (gravidade && GRAVITY_LABELS[gravidade]) parts.push(`GRAVIDADE: ${GRAVITY_LABELS[gravidade]}`);
    if (diagDiferencial.length > 0) {
      parts.push('\nDIAGNÓSTICO DIFERENCIAL:');
      diagDiferencial.forEach((dd, i) => parts.push(`${i + 1}. ${dd.hipotese} (${dd.cid}) — ${dd.probabilidade}`));
    }
    ANA_FIELDS.forEach(({ key, label }) => {
      const v = anamnesis?.[key];
      if (!v || (typeof v === 'string' && !(v as string).trim())) return;
      const d = Array.isArray(v) ? (v as unknown[]).join(', ') : String(v);
      parts.push(`\n${label}: ${d}`);
    });
    if (meds.length > 0) {
      parts.push('\nMEDICAMENTOS:');
      meds.forEach((m, i) => {
        const med = parseMed(m);
        const dosagem = [med.dose, med.via, med.posologia, med.duracao].filter(Boolean).join(' • ');
        parts.push(`${i + 1}. ${med.nome}${dosagem ? ` — ${dosagem}` : ''}${med.indicacao ? ` | ${med.indicacao}` : ''}`);
      });
    }
    if (exames.length > 0) {
      parts.push('\nEXAMES:');
      exames.forEach((ex, i) => {
        const exam = parseExam(ex);
        parts.push(`${i + 1}. ${exam.nome}${exam.codigo_tuss ? ` (TUSS: ${exam.codigo_tuss})` : ''} — ${exam.urgencia ?? 'rotina'}`);
      });
    }
    if (orientacoesPaciente.length > 0) {
      parts.push('\nORIENTAÇÕES:');
      orientacoesPaciente.forEach((o) => parts.push(`• ${o}`));
    }
    if (criteriosRetorno.length > 0) {
      parts.push('\nCRITÉRIOS DE RETORNO:');
      criteriosRetorno.forEach((c) => parts.push(`⚠️ ${c}`));
    }
    return parts.join('\n');
  }, [cidSugerido, cidDescricao, gravidade, diagDiferencial, anamnesis, meds, exames, orientacoesPaciente, criteriosRetorno]);

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex border-b border-gray-800 bg-gray-800/50 shrink-0">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-colors ${
              activeTab === tab.key
                ? 'text-primary border-b-2 border-primary bg-gray-700/50'
                : 'text-gray-500 hover:text-gray-300'
            }`}
            aria-selected={activeTab === tab.key}
            role="tab"
          >
            {tab.label}
            {tab.key === 'perguntas' && perguntasSugeridas.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-red-600 text-[9px] font-bold text-white">
                {perguntasSugeridas.length}
              </span>
            )}
            {tab.key === 'evidencias' && filteredEvidence.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-primary/30 text-[9px] font-bold text-primary">
                {filteredEvidence.length}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-4">
        {activeTab === 'consulta' && (
          <>
            {hasAna && (
              <button
                type="button"
                onClick={() => copyToClipboard(buildFullSummary(), 'Resumo completo')}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-bold hover:bg-primary/20 transition-colors"
              >
                <Clipboard className="h-3.5 w-3.5" />
                Copiar Resumo Completo
              </button>
            )}

            {suggestions.length > 0 && (
              <div className="p-3 rounded-xl border border-primary/20 bg-primary/10 space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-primary text-xs font-bold uppercase tracking-wider">Resumo da IA</span>
                </div>
                {suggestions.map((s, i) => {
                  const text = typeof s === 'string' ? s : (s?.text ?? s?.suggestion ?? '');
                  if (!text) return null;
                  return (
                    <div key={i} className="flex gap-2 text-sm text-gray-200">
                      <span className="text-primary font-bold shrink-0">•</span>
                      <span>{text}</span>
                    </div>
                  );
                })}
              </div>
            )}

            <AIIndicators
              gravidade={gravidade}
              denominadorComum={denominadorComum}
              cidSugerido={cidSugerido}
              cidDescricao={cidDescricao}
              confiancaCid={confiancaCid}
              alertasVermelhos={alertasVermelhos}
              diagDiferencial={diagDiferencial}
              copyToClipboard={copyToClipboard}
            />

            <AISuggestionView
              anamnesis={anamnesis}
              hasAna={!!hasAna}
              meds={meds}
              exames={exames}
              interacoesCruzadas={interacoesCruzadas}
              expandedMeds={expandedMeds}
              toggleMedExpand={toggleMedExpand}
              lacunasAnamnese={lacunasAnamnese}
              exameFisicoDirigido={exameFisicoDirigido}
              orientacoesPaciente={orientacoesPaciente}
              criteriosRetorno={criteriosRetorno}
              copyToClipboard={copyToClipboard}
            />
          </>
        )}

        {(activeTab === 'perguntas' || activeTab === 'evidencias') && (
          <AIMetadataPanel
            activeTab={activeTab}
            perguntasSugeridas={perguntasSugeridas}
            lacunasAnamnese={lacunasAnamnese}
            filteredEvidence={filteredEvidence}
            expandedEvidence={expandedEvidence}
            toggleEvidenceExpand={toggleEvidenceExpand}
            copyToClipboard={copyToClipboard}
          />
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 flex items-center gap-2 px-4 py-2 bg-gray-800/50 border-t border-gray-800">
        <ShieldCheck className="h-3 w-3 text-gray-500" aria-hidden />
        <p className="text-[10px] text-gray-500">
          Copiloto clínico IA • Protocolos baseados em evidência • Decisão final exclusiva do médico
        </p>
      </div>
    </div>
  );
}
