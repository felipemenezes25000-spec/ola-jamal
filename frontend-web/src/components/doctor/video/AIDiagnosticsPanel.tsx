/**
 * AIDiagnosticsPanel — Gravidade + diagnóstico diferencial.
 * Paridade com mobile AIIndicators.
 */
import { motion } from 'framer-motion';
import { Shield, ShieldAlert, ShieldX, Activity, GitBranch, Star, Copy } from 'lucide-react';
import { toast } from 'sonner';
import type { DiagDiferencial, ParsedAnamnesisAi } from './ai-panel/types';

const GRAVITY_CONFIG: Record<string, { color: string; label: string; icon: typeof Shield }> = {
  leve: { color: 'text-emerald-400', label: 'Leve', icon: Shield },
  moderada: { color: 'text-amber-400', label: 'Moderada', icon: ShieldAlert },
  grave: { color: 'text-red-400', label: 'Grave', icon: ShieldX },
};

export interface AIDiagnosticsPanelProps {
  data: ParsedAnamnesisAi | null;
}

export function AIDiagnosticsPanel({ data }: AIDiagnosticsPanelProps) {
  if (!data) return null;

  const gravidade = (data.classificacao_gravidade ?? '').toLowerCase();
  const diagDiferencial: DiagDiferencial[] = Array.isArray(data.diagnostico_diferencial)
    ? data.diagnostico_diferencial
    : [];
  const primary = diagDiferencial.length > 0 ? diagDiferencial[0] : null;

  const gravityCfg = gravidade && GRAVITY_CONFIG[gravidade] ? GRAVITY_CONFIG[gravidade] : null;

  const hasContent = gravityCfg || diagDiferencial.length > 0;

  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-14 h-14 rounded-2xl bg-gray-800 flex items-center justify-center mb-3">
          <Activity className="h-7 w-7 text-gray-600" />
        </div>
        <p className="text-sm text-gray-400 font-medium">Diagnóstico em construção</p>
        <p className="text-xs text-gray-600 mt-1 max-w-xs">
          A IA analisa a transcrição e sugere diagnóstico diferencial em tempo real.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Gravidade */}
      {gravityCfg && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            gravidade === 'leve'
              ? 'bg-emerald-950/30 border-emerald-800/50'
              : gravidade === 'moderada'
                ? 'bg-amber-950/30 border-amber-800/50'
                : 'bg-red-950/30 border-red-800/50'
          }`}
        >
          <gravityCfg.icon className={`h-4 w-4 ${gravityCfg.color}`} />
          <span className={`text-sm font-semibold ${gravityCfg.color}`}>{gravityCfg.label}</span>
        </motion.div>
      )}

      {/* Hipótese Principal */}
      {primary && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border-2 border-primary/50 bg-primary/10 p-3 space-y-1"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-primary fill-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                Hipotese Principal
              </span>
            </div>
            <button
              type="button"
              onClick={async () => {
                const label = primary.descricao || primary.hipotese || primary.cid;
                const text = primary.cid ? `${primary.cid} — ${label}` : label;
                await navigator.clipboard.writeText(text);
                toast.success('Hipotese copiada');
              }}
              className="p-1 rounded hover:bg-primary/20 transition-colors"
              title="Copiar hipotese"
            >
              <Copy className="h-3.5 w-3.5 text-primary" />
            </button>
          </div>
          <p className="text-sm font-bold text-gray-200">
            {primary.descricao || primary.hipotese || primary.cid}
          </p>
          {primary.cid && (
            <p className="text-xs font-semibold text-primary">{primary.cid}</p>
          )}
          {primary.probabilidade && (
            <span className="inline-block text-xs font-semibold text-primary px-2 py-0.5 rounded-md bg-primary/20 mt-1">
              {primary.probabilidade}
            </span>
          )}
        </motion.div>
      )}

      {/* Diagnóstico diferencial */}
      {diagDiferencial.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
              Diagnóstico diferencial
            </span>
          </div>
          <div className="space-y-2">
            {diagDiferencial.map((dd, i) => {
              const prob = (dd.probabilidade ?? '').toLowerCase();
              const probColor =
                prob === 'alta' ? 'bg-emerald-500' : prob === 'media' ? 'bg-amber-500' : 'bg-gray-500';
              const label = dd.descricao || dd.hipotese || dd.cid;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 + i * 0.03 }}
                  className="p-3 rounded-xl bg-gray-800/50 border border-gray-800"
                >
                  <div className="flex items-start gap-2">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${probColor}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-200">{label}</p>
                      {dd.cid && <p className="text-xs text-primary font-medium mt-0.5">{dd.cid}</p>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
