/**
 * DoctorAIPanel — Painel lateral do médico durante a videoconsulta (web).
 * Gravidade Manchester, alertas, diferencial, anamnese, meds, exames, orientações, perguntas.
 *
 * Design spec:
 * - AI Panel expandable: dark bg (#15202E), transcription in real-time, AI suggestions with purple accent (#8B5CF6)
 * - Responsive tabs that wrap on small screens
 */
import { useState, useMemo, useCallback } from 'react';
import { Lightbulb, AlertTriangle } from 'lucide-react';
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
import { TABS } from './ai-panel/types';
import { AIIndicators } from './ai-panel/AIIndicators';
import { AISuggestionView } from './ai-panel/AISuggestionView';
import { AIMetadataPanel } from './ai-panel/AIMetadataPanel';
import { AIEvidencePanel } from './ai-panel/AIEvidencePanel';

interface DoctorAIPanelProps {
  anamnesis: Record<string, unknown> | null;
  suggestions: (string | { text?: string; suggestion?: string })[];
  evidence?: EvidenceItem[];
  consultationType?: string | null;
}

export function DoctorAIPanel({ anamnesis, suggestions, evidence = [], consultationType }: DoctorAIPanelProps) {
  const isPsy = consultationType === 'psicologo';
  const [activeTab, setActiveTab] = useState<TabKey>('consulta');
  const [expandedMeds, setExpandedMeds] = useState<Set<number>>(new Set());

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

  const primaryHipotese = diagDiferencial.length > 0 ? (diagDiferencial[0].hipotese ?? '') : '';
  const primaryCid = diagDiferencial.length > 0 ? (diagDiferencial[0].cid ?? '') : '';

  const hasAna = anamnesis && Object.keys(anamnesis).length > 0;

  const parsedSuggestions = useMemo(() => {
    return suggestions.map((s) => {
      if (typeof s === 'string') return s;
      return s.text ?? s.suggestion ?? '';
    }).filter(Boolean);
  }, [suggestions]);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copiado para a área de transferência`);
  }, []);

  const toggleMedExpand = useCallback((idx: number) => {
    setExpandedMeds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#15202E]">
      {/* Tab bar - horizontally scrollable on small screens to prevent overflow */}
      <div className="flex gap-1 p-2 border-b border-white/5 shrink-0 overflow-x-auto scrollbar-none">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
              activeTab === t.key
                ? 'bg-[#8B5CF6] text-white shadow-sm shadow-purple-500/20'
                : 'text-gray-400 hover:bg-white/5 hover:text-gray-300'
            }`}
          >
            {t.label}
            {t.key === 'evidencias' && evidence.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[9px] font-bold">
                {evidence.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {activeTab === 'consulta' && (
          <>
            <AIIndicators
              gravidade={gravidade}
              denominadorComum={denominadorComum}
              alertasVermelhos={alertasVermelhos}
              diagDiferencial={diagDiferencial}
              primaryCid={primaryCid}
              primaryHipotese={primaryHipotese}
              copyToClipboard={copyToClipboard}
            />
            <AISuggestionView
              anamnesis={anamnesis}
              hasAna={!!hasAna}
              meds={isPsy ? [] : meds}
              exames={isPsy ? [] : exames}
              interacoesCruzadas={isPsy ? [] : interacoesCruzadas}
              expandedMeds={expandedMeds}
              toggleMedExpand={toggleMedExpand}
              lacunasAnamnese={lacunasAnamnese}
              exameFisicoDirigido={isPsy ? '' : exameFisicoDirigido}
              orientacoesPaciente={orientacoesPaciente}
              criteriosRetorno={criteriosRetorno}
              copyToClipboard={copyToClipboard}
            />
            {parsedSuggestions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Lightbulb className="h-3.5 w-3.5 text-[#8B5CF6]" />
                  Sugestoes em tempo real
                </h3>
                {parsedSuggestions.map((s, i) => {
                  const isDanger = s.startsWith('\u{1F6A8}');
                  return (
                    <div key={i} className={`flex gap-2 p-2.5 rounded-lg text-sm ${
                      isDanger
                        ? 'bg-red-500/10 border border-red-500/20'
                        : 'bg-[#8B5CF6]/10 border border-[#8B5CF6]/20'
                    }`}>
                      {isDanger
                        ? <AlertTriangle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                        : <Lightbulb className="h-4 w-4 text-[#8B5CF6] shrink-0 mt-0.5" />}
                      <span className={`text-xs sm:text-sm ${isDanger ? 'text-red-300' : 'text-purple-200'}`}>
                        {isDanger ? s.replace('\u{1F6A8} ', '') : s}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
        {activeTab === 'perguntas' && (
          <AIMetadataPanel
            activeTab="perguntas"
            perguntasSugeridas={perguntasSugeridas}
            lacunasAnamnese={lacunasAnamnese}
            copyToClipboard={copyToClipboard}
          />
        )}
        {activeTab === 'evidencias' && (
          <AIEvidencePanel evidence={evidence} />
        )}
      </div>
    </div>
  );
}
