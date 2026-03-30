/**
 * StatusTracker — Timeline de etapas do pedido.
 * Paridade exata com mobile StatusTracker.
 *
 * - Recebe status e type (ou requestType)
 * - Normaliza status (camelCase → snake_case) antes de comparar
 * - PRESCRIPTION_STEPS para receita/exame; CONSULTATION_STEPS para consulta
 * - Estados terminais (rejected/cancelled): UI especial sem timeline
 */
import {
  Send,
  Eye,
  FileText,
  ShieldCheck,
  CheckCheck,
  Search,
  CheckCircle2,
  Video,
  XCircle,
  Ban,
  CreditCard,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { normalizeStatus } from '@/lib/doctor-helpers';

interface Step {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  statuses: string[];
}

// Receita e Exame — com etapa de pagamento
const PRESCRIPTION_STEPS: Step[] = [
  { key: 'submitted', label: 'Enviado', icon: Send, statuses: ['submitted'] },
  { key: 'review', label: 'Em análise', icon: Eye, statuses: ['analyzing', 'in_review'] },
  { key: 'payment', label: 'Pagamento', icon: CreditCard, statuses: ['approved_pending_payment', 'pending_payment'] },
  { key: 'signing', label: 'Aguardando assinatura', icon: FileText, statuses: ['paid'] },
  { key: 'signed', label: 'Assinado', icon: ShieldCheck, statuses: ['signed'] },
  { key: 'delivered', label: 'Entregue', icon: CheckCheck, statuses: ['delivered', 'completed'] },
];

// Consulta — com etapa de pagamento
const CONSULTATION_STEPS: Step[] = [
  { key: 'searching', label: 'Buscando médico', icon: Search, statuses: ['searching_doctor'] },
  { key: 'payment', label: 'Pagamento', icon: CreditCard, statuses: ['approved_pending_payment', 'pending_payment'] },
  { key: 'ready', label: 'Consulta pronta', icon: CheckCircle2, statuses: ['paid', 'consultation_ready', 'consultation_accepted'] },
  { key: 'in_consultation', label: 'Em consulta', icon: Video, statuses: ['in_consultation'] },
  { key: 'finished', label: 'Finalizada', icon: CheckCheck, statuses: ['consultation_finished'] },
];

function getStepIndex(steps: Step[], status: string): number {
  const norm = normalizeStatus(status);
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].statuses.includes(norm)) return i;
  }
  return 0;
}

export interface StatusTrackerProps {
  status: string;
  type?: string;
  requestType?: string;
}

export function StatusTracker({ status, type, requestType }: StatusTrackerProps) {
  const reqType = (type || requestType || '').toLowerCase();
  const steps = reqType === 'consultation' ? CONSULTATION_STEPS : PRESCRIPTION_STEPS;
  const normStatus = normalizeStatus(status);

  if (normStatus === 'rejected' || normStatus === 'cancelled') {
    const isRejected = normStatus === 'rejected';
    const TerminalIcon = isRejected ? XCircle : Ban;
    return (
      <div className="flex flex-col items-center justify-center py-6 gap-2">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center ${
            isRejected ? 'bg-red-100' : 'bg-muted'
          }`}
        >
          <TerminalIcon
            className={`h-7 w-7 ${isRejected ? 'text-red-600' : 'text-muted-foreground'}`}
            aria-hidden
          />
        </div>
        <p className={`text-sm font-semibold ${isRejected ? 'text-red-600' : 'text-muted-foreground'}`}>
          {isRejected ? 'Solicitação rejeitada' : 'Solicitação cancelada'}
        </p>
      </div>
    );
  }

  const currentIndex = getStepIndex(steps, status);

  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === steps.length - 1;
        const Icon = step.icon;

        return (
          <div key={step.key} className="flex items-start gap-3 min-h-12">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  isCompleted
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'border-muted-foreground/30 text-muted-foreground bg-transparent'
                }`}
              >
                {isCompleted ? (
                  <CheckCheck className="h-4 w-4" aria-hidden />
                ) : (
                  <Icon className={`h-4 w-4 ${isCurrent ? 'text-primary-foreground' : ''}`} aria-hidden />
                )}
              </div>
              {!isLast && (
                <div
                  className={`w-0.5 flex-1 min-h-4 my-0.5 rounded ${
                    index < currentIndex ? 'bg-emerald-500' : 'bg-muted/60'
                  }`}
                />
              )}
            </div>
            <div className="pb-4 pt-0.5">
              <p
                className={`text-sm ${
                  isCompleted ? 'text-emerald-600 font-medium' : isCurrent ? 'text-foreground font-semibold' : 'text-muted-foreground font-medium'
                }`}
              >
                {step.label}
              </p>
              {isCurrent && (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <motion.span
                    className="w-1.5 h-1.5 rounded-full bg-primary"
                    animate={{ opacity: [1, 0.4, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <span className="text-xs text-primary font-semibold">Etapa atual</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
