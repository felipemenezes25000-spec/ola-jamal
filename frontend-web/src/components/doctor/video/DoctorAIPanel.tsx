/**
 * DoctorAIPanel — Painel lateral do médico durante a videoconsulta (web).
 * Gravidade Manchester, CID, alertas, diferencial, anamnese, meds, exames, orientações, perguntas.
 */
import { useState, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import type {
  TabKey,
  MedSugerido,
  ExameSugerido,
  DiagDiferencial,
  PerguntaSugerida,
  InteracaoCruzada,
} from './ai-panel/types';
import { TABS } from './ai-panel/types';
import { AIIndicators } from './ai-panel/AIIndicators';
import { AISuggestionView } from './ai-panel/AISuggestionView';
import { AIMetadataPanel } from './ai-panel/AIMetadataPanel';

interface DoctorAIPanelProps {
  anamnesis: Record<string, unknown> | null;
  suggestions: (string | { text?: string; suggestion?: string })[];
}

export function DoctorAIPanel({ anamnesis, suggestions: _suggestions }: DoctorAIPanelProps) {
  const [activeTab, setActiveTab] = useState<TabKey>('consulta');
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

  const toggleMedExpand = useCallback((idx: number) => {
    setExpandedMeds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex gap-1 p-2 border-b border-border/50 shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === t.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted/50'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {activeTab === 'consulta' && (
          <>
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
        {activeTab === 'perguntas' && (
          <AIMetadataPanel
            activeTab="perguntas"
            perguntasSugeridas={perguntasSugeridas}
            lacunasAnamnese={lacunasAnamnese}
            copyToClipboard={copyToClipboard}
          />
        )}
      </div>
    </div>
  );
}
