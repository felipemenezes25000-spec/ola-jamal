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
}

export function DoctorAIPanel({ anamnesis, suggestions }: DoctorAIPanelProps) {
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


}
