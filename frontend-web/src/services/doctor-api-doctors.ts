/**
 * doctor-api-doctors.ts — Notifications, certificates, push tokens, and video rooms.
 */

import { authFetch } from './doctor-api-auth';

// ── Types ──

export interface CertificateInfo {
  id: string;
  subjectName: string;
  issuerName: string;
  notBefore: string;
  notAfter: string;
  isValid: boolean;
  isExpired: boolean;
  daysUntilExpiry: number;
}

// ── Notifications ──

export async function getNotifications(params?: { page?: number; pageSize?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
  const qs = query.toString();
  const res = await authFetch(`/api/notifications${qs ? `?${qs}` : ''}`);
  if (!res.ok) throw new Error('Erro ao buscar notificações');
  return res.json();
}

export async function markNotificationRead(id: string) {
  const res = await authFetch(`/api/notifications/${id}/read`, { method: 'PUT' });
  if (!res.ok) throw new Error('Erro ao marcar como lida');
  return res.json();
}

export async function markAllNotificationsRead() {
  const res = await authFetch('/api/notifications/read-all', { method: 'PUT' });
  if (!res.ok) throw new Error('Erro ao marcar todas como lidas');
  return res.json();
}

export async function getUnreadNotificationCount(): Promise<number> {
  const res = await authFetch('/api/notifications/unread-count');
  if (!res.ok) return 0;
  const data = await res.json();
  return typeof data === 'number' ? data : (data?.count ?? 0);
}

// ── Certificates ──

export async function getActiveCertificate(): Promise<CertificateInfo | null> {
  const res = await authFetch('/api/certificates/active');
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Erro ao buscar certificado');
  }
  return res.json();
}

export async function uploadCertificate(file: File, password: string) {
  const formData = new FormData();
  formData.append('pfxFile', file);
  formData.append('password', password);
  const res = await authFetch('/api/certificates/upload', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Erro ao enviar certificado');
  return res.json();
}

export async function revokeCertificate(id: string, reason: string) {
  const res = await authFetch(`/api/certificates/${id}/revoke`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error('Erro ao revogar certificado');
  return res.json();
}

// ── Push Tokens ──

export async function registerPushToken(token: string) {
  const res = await authFetch('/api/push-tokens', {
    method: 'POST',
    body: JSON.stringify({ token, deviceType: 'web' }),
  });
  if (!res.ok) throw new Error('Erro ao registrar push token');
  return res.json();
}

export async function unregisterPushToken(token: string) {
  const res = await authFetch(`/api/push-tokens?token=${encodeURIComponent(token)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Erro ao remover push token');
}

// ── Video ──

export async function createVideoRoom(requestId: string) {
  const res = await authFetch('/api/video/rooms', {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  });
  if (!res.ok) throw new Error('Erro ao criar sala');
  return res.json();
}

export async function getJoinToken(requestId: string) {
  const res = await authFetch('/api/video/join-token', {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  });
  if (!res.ok) throw new Error('Erro ao obter token de vídeo');
  return res.json();
}

export async function getVideoRoom(requestId: string) {
  const res = await authFetch(`/api/video/by-request/${requestId}`);
  if (!res.ok) return null;
  return res.json();
}


// ── Push Preferences ──

export interface PushPreferencesDto {
  requestsEnabled: boolean;
  paymentsEnabled: boolean;
  consultationsEnabled: boolean;
  remindersEnabled: boolean;
  timezone: string;
}

export async function getPushPreferences(): Promise<PushPreferencesDto> {
  const res = await authFetch('/api/push-tokens/preferences');
  if (!res.ok) {
    return {
      requestsEnabled: true,
      paymentsEnabled: true,
      consultationsEnabled: true,
      remindersEnabled: true,
      timezone: 'America/Sao_Paulo',
    };
  }
  return res.json();
}

export async function updatePushPreferences(prefs: Partial<PushPreferencesDto>): Promise<PushPreferencesDto> {
  const res = await authFetch('/api/push-tokens/preferences', {
    method: 'PUT',
    body: JSON.stringify(prefs),
  });
  if (!res.ok) throw new Error('Erro ao atualizar preferências');
  return res.json();
}
