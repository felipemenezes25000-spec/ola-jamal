/**
 * API do portal do médico.
 * Usa VITE_API_URL como base, token JWT em localStorage.
 */

export interface DoctorUser {
  id: string;
  email: string;
  name: string;
  role: string;
  profileComplete?: boolean;
  avatarUrl?: string;
}

export interface DoctorProfile {
  id: string;
  userId: string;
  crm: string;
  crmState: string;
  specialty: string;
  professionalPhone?: string;
  professionalAddress?: string;
  approvalStatus: string;
  hasCertificate?: boolean;
}

export interface MedicalRequest {
  id: string;
  patientName: string;
  patientEmail?: string;
  patientId?: string;
  type: 'prescription' | 'exam' | 'consultation';
  status: string;
  createdAt: string;
  updatedAt?: string;
  description?: string;
  symptoms?: string[];
  medications?: Medication[];
  exams?: ExamItem[];
  images?: string[];
  notes?: string;
  doctorConductNotes?: string;
  aiConductSuggestion?: string;
  aiSuggestedExams?: string;
  prescriptionKind?: string;
  autoObservation?: string;
  anamnesisData?: Record<string, unknown>;
  transcriptionText?: string;
  signedDocumentUrl?: string;
  consultationAcceptedAt?: string;
  videoRoomUrl?: string;
}

export interface Medication {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  notes?: string;
}

export interface ExamItem {
  name: string;
  notes?: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
  data?: Record<string, unknown>;
}

export interface PatientProfile {
  id: string;
  name: string;
  email: string;
  phone?: string;
  birthDate?: string;
  gender?: string;
  allergies?: string[];
  chronicConditions?: string[];
  avatarUrl?: string;
}

export interface Specialty {
  id: string;
  name: string;
}

function getApiBase(): string {
  const env = (import.meta.env.VITE_API_URL ?? '').trim().replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
}

const TOKEN_KEY = 'doctor_auth_token';
const USER_KEY = 'doctor_user';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): DoctorUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeAuth(token: string, user: DoctorUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const base = getApiBase();
  if (!base) throw new Error('URL da API não configurada. Defina VITE_API_URL.');
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${base}${url}`, { ...options, headers });
  if (res.status === 401) {
    clearAuth();
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }
  return res;
}

// ── Auth ──

export async function loginDoctor(email: string, password: string) {
  const base = getApiBase();
  if (!base) throw new Error('URL da API não configurada.');
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Credenciais inválidas');
  }
  const data = await res.json();
  const role = (data.user?.role ?? '').toString().toLowerCase();
  if (role !== 'doctor') {
    throw new Error('Acesso restrito a médicos. Use uma conta de médico.');
  }
  storeAuth(data.token, data.user);
  return data;
}

export async function registerDoctor(payload: {
  name: string;
  email: string;
  password: string;
  phone: string;
  cpf: string;
  crm: string;
  crmState: string;
  specialtyId: string;
}) {
  const base = getApiBase();
  if (!base) throw new Error('URL da API não configurada.');
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, role: 'doctor' }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Erro ao criar conta');
  }
  return res.json();
}

export async function registerDoctorFull(payload: {
  name: string;
  email: string;
  password: string;
  phone: string;
  cpf: string;
  crm: string;
  crmState: string;
  specialtyId: string;
  professionalPhone?: string;
  professionalAddress?: string;
  city?: string;
  state?: string;
  cep?: string;
}) {
  const base = getApiBase();
  if (!base) throw new Error('URL da API não configurada.');
  const res = await fetch(`${base}/api/auth/register-doctor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Erro ao criar conta');
  }
  return res.json();
}

export function logoutDoctor() {
  clearAuth();
  window.location.href = '/login';
}

export function isDoctorAuthenticated(): boolean {
  return !!getToken();
}

export async function getMe(): Promise<DoctorUser> {
  const res = await authFetch('/api/auth/me');
  if (!res.ok) throw new Error('Erro ao buscar perfil');
  const data = await res.json();
  localStorage.setItem(USER_KEY, JSON.stringify(data));
  return data;
}

export async function getDoctorProfile(): Promise<DoctorProfile> {
  const res = await authFetch('/api/doctors/me');
  if (!res.ok) throw new Error('Erro ao buscar perfil médico');
  return res.json();
}

export async function updateDoctorProfile(payload: Partial<DoctorProfile>) {
  const res = await authFetch('/api/doctors/me/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao atualizar perfil');
  return res.json();
}

export async function updateAvatar(file: File) {
  const formData = new FormData();
  formData.append('avatar', file);
  const res = await authFetch('/api/auth/avatar', {
    method: 'PATCH',
    body: formData,
  });
  if (!res.ok) throw new Error('Erro ao atualizar avatar');
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const res = await authFetch('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) throw new Error('Erro ao alterar senha');
  return res.json();
}

export async function forgotPassword(email: string) {
  const base = getApiBase();
  const res = await fetch(`${base}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error('Erro ao enviar email');
  return res.json();
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
  return res.json();
}

export async function getRequestById(id: string): Promise<MedicalRequest> {
  const res = await authFetch(`/api/requests/${id}`);
  if (!res.ok) throw new Error('Erro ao buscar pedido');
  return res.json();
}

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

export async function updateConduct(id: string, payload: { conductNotes: string; includeConductInPdf?: boolean }) {
  const res = await authFetch(`/api/requests/${id}/conduct`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao atualizar conduta');
  return res.json();
}

export async function updatePrescriptionContent(id: string, payload: {
  medications?: Medication[];
  notes?: string;
  prescriptionKind?: string;
}) {
  const res = await authFetch(`/api/requests/${id}/prescription-content`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao atualizar receita');
  return res.json();
}

export async function updateExamContent(id: string, payload: { exams?: ExamItem[]; notes?: string }) {
  const res = await authFetch(`/api/requests/${id}/exam-content`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao atualizar exame');
  return res.json();
}

export async function getPreviewPdf(id: string): Promise<string> {
  const res = await authFetch(`/api/requests/${id}/preview-pdf`);
  if (!res.ok) throw new Error('Erro ao gerar preview');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function getPreviewExamPdf(id: string): Promise<string> {
  const res = await authFetch(`/api/requests/${id}/preview-exam-pdf`);
  if (!res.ok) throw new Error('Erro ao gerar preview');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function validatePrescription(id: string) {
  const res = await authFetch(`/api/requests/${id}/validate-prescription`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao validar');
  return res.json();
}

export async function saveConsultationSummary(id: string, payload: { clinicalNote?: string; anamnesis?: string }) {
  const res = await authFetch(`/api/requests/${id}/save-consultation-summary`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao salvar resumo');
  return res.json();
}

// ── Patients ──

export async function getPatientProfile(patientId: string): Promise<PatientProfile> {
  const res = await authFetch(`/api/patients/${patientId}/profile-for-doctor`);
  if (!res.ok) throw new Error('Erro ao buscar paciente');
  return res.json();
}

export async function getPatientRequests(patientId: string) {
  const res = await authFetch(`/api/patients/${patientId}/requests`);
  if (!res.ok) throw new Error('Erro ao buscar histórico');
  return res.json();
}

export async function getPatientClinicalSummary(patientId: string) {
  const res = await authFetch(`/api/patients/${patientId}/clinical-summary`);
  if (!res.ok) throw new Error('Erro ao buscar resumo clínico');
  return res.json();
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

// ── Certificates ──

export async function getActiveCertificate() {
  const res = await authFetch('/api/certificates/active');
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Erro ao buscar certificado');
  }
  return res.json();
}

export async function uploadCertificate(file: File, password: string) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('password', password);
  const res = await authFetch('/api/certificates/upload', {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error('Erro ao enviar certificado');
  return res.json();
}

// ── Video ──

export async function createVideoRoom(requestId: string) {
  const res = await authFetch(`/api/video/room`, {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  });
  if (!res.ok) throw new Error('Erro ao criar sala');
  return res.json();
}

export async function getVideoToken(requestId: string) {
  const res = await authFetch(`/api/video/token?requestId=${requestId}`);
  if (!res.ok) throw new Error('Erro ao obter token de vídeo');
  return res.json();
}

// ── Specialties ──

export async function fetchSpecialties(): Promise<Specialty[]> {
  const base = getApiBase();
  const res = await fetch(`${base}/api/specialties`);
  if (!res.ok) return [];
  return res.json();
}

// ── CID ──

export async function searchCid(query: string) {
  const res = await authFetch(`/api/cid10?q=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  return res.json();
}

// ── Address (ViaCEP) ──

export async function fetchAddressByCep(cep: string) {
  const clean = cep.replace(/\D/g, '');
  if (clean.length !== 8) return null;
  const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
  if (!res.ok) return null;
  const data = await res.json();
  if (data.erro) return null;
  return {
    street: data.logradouro,
    neighborhood: data.bairro,
    city: data.localidade,
    state: data.uf,
  };
}
