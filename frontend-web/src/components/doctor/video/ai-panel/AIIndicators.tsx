/**
 * AIIndicators — Gravidade Manchester, CID sugerido, alertas vermelhos,
 * diagnóstico diferencial para a tab Consulta.
 */
import {
  ShieldCheck,
  AlertCircle,
  AlertTriangle,
  XCircle,
  Stethoscope,
  Copy,
  RefreshCw,
  GitBranch,
} from 'lucide-react';
import type { DiagDiferencial } from './types';
import { getGravityConfig, getConfidenceConfig } from './types';

const GRAVITY_ICONS: Record<string, typeof ShieldCheck> = {
  verde: ShieldCheck,
  amarelo: AlertCircle,
  laranja: AlertTriangle,
  vermelho: XCircle,
};

interface AIIndicatorsProps {
  gravidade: string;
  cidSugerido: string;
  cidDescricao: string;
  confiancaCid: string;
  alertasVermelhos: string[];
  diagDiferencial: DiagDiferencial[];
  copyToClipboard: (text: string, label: string) => void;
}

export function AIIndicators({
  gravidade,
  cidSugerido,
  cidDescricao,
  confiancaCid,
  alertasVermelhos,
  diagDiferencial,
  copyToClipboard,
}: AIIndicatorsProps) {
  const GRAVITY_CONFIG = getGravityConfig();
  const CONFIDENCE_CONFIG = getConfidenceConfig();

  return (
    <>
      {/* Gravidade Manchester */}
      {gravidade && GRAVITY_CONFIG[gravidade] && (
        <div
          className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${
            gravidade === 'verde'
              ? 'bg-emerald-950/40 border-emerald-800/50'
              : gravidade === 'amarelo'
                ? 'bg-amber-950/40 border-amber-800/50'
                : gravidade === 'laranja'
                  ? 'bg-orange-950/40 border-orange-800/50'
                  : 'bg-red-950/40 border-red-800/50'
          }`}
        >
          {(() => {
            const Icon = GRAVITY_ICONS[gravidade] ?? ShieldCheck;
            const cfg = GRAVITY_CONFIG[gravidade];
            return (
              <>
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                <span className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</span>
              </>
            );
          })()}
        </div>
      )}

      {/* CID sugerido */}
      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" aria-hidden />
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Hipótese Diagnóstica (CID)
            </span>
          </div>
          {confiancaCid && CONFIDENCE_CONFIG[confiancaCid] && (
            <span
              className={`flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold ${CONFIDENCE_CONFIG[confiancaCid].color}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {CONFIDENCE_CONFIG[confiancaCid].label}
            </span>
          )}
        </div>
        {cidSugerido ? (
          <>
            <p className="text-sm font-bold text-gray-200">{cidSugerido}</p>
            {cidDescricao && <p className="text-xs text-gray-400">{cidDescricao}</p>}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => copyToClipboard(cidSugerido + (cidDescricao ? ` — ${cidDescricao}` : ''), 'CID')}
                className="flex items-center gap-1 text-xs text-primary font-semibold hover:underline"
              >
                <Copy className="h-3 w-3" /> Copiar CID
              </button>
              <span className="flex items-center gap-1 text-[9px] text-gray-600 opacity-60">
                <RefreshCw className="h-2.5 w-2.5" /> Atualiza conforme a consulta
              </span>
            </div>
          </>
        ) : (
          <p className="text-xs text-gray-500 italic">Aguardando dados da transcrição para sugerir CID</p>
        )}
      </div>

      {/* Alertas vermelhos */}
      {alertasVermelhos.length > 0 && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-red-400">Alertas</span>
          </div>
          {alertasVermelhos.map((a, i) => (
            <p key={i} className="text-xs text-red-300">
              ⚠️ {a}
            </p>
          ))}
        </div>
      )}

      {/* Diagnóstico diferencial */}
      {diagDiferencial.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-primary" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
              Diagnóstico Diferencial
            </span>
          </div>
          <div className="space-y-2">
            {diagDiferencial.map((dd, i) => {
              const probColor =
                dd.probabilidade === 'alta'
                  ? 'bg-emerald-500'
                  : dd.probabilidade === 'media'
                    ? 'bg-amber-500'
                    : 'bg-gray-500';
              return (
                <div key={i} className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/50 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${probColor}`} aria-hidden />
                    <span className="text-sm font-bold text-gray-200">{dd.hipotese}</span>
                  </div>
                  {dd.cid && <p className="text-xs text-primary font-semibold ml-4">{dd.cid}</p>}
                  {dd.argumentos_a_favor && (
                    <p className="text-xs text-emerald-400 ml-4">✓ {dd.argumentos_a_favor}</p>
                  )}
                  {dd.argumentos_contra && (
                    <p className="text-xs text-amber-400 ml-4">✗ {dd.argumentos_contra}</p>
                  )}
                  {dd.exames_confirmatorios && (
                    <p className="text-xs text-primary ml-4">🔬 {dd.exames_confirmatorios}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
