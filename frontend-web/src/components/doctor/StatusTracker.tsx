/**
 * StatusTracker — Horizontal timeline on desktop, compact on mobile.
 *
 * - Circles connected by lines (horizontal desktop / vertical mobile)
 * - 4-5 steps depending on type
 * - Terminal states (rejected/cancelled): special UI without timeline
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
} from 'lucide-react';
import { motion } from 'framer-motion';
import { normalizeStatus } from '@/lib/doctor-helpers';

interface Step {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  statuses: string[];
}

// Receita e Exame
const PRESCRIPTION_STEPS: Step[] = [
  { key: 'submitted', label: 'Enviado', icon: Send, statuses: ['submitted'] },
  { key: 'review', label: 'Análise', icon: Eye, statuses: ['analyzing', 'in_review'] },
  { key: 'approved', label: 'Assinatura', icon: FileText, statuses: ['approved_pending_payment', 'pending_payment', 'paid'] },
  { key: 'signed', label: 'Assinado', icon: ShieldCheck, statuses: ['signed'] },
  { key: 'delivered', label: 'Entregue', icon: CheckCheck, statuses: ['delivered', 'completed'] },
];

// Consulta
const CONSULTATION_STEPS: Step[] = [
  { key: 'searching', label: 'Buscando médico', icon: Search, statuses: ['searching_doctor'] },
  { key: 'ready', label: 'Consulta pronta', icon: CheckCircle2, statuses: ['approved_pending_payment', 'pending_payment', 'paid', 'consultation_ready', 'consultation_accepted'] },
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
    <div className="w-full rounded-xl bg-white dark:bg-card border p-4 sm:p-6">
      {/* Desktop: horizontal */}
      <div className="hidden sm:flex items-start justify-between relative">
        {/* Connecting line behind circles */}
        <div className="absolute top-4 left-0 right-0 h-0.5 bg-muted z-0" style={{ marginLeft: '2rem', marginRight: '2rem' }} />
        <div
          className="absolute top-4 left-0 h-0.5 bg-emerald-500 z-0 transition-all duration-500"
          style={{
            marginLeft: '2rem',
            width: currentIndex > 0
              ? `calc(${(currentIndex / (steps.length - 1)) * 100}% - 4rem)`
              : '0',
          }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex flex-col items-center z-10 flex-1">
              <div
                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  isCompleted
                    ? 'bg-emerald-500 border-emerald-500 text-white'
                    : isCurrent
                      ? 'bg-sky-900 border-sky-900 text-white'
                      : 'border-gray-300 text-gray-400 bg-white dark:bg-card'
                }`}
              >
                {isCompleted ? (
                  <CheckCheck className="h-4 w-4" aria-hidden />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden />
                )}
              </div>
              <p
                className={`text-xs mt-2 text-center font-medium leading-tight max-w-[80px] ${
                  isCompleted
                    ? 'text-emerald-600'
                    : isCurrent
                      ? 'text-sky-900 dark:text-sky-300 font-semibold'
                      : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </p>
              {isCurrent && (
                <motion.span
                  className="w-1.5 h-1.5 rounded-full bg-sky-900 dark:bg-sky-400 mt-1"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: compact horizontal with smaller elements */}
      <div className="flex sm:hidden items-center justify-between gap-1">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;
          const Icon = step.icon;

          return (
            <div key={step.key} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center">
                <div
                  className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-500 border-emerald-500 text-white'
                      : isCurrent
                        ? 'bg-sky-900 border-sky-900 text-white'
                        : 'border-gray-300 text-gray-400 bg-white dark:bg-card'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCheck className="h-3 w-3" aria-hidden />
                  ) : (
                    <Icon className="h-3 w-3" aria-hidden />
                  )}
                </div>
                <p
                  className={`text-[10px] mt-1 text-center leading-tight max-w-[50px] ${
                    isCompleted
                      ? 'text-emerald-600 font-medium'
                      : isCurrent
                        ? 'text-sky-900 dark:text-sky-300 font-semibold'
                        : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </p>
              </div>
              {!isLast && (
                <div
                  className={`h-0.5 flex-1 mx-1 rounded ${
                    index < currentIndex ? 'bg-emerald-500' : 'bg-gray-200 dark:bg-muted'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
