/**
 * doctor-api-requests.ts — Request CRUD, actions, stats, and AI re-analysis.
 */

import { authFetch } from './doctor-api-auth';
import type { MedicalRequest, DoctorStats } from './doctorApi';

/**
 * Normaliza um objeto raw da API para o tipo MedicalRequest.
 * Backend serializa requestType (C# record camelCase), frontend usa .type.
 */
function normalizeMedicalRequest(r: Record<string, unknown>): MedicalRequest {
  return {
    ...r,
    type: ((r.type as string) || (r.requestType as string) || '') as MedicalRequest['type'],
  } as MedicalRequest;
}

// ── Requests ──

export async function getRequests(params?: { page?: number; pageSize?: number; status?: string; type?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  if (params?.status) query.set('status', params.status);
  if (params?.type) query.set('type', params.type);
  const qs = query.toString();
  const res = await authFetch(`/api/requests${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Erro ao buscar pedidos');
  const data = await res.json();
  // Normaliza lista: pode vir como array, { items: [...] } ou { data: [...] }
  if (Array.isArray(data)) return data.map(normalizeMedicalRequest);
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.items)) return { ...obj, items: (obj.items as Record<string, unknown>[]).map(normalizeMedicalRequest) };
    if (Array.isArray(obj.data)) return { ...obj, data: (obj.data as Record<string, unknown>[]).map(normalizeMedicalRequest) };
  }
  return data;
}

export async function getRequestById(id: string): Promise<MedicalRequest> {
  const res = await authFetch(`/api/requests/${id}`);
  if (!res.ok) throw new Error('Erro ao buscar pedido');
  const data = await res.json();
  return normalizeMedicalRequest(data as Record<string, unknown>);
}

// ── Stats ──

export async function getDoctorStats(): Promise<DoctorStats> {
  const res = await authFetch('/api/requests/stats');
  if (!res.ok) throw new Error('Erro ao buscar estatísticas');
  return res.json();
}

// ── Request Actions ──

export async function approveRequest(id: string) {
  const res = await authFetch(`/api/requests/${id}/approve`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao aprovar');
  return res.json();
}

export async function rejectRequest(id: string, reason?: string) {
  const res = await authFetch(`/api/requests/${id}/reject`, {
    method: 'POST',
    // FIX: backend espera "rejectionReason", não "reason"
    body: JSON.stringify({ rejectionReason: reason || '' }),
  });
  if (!res.ok) throw new Error('Erro ao recusar');
  return res.json();
}

export async function signRequest(id: string, password: string) {
  const res = await authFetch(`/api/requests/${id}/sign`, {
    method: 'POST',
    // FIX: backend espera "pfxPassword", não "certificatePassword"
    body: JSON.stringify({ pfxPassword: password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error((err.message as string) || 'Erro ao assinar documento');
  }
  return res.json();
}

export async function acceptConsultation(id: string) {
  const res = await authFetch(`/api/requests/${id}/accept-consultation`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao aceitar consulta');
  return res.json();
}

// ── AI Re-analysis ──

export async function reanalyzePrescription(id: string) {
  const res = await authFetch(`/api/requests/${id}/reanalyze-prescription`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao reanalisar receita');
  return res.json();
}

export async function reanalyzeExam(id: string) {
  const res = await authFetch(`/api/requests/${id}/reanalyze-exam`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao reanalisar exame');
  return res.json();
}

export async function reanalyzeAsDoctor(id: string) {
  const res = await authFetch(`/api/requests/${id}/reanalyze-as-doctor`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao reanalisar como médico');
  return res.json();
}
