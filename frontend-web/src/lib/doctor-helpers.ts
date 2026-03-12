/**
 * Helpers compartilhados para o portal do médico.
 * Elimina duplicação de getTypeIcon, getTypeLabel, getStatusInfo, formatDate, parseApiList.
 */
import {
  FileText, FlaskConical, Stethoscope, Clock, CheckCircle2, XCircle,
  AlertTriangle, Truck, Search, Shield, Eye, Play,
  type LucideIcon,
} from 'lucide-react';

// ── Types ──

export type RequestTypeName = 'prescription' | 'exam' | 'consultation';

export interface StatusInfo {
  label: string;
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color: string;
  bgColor: string;
  icon: LucideIcon;
  priority: number; // lower = more urgent
}

// ── Request Type Helpers ──

export function getTypeIcon(type: string): LucideIcon {
  switch (type) {
    case 'prescription': return FileText;
    case 'exam': return FlaskConical;
    case 'consultation': return Stethoscope;
    default: return FileText;
  }
}

export function getTypeLabel(type: string): string {
  switch (type) {
    case 'prescription': return 'Receita';
    case 'exam': return 'Exame';
    case 'consultation': return 'Consulta';
    default: return type;
  }
}

export function getTypeColor(type: string): string {
  switch (type) {
    case 'prescription': return 'text-blue-600';
    case 'exam': return 'text-purple-600';
    case 'consultation': return 'text-emerald-600';
    default: return 'text-gray-600';
  }
}

export function getTypeBgColor(type: string): string {
  switch (type) {
    case 'prescription': return 'bg-blue-50';
    case 'exam': return 'bg-purple-50';
    case 'consultation': return 'bg-emerald-50';
    default: return 'bg-gray-50';
  }
}

// ── Status Helpers (COMPLETE mapping including all backend statuses) ──

const STATUS_MAP: Record<string, StatusInfo> = {
  // Canonical statuses
  submitted:                { label: 'Novo pedido',              variant: 'default',      color: 'text-orange-700',  bgColor: 'bg-orange-50 border-orange-200',   icon: AlertTriangle, priority: 1 },
  in_review:                { label: 'Em análise',               variant: 'default',      color: 'text-blue-600',    bgColor: 'bg-blue-50 border-blue-200',       icon: Eye,           priority: 2 },
  searching_doctor:         { label: 'Buscando médico',          variant: 'default',      color: 'text-purple-600',  bgColor: 'bg-purple-50 border-purple-200',   icon: Search,        priority: 2 },
  approved_pending_payment: { label: 'Aguardando pagamento',     variant: 'outline',      color: 'text-amber-600',   bgColor: 'bg-amber-50 border-amber-200',     icon: Clock,         priority: 3 },
  paid:                     { label: 'Pago',                     variant: 'default',      color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2,  priority: 4 },
  in_consultation:          { label: 'Em consulta',              variant: 'default',      color: 'text-primary',     bgColor: 'bg-primary/5 border-primary/20',   icon: Play,          priority: 1 },
  consultation_ready:       { label: 'Consulta pronta',          variant: 'default',      color: 'text-primary',     bgColor: 'bg-primary/5 border-primary/20',   icon: Stethoscope,   priority: 2 },
  consultation_finished:    { label: 'Consulta finalizada',      variant: 'secondary',    color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2,  priority: 8 },
  signed:                   { label: 'Assinado',                 variant: 'secondary',    color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: Shield,        priority: 9 },
  delivered:                { label: 'Entregue',                 variant: 'secondary',    color: 'text-gray-600',    bgColor: 'bg-gray-50 border-gray-200',       icon: Truck,         priority: 10 },
  rejected:                 { label: 'Recusado',                 variant: 'destructive',  color: 'text-red-600',     bgColor: 'bg-red-50 border-red-200',         icon: XCircle,       priority: 11 },
  cancelled:                { label: 'Cancelado',                variant: 'destructive',  color: 'text-gray-400',    bgColor: 'bg-gray-50 border-gray-200',       icon: XCircle,       priority: 12 },

  // Legacy statuses (still in production data)
  pending:                  { label: 'Pendente',                 variant: 'outline',      color: 'text-orange-600',  bgColor: 'bg-orange-50 border-orange-200',   icon: Clock,         priority: 1 },
  analyzing:                { label: 'Analisando',               variant: 'default',      color: 'text-blue-600',    bgColor: 'bg-blue-50 border-blue-200',       icon: Eye,           priority: 2 },
  approved:                 { label: 'Aprovado',                 variant: 'secondary',    color: 'text-blue-600',    bgColor: 'bg-blue-50 border-blue-200',       icon: CheckCircle2,  priority: 3 },
  pending_payment:          { label: 'Aguardando pagamento',     variant: 'outline',      color: 'text-amber-600',   bgColor: 'bg-amber-50 border-amber-200',     icon: Clock,         priority: 3 },
  completed:                { label: 'Concluído',                variant: 'secondary',    color: 'text-emerald-700', bgColor: 'bg-emerald-50 border-emerald-200', icon: CheckCircle2,  priority: 9 },

  // Consultation-specific (legacy)
  // consultation_accepted: alias de consultation_ready (status legado em dados históricos)
  consultation_accepted:    { label: 'Consulta pronta',           variant: 'default',      color: 'text-primary',     bgColor: 'bg-primary/5 border-primary/20',   icon: Stethoscope,   priority: 3 },
};

/** Normaliza status camelCase (backend) para snake_case (STATUS_MAP). Exportado para uso em páginas. */
export function normalizeStatus(status: string | undefined): string {
  if (!status) return '';
  return status.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

export function getStatusInfo(status: string): StatusInfo {
  const normalized = normalizeStatus(status);
  return STATUS_MAP[normalized] || STATUS_MAP[status] || {
    label: status || 'Desconhecido',
    variant: 'outline' as const,
    color: 'text-gray-500',
    bgColor: 'bg-gray-50 border-gray-200',
    icon: Clock,
    priority: 99,
  };
}

export function isActionableStatus(status: string): boolean {
  const actionable = ['submitted', 'pending', 'paid', 'in_review', 'searching_doctor', 'consultation_ready', 'in_consultation', 'approved', 'approved_pending_payment'];
  const normalized = normalizeStatus(status);
  return actionable.includes(normalized) || actionable.includes(status);
}

// ── AI Risk Helpers ──

export function getRiskBadge(riskLevel?: string | null) {
  if (!riskLevel) return null;
  const risk = riskLevel.toLowerCase();
  if (risk.includes('high') || risk.includes('alto')) return { label: 'Alto Risco', color: 'bg-red-100 text-red-800 border-red-300' };
  if (risk.includes('medium') || risk.includes('médio') || risk.includes('medio')) return { label: 'Risco Médio', color: 'bg-amber-100 text-amber-800 border-amber-300' };
  if (risk.includes('low') || risk.includes('baixo')) return { label: 'Baixo Risco', color: 'bg-green-100 text-green-800 border-green-300' };
  return { label: riskLevel, color: 'bg-gray-100 text-gray-800 border-gray-300' };
}

// ── Date Formatters ──

export function formatRelativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 0) return 'Agora';
  if (mins < 1) return 'Agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Ontem';
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

export function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

// ── Greeting ──

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

// ── API Response Parser ──

export function parseApiList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return obj.items;
    if (Array.isArray(obj.data)) return obj.data;
  }
  return [];
}

// ── Masks ──

export function maskCPF(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function maskCEP(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

// ── Waiting time ──

export function getWaitingTime(createdAt: string): { label: string; urgent: boolean } {
  const mins = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (mins < 60) return { label: `${mins}min`, urgent: mins > 30 };
  const hours = Math.floor(mins / 60);
  if (hours < 24) return { label: `${hours}h`, urgent: hours > 2 };
  const days = Math.floor(hours / 24);
  return { label: `${days}d`, urgent: true };
}
