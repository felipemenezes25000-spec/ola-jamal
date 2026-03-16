/**
 * doctor-api-requests.ts — Request CRUD, actions, stats, and AI re-analysis.
 */

import { authFetch } from './doctor-api-auth';
import type { MedicalRequest, DoctorStats } from './doctorApi';

// ── Normalize ──

/**
 * Normaliza campos do backend (.NET PascalCase → camelCase) que o frontend espera.
 * O backend envia `requestType: "Consultation"`, o frontend usa `type: "consultation"`.
 */
function normalizeRequest(data: Record<string, unknown>): Record<string, unknown> {
  if (!data.type && data.requestType) {
    data.type = (data.requestType as string).toLowerCase();
  } else if (data.type && typeof data.type === 'string') {
    data.type = data.type.toLowerCase();
  }
  if (!data.patientName) {
    data.patientName = data.patientName ?? data.PatientName ?? '';
  }
  if (!data.createdAt && data.created_at) {
    data.createdAt = data.created_at;
  }
  return data;
}

function normalizeList(raw: unknown): unknown {
  const arr = Array.isArray(raw) ? raw : (raw as Record<string, unknown>)?.items ?? (raw as Record<string, unknown>)?.data ?? raw;
  if (Array.isArray(arr)) {
    arr.forEach((item: Record<string, unknown>) => normalizeRequest(item));
  }
  return raw;
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
  return normalizeList(data);
}

export async function getRequestById(id: string): Promise<MedicalRequest> {
  const res = await authFetch(`/api/requests/${id}`);
  if (!res.ok) throw new Error('Erro ao buscar pedido');
  const data = await res.json();
  normalizeRequest(data);
  return data as MedicalRequest;
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
    body: JSON.stringify({ reason: reason || '' }),
  });
  if (!res.ok) throw new Error('Erro ao recusar');
  return res.json();
}

export async function signRequest(id: string, password: string) {
  const res = await authFetch(`/api/requests/${id}/sign`, {
    method: 'POST',
    body: JSON.stringify({ certificatePassword: password }),
  });
  if (!res.ok) throw new Error('Erro ao assinar');
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

// ── Cancel / Deliver / Download / Queue (P0-P1 features) ──

export async function cancelRequest(id: string) {
  const res = await authFetch(`/api/requests/${id}/cancel`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao cancelar pedido');
  return res.json();
}

export async function markRequestDelivered(id: string) {
  const res = await authFetch(`/api/requests/${id}/deliver`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao marcar como entregue');
  return res.json();
}

export async function generatePdf(id: string): Promise<{ success: boolean; pdfUrl: string; message: string }> {
  const res = await authFetch(`/api/requests/${id}/generate-pdf`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao gerar PDF');
  return res.json();
}

export async function getDocumentDownloadUrl(id: string): Promise<string> {
  const res = await authFetch(`/api/requests/${id}/document-download-url`);
  if (!res.ok) throw new Error('Erro ao obter URL de download');
  const data = await res.json();
  return typeof data === 'string' ? data : (data?.url ?? data?.downloadUrl ?? '');
}

export async function getDoctorQueue(specialty?: string) {
  const query = specialty ? `?specialty=${encodeURIComponent(specialty)}` : '';
  const res = await authFetch(`/api/doctors/queue${query}`);
  if (!res.ok) throw new Error('Erro ao buscar fila');
  return res.json();
}

export async function assignToQueue(id: string) {
  const res = await authFetch(`/api/requests/${id}/assign-queue`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao atribuir à fila');
  return res.json();
}
