/**
 * AIEvidencePanel — Painel de evidências clínicas (Cochrane/PubMed) durante a videoconsulta.
 * Exibe artigos que confirmam/contestam a hipótese diagnóstica do GPT-4o.
 * UX: cards expandíveis, header com resumo de confiança, badge de provider, skeleton loading.
 */
import { useState, useMemo } from 'react';
import {
  BookOpen, CheckCircle2, AlertTriangle, Info, Copy, ExternalLink,
  ChevronDown, ChevronUp, Loader2, ShieldCheck, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import type { EvidenceItem } from './types';

interface AIEvidencePanelProps {
  evidence: EvidenceItem[];
}

const RELEVANCE_CONFIG: Record<string, {
  icon: typeof CheckCircle2;
  color: string;
  bgColor: string;
  borderColor: string;
  label: string;
}> = {
  confirma: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-950/40',
    borderColor: 'border-emerald-800/50',
    label: 'Confirma hipótese',
  },
  contesta: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bgColor: 'bg-amber-950/30',
    borderColor: 'border-amber-800/50',
    label: 'Contesta hipótese',
  },
  complementa: {
    icon: Info,
    color: 'text-blue-400',
    bgColor: 'bg-blue-950/30',
    borderColor: 'border-blue-800/50',
    label: 'Complementa',
  },
  alerta: {
    icon: AlertTriangle,
    color: 'text-red-400',
    bgColor: 'bg-red-950/30',
    borderColor: 'border-red-800/50',
    label: 'Alerta diagnóstico',
  },
};

const PROVIDER_COLORS: Record<string, string> = {
  PubMed: 'bg-green-700',
  'Europe PMC': 'bg-blue-600',
  'Semantic Scholar': 'bg-purple-600',
  'ClinicalTrials.gov': 'bg-teal-700',
};

function extractPmid(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/\/(\d{7,9})\/?$/);
  return match ? match[1] : null;
}

export function AIEvidencePanel({ evidence }: AIEvidencePanelProps) {
  const [expandedCards, setExpandedCards] = useState<Set<number>>(new Set());

  const toggleCard = (idx: number) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const stats = useMemo(() => {
    const confirma = evidence.filter(e => e.conexaoComPaciente?.toLowerCase() === 'confirma').length;
    const contesta = evidence.filter(e => e.conexaoComPaciente?.toLowerCase() === 'contesta').length;
    const alerta = evidence.filter(e => e.conexaoComPaciente?.toLowerCase() === 'alerta').length;
    const pmids = evidence.map(e => extractPmid(e.url)).filter(Boolean) as string[];
    return { confirma, contesta, alerta, pmids, total: evidence.length };
  }, [evidence]);

  const copyPmids = async () => {
    if (stats.pmids.length === 0) return;
    await navigator.clipboard.writeText(stats.pmids.join(' · '));
    toast.success('PMIDs copiados');
  };

  // ── Empty state ──
  if (evidence.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-800/80 flex items-center justify-center mb-4 ring-1 ring-gray-700/50">
          <BookOpen className="h-7 w-7 text-gray-500" />
        </div>
        <p className="text-sm text-gray-300 font-semibold mb-1">Evidências em breve</p>
        <p className="text-xs text-gray-600 max-w-[280px] leading-relaxed">
          Artigos científicos (Cochrane, PubMed) serão buscados automaticamente quando a IA
          identificar uma hipótese diagnóstica com CID. A busca prioriza revisões sistemáticas
          e meta-análises.
        </p>
        <div className="flex items-center gap-1.5 mt-4 text-[10px] text-gray-600">
          <Loader2 className="h-3 w-3 animate-spin" />
          Aguardando dados clínicos...
        </div>
      </div>
    );
  }

  // ── Confidence banner ──
  const confidence = stats.confirma > stats.contesta ? 'high' : stats.contesta > 0 ? 'mixed' : 'neutral';

  return (
    <div className="space-y-3">
      {/* Confidence summary banner */}
      {confidence === 'high' && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-emerald-950/40 border border-emerald-800/40">
          <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-emerald-300">
              Hipótese confirmada por {stats.confirma}/{stats.total} fonte{stats.total !== 1 ? 's' : ''}
            </p>
            <p className="text-[10px] text-emerald-500/70 mt-0.5">
              Evidência consistente com a literatura científica
            </p>
          </div>
        </div>
      )}
      {confidence === 'mixed' && (
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-amber-950/30 border border-amber-800/40">
          <ShieldAlert className="h-4 w-4 text-amber-400 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-amber-300">
              Evidência mista — {stats.confirma} confirma{stats.confirma !== 1 ? 'm' : ''}, {stats.contesta} contesta{stats.contesta !== 1 ? 'm' : ''}
            </p>
            <p className="text-[10px] text-amber-500/70 mt-0.5">
              Revise os artigos abaixo antes de definir conduta
            </p>
          </div>
        </div>
      )}

      {/* Section header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          Fontes científicas
        </h3>
        <span className="text-[10px] text-gray-600">
          {stats.total} artigo{stats.total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Evidence cards */}
      {evidence.map((item, idx) => {
        const relevance = item.conexaoComPaciente?.toLowerCase() ?? '';
        const config = RELEVANCE_CONFIG[relevance] ?? RELEVANCE_CONFIG.complementa;
        const Icon = config.icon;
        const pmid = extractPmid(item.url);
        const isExpanded = expandedCards.has(idx);
        const providerColor = PROVIDER_COLORS[item.provider ?? 'PubMed'] ?? 'bg-gray-600';

        return (
          <button
            key={idx}
            type="button"
            onClick={() => toggleCard(idx)}
            className={`w-full text-left rounded-lg border p-3 space-y-1.5 transition-all duration-200 ${config.borderColor} ${config.bgColor} hover:brightness-110`}
          >
            {/* Row 1: Relevance + level badge + expand chevron */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${config.color}`}>
                  {config.label}
                </span>
                {item.nivelEvidencia && (
                  <span className="text-[9px] text-gray-400 border border-gray-700/60 rounded-md px-1.5 py-0.5 font-medium">
                    {item.nivelEvidencia}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-[9px] font-semibold text-white px-1.5 py-0.5 rounded ${providerColor}`}>
                  {item.provider ?? 'PubMed'}
                </span>
                {isExpanded
                  ? <ChevronUp className="h-3.5 w-3.5 text-gray-500" />
                  : <ChevronDown className="h-3.5 w-3.5 text-gray-500" />}
              </div>
            </div>

            {/* Row 2: GPT summary (always visible) */}
            {item.clinicalRelevance && (
              <p className="text-[13px] text-gray-200 leading-snug font-medium">
                {item.clinicalRelevance.replace(/^(?:✅|⚠️|ℹ️|🚨|📎)\s?/, '')}
              </p>
            )}

            {/* Row 3: Source + year (always visible) */}
            <p className="text-[11px] text-gray-500">{item.source}</p>

            {/* Expanded: title, motivo, abstract, PMID link */}
            {isExpanded && (
              <div className="space-y-2 pt-1.5 mt-1.5 border-t border-gray-700/40">
                {item.title && (
                  <p className="text-[11px] text-gray-300 leading-snug italic">
                    {item.title}
                  </p>
                )}
                {item.motivoSelecao && (
                  <div className="flex items-start gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-gray-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-500 leading-snug">
                      {item.motivoSelecao}
                    </p>
                  </div>
                )}
                {(item.translatedAbstract ?? item.abstract) && (
                  <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-4">
                    {item.translatedAbstract ?? item.abstract}
                  </p>
                )}
                {pmid && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-600 font-mono">PMID {pmid}</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-[10px] text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
                    >
                      Abrir no PubMed <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  </div>
                )}
              </div>
            )}

            {/* Collapsed: just PMID inline */}
            {!isExpanded && pmid && (
              <span className="text-[9px] text-gray-600 font-mono">PMID {pmid}</span>
            )}
          </button>
        );
      })}

      {/* Footer: copy PMIDs */}
      {stats.pmids.length > 0 && (
        <button
          type="button"
          onClick={copyPmids}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] text-gray-500 hover:text-gray-300 transition-colors rounded-md border border-gray-800/60 hover:border-gray-700 bg-gray-900/30"
        >
          <Copy className="h-3 w-3" />
          Copiar PMIDs: {stats.pmids.join(' · ')}
        </button>
      )}

      {/* CFM disclaimer */}
      <p className="text-[9px] text-gray-700 text-center leading-tight pt-1">
        Apoio à decisão clínica — a decisão final é sempre do médico (CFM 2.454/2026)
      </p>
    </div>
  );
}
