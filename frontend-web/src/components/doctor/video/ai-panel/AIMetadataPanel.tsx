/**
 * AIMetadataPanel — Tabs Perguntas e Evidências.
 */
import {
  HelpCircle,
  AlertCircle,
  Library,
  Flag,
  GitBranch,
  TrendingUp,
  Copy,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  User,
  FileText,
} from 'lucide-react';
import type { PerguntaSugerida, EvidenceItem } from './types';

interface AIMetadataPanelProps {
  activeTab: 'perguntas' | 'evidencias';
  perguntasSugeridas: PerguntaSugerida[];
  lacunasAnamnese: string[];
  filteredEvidence: EvidenceItem[];
  expandedEvidence: Set<number>;
  toggleEvidenceExpand: (idx: number) => void;
  copyToClipboard: (text: string, label: string) => void;
}

export function AIMetadataPanel({
  activeTab,
  perguntasSugeridas,
  lacunasAnamnese,
  filteredEvidence,
  expandedEvidence,
  toggleEvidenceExpand,
  copyToClipboard,
}: AIMetadataPanelProps) {
  if (activeTab === 'perguntas') {
    return (
      <>
        {perguntasSugeridas.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Pergunte ao Paciente
              </span>
              <span className="px-2 py-0.5 rounded-md bg-primary/20 text-[9px] font-bold text-primary">IA</span>
            </div>
            <p className="text-xs text-gray-500 italic mb-2">
              Priorizadas por impacto clínico — a resposta de cada uma refina o diagnóstico
            </p>
            {perguntasSugeridas.map((p, i) => {
              const prioColor =
                p.prioridade === 'alta' ? 'text-primary' : p.prioridade === 'media' ? 'text-primary/80' : 'text-gray-500';
              const prioLabel =
                p.prioridade === 'alta' ? 'CRÍTICA' : p.prioridade === 'media' ? 'IMPORTANTE' : 'COMPLEMENTAR';
              return (
                <div key={i} className="p-3 rounded-xl border border-gray-700/50 bg-gray-800/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {i + 1}
                    </span>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-bold ${prioColor}`}>
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      {prioLabel}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-200 italic">&quot;{p.pergunta}&quot;</p>
                  {p.objetivo && (
                    <div className="flex items-start gap-2 pl-1">
                      <Flag className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-primary/90">{p.objetivo}</p>
                    </div>
                  )}
                  {p.hipoteses_afetadas && (
                    <div className="pl-1 p-2 rounded-lg bg-primary/10">
                      <div className="flex items-start gap-2">
                        <GitBranch className="h-3 w-3 text-gray-400 shrink-0 mt-0.5" />
                        <p className="text-xs text-gray-400">{p.hipoteses_afetadas}</p>
                      </div>
                    </div>
                  )}
                  {p.impacto_na_conduta && (
                    <div className="pl-1 p-2 rounded-lg bg-primary/10">
                      <div className="flex items-start gap-2">
                        <TrendingUp className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                        <p className="text-xs text-primary/90">{p.impacto_na_conduta}</p>
                      </div>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => copyToClipboard(p.pergunta, 'Pergunta')}
                    className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
                  >
                    <Copy className="h-3 w-3" /> Copiar
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <HelpCircle className="h-8 w-8 text-amber-500 mb-4" />
            <p className="text-sm font-bold text-gray-400">Perguntas sendo geradas...</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Perguntas priorizadas por impacto clínico serão geradas assim que houver dados do transcript.
              Comece a conversa com o paciente para gerar perguntas sugeridas.
            </p>
          </div>
        )}

        {lacunasAnamnese.length > 0 && (
          <div className="mt-4 p-3 rounded-xl border border-amber-800/50 bg-amber-950/20 space-y-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                Informações Faltando
              </span>
            </div>
            {lacunasAnamnese.map((l, i) => (
              <div key={i} className="flex items-start gap-2 pl-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <span className="text-xs text-amber-400">{l}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-start gap-2 mt-4 p-2 rounded-lg bg-gray-800/50">
          <CheckCircle2 className="h-3 w-3 text-gray-500 shrink-0 mt-0.5" />
          <p className="text-[10px] text-gray-500">
            Sugestões baseadas nos dados disponíveis. O médico decide o que perguntar e quando.
          </p>
        </div>
      </>
    );
  }

  // activeTab === 'evidencias'
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Library className="h-3.5 w-3.5 text-primary" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Evidências Científicas</span>
        <span className="px-2 py-0.5 rounded-md bg-primary/20 text-[9px] font-bold text-primary">IA</span>
      </div>
      <p className="text-xs text-gray-500">
        Artigos de PubMed, Europe PMC e outras bases que apoiam hipótese diagnóstica e conduta para este caso.
      </p>
      {filteredEvidence.length > 0 ? (
        <div className="space-y-2">
          {filteredEvidence.map((e, i) => {
            const isExpanded = expandedEvidence.has(i);
            const nivelBadge = e.nivelEvidencia ? `Nível ${e.nivelEvidencia}` : '';
            return (
              <button
                key={i}
                type="button"
                onClick={() => toggleEvidenceExpand(i)}
                className="w-full text-left p-3 rounded-xl border border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-bold text-gray-200 flex-1 ${!isExpanded ? 'line-clamp-2' : ''}`}>
                    {e.title}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {nivelBadge && (
                      <span className="px-2 py-0.5 rounded-md bg-primary/20 text-[9px] font-bold text-primary">
                        {nivelBadge}
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    )}
                  </div>
                </div>
                {e.conexaoComPaciente && (
                  <div className="mt-2 p-2 rounded-lg bg-primary/10 flex items-start gap-2">
                    <User className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-primary font-semibold">{e.conexaoComPaciente}</p>
                  </div>
                )}
                {(e.clinicalRelevance ?? e.translatedAbstract ?? e.abstract) && (
                  <div className="mt-2 p-2 rounded-lg bg-primary/10 flex items-start gap-2">
                    <FileText className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                    <p className="text-xs text-gray-400 line-clamp-3">
                      {e.clinicalRelevance ?? e.translatedAbstract ?? e.abstract}
                    </p>
                  </div>
                )}
                {isExpanded && e.relevantExcerpts?.map((excerpt, j) => (
                  <div key={j} className="mt-2 pl-4 border-l-2 border-primary">
                    <p className="text-xs text-gray-400 italic">&quot;{excerpt}&quot;</p>
                  </div>
                ))}
                {isExpanded && e.motivoSelecao && (
                  <div className="mt-2 flex items-start gap-2 pl-1">
                    <CheckCircle2 className="h-3 w-3 text-gray-500 shrink-0 mt-0.5" />
                    <p className="text-[10px] text-gray-500 italic">{e.motivoSelecao}</p>
                  </div>
                )}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[10px] text-gray-500">{e.source}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[9px] font-semibold text-white ${
                      e.provider === 'Europe PMC'
                        ? 'bg-blue-600'
                        : e.provider === 'Semantic Scholar'
                          ? 'bg-violet-600'
                          : e.provider === 'ClinicalTrials.gov'
                            ? 'bg-emerald-800'
                            : 'bg-green-700'
                    }`}
                  >
                    {e.provider ?? 'PubMed'}
                  </span>
                </div>
                {e.url && (
                  <a
                    href={e.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-primary hover:underline mt-1 inline-flex items-center gap-1"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    Ver fonte →
                  </a>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-gray-700/50 bg-gray-800/30 text-center">
          <Library className="h-6 w-6 text-primary mx-auto mb-2" />
          <p className="text-sm font-bold text-primary">Evidências em breve</p>
          <p className="text-xs text-gray-500 mt-1">
            Artigos científicos serão buscados automaticamente quando houver hipótese diagnóstica (CID) e dados da
            consulta. A IA seleciona trechos relevantes e explica a conexão com o caso do paciente.
          </p>
        </div>
      )}
    </div>
  );
}
