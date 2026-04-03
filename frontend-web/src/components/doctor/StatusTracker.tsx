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
  {
    key: 'review',
    label: 'Análise',
    icon: Eye,
    statuses: ['analyzing', 'in_review'],
  },
  {
    key: 'approved',
    label: 'Assinatura',
    icon: FileText,
    statuses: ['approved_pending_payment', 'pending_payment', 'paid'],
  },
  { key: 'signed', label: 'Assinado', icon: ShieldCheck, statuses: ['signed'] },
  {
    key: 'delivered',
    label: 'Entregue',
    icon: CheckCheck,
    statuses: ['delivered', 'completed'],
  },
];

// Consulta
const CONSULTATION_STEPS: Step[] = [
  {
    key: 'searching',
    label: 'Buscando profissional',
    icon: Search,
    statuses: ['searching_doctor'],
  },
  {
    key: 'ready',
    label: 'Consulta pronta',
    icon: CheckCircle2,
    statuses: [
      'approved_pending_payment',
      'pending_payment',
      'paid',
      'consultation_ready',
      'consultation_accepted',
    ],
  },
  {
    key: 'in_consultation',
    label: 'Em consulta',
    icon: Video,
    statuses: ['in_consultation'],
  },
  {
    key: 'finished',
    label: 'Finalizada',
    icon: CheckCheck,
    statuses: ['consultation_finished'],
  },
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

export function StatusTracker({
  status,
  type,
  requestType,
}: StatusTrackerProps) {
  const reqType = (type || requestType || '').toLowerCase();
  const steps =
    reqType === 'consultation' ? CONSULTATION_STEPS : PRESCRIPTION_STEPS;
  const normStatus = normalizeStatus(status);

  if (normStatus === 'rejected' || normStatus === 'cancelled') {
    const isRejected = normStatus === 'rejected';
    const TerminalIcon = isRejected ? XCircle : Ban;
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6">
        <div
          className={`flex h-14 w-14 items-center justify-center rounded-full ${
            isRejected ? 'bg-red-100' : 'bg-muted'
          }`}
        >
          <TerminalIcon
            className={`h-7 w-7 ${isRejected ? 'text-red-600' : 'text-muted-foreground'}`}
            aria-hidden
          />
        </div>
        <p
          className={`text-sm font-semibold ${isRejected ? 'text-red-600' : 'text-muted-foreground'}`}
        >
          {isRejected ? 'Solicitação rejeitada' : 'Solicitação cancelada'}
        </p>
      </div>
    );
  }

  const currentIndex = getStepIndex(steps, status);

  return (
    <div className="w-full rounded-xl border bg-white p-4 dark:bg-card sm:p-6">
      {/* Desktop: horizontal */}
      <div className="relative hidden items-start justify-between sm:flex">
        {/* Connecting line behind circles */}
        <div
          className="absolute left-0 right-0 top-4 z-0 h-0.5 bg-muted"
          style={{ marginLeft: '2rem', marginRight: '2rem' }}
        />
        <div
          className="absolute left-0 top-4 z-0 h-0.5 bg-emerald-500 transition-all duration-500"
          style={{
            marginLeft: '2rem',
            width:
              currentIndex > 0
                ? `calc(${(currentIndex / (steps.length - 1)) * 100}% - 4rem)`
                : '0',
          }}
        />

        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className="z-10 flex flex-1 flex-col items-center"
            >
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                  isCompleted
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : isCurrent
                      ? 'border-sky-900 bg-sky-900 text-white'
                      : 'border-gray-300 bg-white text-gray-400 dark:bg-card'
                }`}
              >
                {isCompleted ? (
                  <CheckCheck className="h-4 w-4" aria-hidden />
                ) : (
                  <Icon className="h-4 w-4" aria-hidden />
                )}
              </div>
              <p
                className={`mt-2 max-w-[80px] text-center text-xs font-medium leading-tight ${
                  isCompleted
                    ? 'text-emerald-600'
                    : isCurrent
                      ? 'font-semibold text-sky-900 dark:text-sky-300'
                      : 'text-muted-foreground'
                }`}
              >
                {step.label}
              </p>
              {isCurrent && (
                <motion.span
                  className="mt-1 h-1.5 w-1.5 rounded-full bg-sky-900 dark:bg-sky-400"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: compact horizontal with smaller elements */}
      <div className="flex items-center justify-between gap-1 sm:hidden">
        {steps.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isLast = index === steps.length - 1;
          const Icon = step.icon;

          return (
            <div
              key={step.key}
              className="flex flex-1 items-center last:flex-none"
            >
              <div className="flex flex-col items-center">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : isCurrent
                        ? 'border-sky-900 bg-sky-900 text-white'
                        : 'border-gray-300 bg-white text-gray-400 dark:bg-card'
                  }`}
                >
                  {isCompleted ? (
                    <CheckCheck className="h-3 w-3" aria-hidden />
                  ) : (
                    <Icon className="h-3 w-3" aria-hidden />
                  )}
                </div>
                <p
                  className={`mt-1 max-w-[50px] text-center text-[10px] leading-tight ${
                    isCompleted
                      ? 'font-medium text-emerald-600'
                      : isCurrent
                        ? 'font-semibold text-sky-900 dark:text-sky-300'
                        : 'text-muted-foreground'
                  }`}
                >
                  {step.label}
                </p>
              </div>
              {!isLast && (
                <div
                  className={`mx-1 h-0.5 flex-1 rounded ${
                    index < currentIndex
                      ? 'bg-emerald-500'
                      : 'bg-gray-200 dark:bg-muted'
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
