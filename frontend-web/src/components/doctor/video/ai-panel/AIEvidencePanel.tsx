/**
 * AIEvidencePanel — Painel de evidências clínicas (Cochrane/PubMed) durante a videoconsulta.
 * Exibe artigos que confirmam/contestam a hipótese diagnóstica do GPT-4o.
 * Formato compacto: ✅/⚠️ + nível de evidência + jornal + achado + PMIDs discretos.
 */
import { BookOpen, CheckCircle2, AlertTriangle, Info, Copy, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import type { EvidenceItem } from './types';

interface AIEvidencePanelProps {
  evidence: EvidenceItem[];
}

const RELEVANCE_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  confirma: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Confirma' },
  contesta: { icon: AlertTriangle, color: 'text-amber-400', label: 'Contesta' },
  complementa: { icon: Info, color: 'text-blue-400', label: 'Complementa' },
  alerta: { icon: AlertTriangle, color: 'text-red-400', label: 'Alerta' },
};

function extractPmid(url?: string): string | null {
  if (!url) return null;
  const match = url.match(/\/(\d{7,9})\/?$/);
  return match ? match[1] : null;
}

export function AIEvidencePanel({ evidence }: AIEvidencePanelProps) {
  if (evidence.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-xl bg-gray-800 flex items-center justify-center mb-3">
          <BookOpen className="h-6 w-6 text-gray-500" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Aguardando hipótese diagnóstica</p>
        <p className="text-xs text-gray-600 mt-1 max-w-[250px]">
          As evidências clínicas aparecerão automaticamente quando a IA identificar um diagnóstico com CID.
        </p>
      </div>
    );
  }

  // Contar confirmações vs contestações
  const confirma = evidence.filter(e => e.conexaoComPaciente?.toLowerCase() === 'confirma').length;
  const contesta = evidence.filter(e => e.conexaoComPaciente?.toLowerCase() === 'contesta').length;
  const pmids = evidence.map(e => extractPmid(e.url)).filter(Boolean);

  const copyPmids = async () => {
    if (pmids.length === 0) return;
    await navigator.clipboard.writeText(pmids.join(' · '));
    toast.success('PMIDs copiados');
  };

  return (
    <div className="space-y-3">
      {/* Header com resumo */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" />
          Evidência Clínica
        </h3>
        <div className="flex items-center gap-2 text-[10px]">
          {confirma > 0 && (
            <span className="flex items-center gap-1 text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> {confirma}
            </span>
          )}
          {contesta > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <AlertTriangle className="h-3 w-3" /> {contesta}
            </span>
          )}
          <span className="text-gray-600">{evidence.length} fonte{evidence.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Cards de evidência */}
      {evidence.map((item, idx) => {
        const relevance = item.conexaoComPaciente?.toLowerCase() ?? '';
        const config = RELEVANCE_CONFIG[relevance] ?? RELEVANCE_CONFIG.complementa;
        const Icon = config.icon;
        const pmid = extractPmid(item.url);

        return (
          <div
            key={idx}
            className="rounded-lg border border-gray-800 bg-gray-850 p-3 space-y-1.5 hover:border-gray-700 transition-colors"
            style={{ backgroundColor: 'rgba(17,24,39,0.6)' }}
          >
            {/* Linha 1: Ícone relevância + nível de evidência + jornal */}
            <div className="flex items-center gap-2">
              <Icon className={`h-3.5 w-3.5 shrink-0 ${config.color}`} />
              <span className={`text-[10px] font-semibold uppercase tracking-wider ${config.color}`}>
                {config.label}
              </span>
              {item.nivelEvidencia && (
                <span className="text-[10px] text-gray-500 border border-gray-700 rounded px-1.5 py-0.5">
                  {item.nivelEvidencia}
                </span>
              )}
            </div>

            {/* Linha 2: Achado principal (resumo GPT) */}
            {item.clinicalRelevance && (
              <p className="text-sm text-gray-200 leading-snug">
                {item.clinicalRelevance.replace(/^(?:✅|⚠️|ℹ️|🚨|📎)\s?/, '')}
              </p>
            )}

            {/* Linha 3: Jornal + ano */}
            <p className="text-[11px] text-gray-500">
              {item.source}
              {item.motivoSelecao && (
                <span className="text-gray-600"> — {item.motivoSelecao}</span>
              )}
            </p>

            {/* PMID discreto */}
            {pmid && (
              <div className="flex items-center gap-2 pt-0.5">
                <span className="text-[10px] text-gray-600 font-mono">PMID {pmid}</span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-gray-600 hover:text-primary transition-colors"
                  title="Abrir no PubMed"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        );
      })}

      {/* Footer: PMIDs copiáveis */}
      {pmids.length > 0 && (
        <button
          type="button"
          onClick={copyPmids}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] text-gray-600 hover:text-gray-400 transition-colors rounded border border-gray-800 hover:border-gray-700"
        >
          <Copy className="h-3 w-3" />
          Copiar PMIDs: {pmids.join(' · ')}
        </button>
      )}

      {/* Disclaimer CFM */}
      <p className="text-[9px] text-gray-700 text-center leading-tight pt-1">
        Evidências de apoio à decisão clínica. A decisão final é sempre do médico (CFM 2.454/2026).
      </p>
    </div>
  );
}
