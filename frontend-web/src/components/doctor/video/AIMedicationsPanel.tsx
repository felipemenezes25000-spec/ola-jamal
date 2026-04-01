/**
 * AIMedicationsPanel — Medicamentos sugeridos em cards, interações cruzadas com alertas.
 * Paridade com mobile AISuggestionView (meds + interações).
 */
import { motion } from 'framer-motion';
import { Pill, FlaskConical, AlertTriangle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { MedicamentoSugerido, ExameSugerido, InteracaoCruzada, ParsedAnamnesisAi } from './ai-panel/types';

function copyToClipboard(text: string, label: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success(`${label} copiado`),
    () => toast.error('Erro ao copiar'),
  );
}

function formatMedLine(med: MedicamentoSugerido): string {
  const parts = [med.dose, med.via, med.frequencia ?? med.posologia, med.duracao].filter(Boolean);
  return parts.join(' • ');
}

export interface AIMedicationsPanelProps {
  data: ParsedAnamnesisAi | null;
}

export function AIMedicationsPanel({ data }: AIMedicationsPanelProps) {
  if (!data) return null;

  const meds: (MedicamentoSugerido | string)[] = Array.isArray(data.medicamentos_sugeridos)
    ? data.medicamentos_sugeridos.filter(
        (m) => m != null && (typeof m === 'string' ? (m as string).trim() : (m as MedicamentoSugerido).nome),
      )
    : [];
  const exames: ExameSugerido[] = Array.isArray(data.exames_sugeridos) ? data.exames_sugeridos : [];
  const interacoes: InteracaoCruzada[] = Array.isArray(data.interacoes_cruzadas) ? data.interacoes_cruzadas : [];

  const hasContent = meds.length > 0 || exames.length > 0 || interacoes.length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mb-3">
          <Pill className="h-7 w-7 text-gray-600" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Prescrição em construção</p>
        <p className="text-xs text-gray-600 mt-1 max-w-xs">
          Medicamentos e exames sugeridos aparecerão aqui conforme a IA analisa a consulta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Medicamentos sugeridos */}
      {meds.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Pill className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
              Medicamentos ({meds.length})
            </span>
          </div>
          <div className="space-y-2">
            {meds.map((m, i) => {
              const med = typeof m === 'string' ? { nome: m, dose: '', via: '', frequencia: '', duracao: '' } : m;
              const linha = formatMedLine(med);
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="p-3 rounded-xl bg-gray-800/50 border border-gray-800"
                >
                  <div className="flex items-start gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-200">{med.nome}</p>
                      {linha && <p className="text-xs text-gray-400 mt-0.5">{linha}</p>}
                      {med.observacoes && (
                        <p className="text-xs text-gray-500 mt-1 italic">{med.observacoes}</p>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        `${med.nome}${linha ? '\n' + linha : ''}${med.observacoes ? '\n' + med.observacoes : ''}`,
                        'Medicamento',
                      )
                    }
                    className="mt-2 flex items-center gap-1.5 text-[10px] font-semibold text-primary hover:underline"
                  >
                    <Copy className="h-3 w-3" /> Copiar p/ receita
                  </button>
                </motion.div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-600 italic">* Sugestões da IA — decisão final do médico</p>
        </div>
      )}

      {/* Interações cruzadas */}
      {interacoes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
              Interações medicamentosas ({interacoes.length})
            </span>
          </div>
          <div className="space-y-2">
            {interacoes.map((ic, i) => {
              const tipo = (ic.tipo ?? ic.gravidade ?? '').toLowerCase();
              const isGrave = tipo === 'grave';
              const medsStr =
                (ic.medicamentos?.length ?? 0) > 0
                  ? ic.medicamentos!.join(' × ')
                  : ic.medicamento_a && ic.medicamento_b
                    ? `${ic.medicamento_a} × ${ic.medicamento_b}`
                    : '—';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-3 rounded-xl border ${
                    isGrave ? 'bg-red-950/40 border-red-800/50' : 'bg-amber-950/30 border-amber-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className={`h-3.5 w-3.5 ${isGrave ? 'text-red-400' : 'text-amber-400'}`} />
                    <span
                      className={`text-[9px] font-bold uppercase ${
                        isGrave ? 'text-red-400' : 'text-amber-400'
                      }`}
                    >
                      {isGrave ? 'Grave' : tipo === 'moderada' ? 'Moderada' : 'Leve'}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-gray-200">{medsStr}</p>
                  <p className={`text-xs mt-1 ${isGrave ? 'text-red-300' : 'text-amber-300'}`}>{ic.descricao}</p>
                  {ic.conduta && (
                    <p className="text-xs text-primary mt-1.5 font-medium">{ic.conduta}</p>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Exames sugeridos */}
      {exames.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
              Exames ({exames.length})
            </span>
          </div>
          <div className="space-y-2">
            {exames.map((ex, i) => {
              const exam = typeof ex === 'string' ? { nome: ex, justificativa: '', urgencia: '' } : ex;
              const isUrgent = (exam.urgencia ?? '').toLowerCase() === 'urgente';
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`p-3 rounded-xl border ${
                    isUrgent ? 'bg-red-950/30 border-red-800/50' : 'bg-gray-800/50 border-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
                      {i + 1}
                    </span>
                    <p className="text-sm font-semibold text-gray-200 flex-1">{exam.nome}</p>
                    {isUrgent && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-600 text-white">
                        URGENTE
                      </span>
                    )}
                  </div>
                  {exam.justificativa && (
                    <p className="text-xs text-gray-400 mt-1 pl-7">{exam.justificativa}</p>
                  )}
                </motion.div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-600 italic">* Sugestões da IA — decisão final do médico</p>
        </div>
      )}
    </div>
  );
}
