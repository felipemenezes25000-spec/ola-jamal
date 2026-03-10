/**
 * API do portal do médico — VERSÃO COMPLETA.
 * Inclui TODOS os endpoints do backend: stats, consultation flow, AI,
 * recordings, care plans, doctor notes, triage, e mais.
 *
 * Usa VITE_API_URL como base, token JWT em localStorage.
 */

// ── Types ──

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
  prescriptionImages?: string[];
  examImages?: string[];
  notes?: string;
  doctorConductNotes?: string;
  prescriptionKind?: string;
  autoObservation?: string;
  anamnesisData?: Record<string, unknown>;
  transcriptionText?: string;
  signedDocumentUrl?: string;
  consultationAcceptedAt?: string;
  videoRoomUrl?: string;
  rejectionReason?: string;
  // AI fields
  aiSummaryForDoctor?: string;
  aiExtractedJson?: string;
  aiRiskLevel?: string;
  aiUrgency?: string;
  aiReadabilityOk?: boolean;
  aiMessageToUser?: string;
  aiConductSuggestion?: string;
  aiSuggestedExams?: string;
  // Consultation time
  consultationType?: string;
  contractedMinutes?: number;
  consultationStartedAt?: string;
  doctorCallConnectedAt?: string;
  patientCallConnectedAt?: string;
  // Access
  accessCode?: string;
  signedAt?: string;
  // Consultation summary (pós-vídeo)
  consultationTranscript?: string | null;
  consultationAnamnesis?: string | null;
  consultationAiSuggestions?: string | null;
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

export interface DoctorStats {
  pendingCount: number;
  inReviewCount: number;
  completedCount: number;
  totalEarnings: number;
}

export interface ConsultationSummary {
  anamnesis?: string;
  plan?: string;
}

export interface DoctorNote {
  noteType: string;
  content: string;
  requestId?: string;
}

export interface DoctorNoteDto {
  id: string;
  noteType: string;
  content: string;
  requestId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PatientClinicalSummaryResponse {
  summary?: string | null;
  fallback?: string | null;
  structured?: {
    problemList?: string[];
    activeMedications?: string[];
    carePlan?: string;
    narrativeSummary?: string;
    alerts?: string[];
  } | null;
  doctorNotes?: DoctorNoteDto[];
}

export const DOCTOR_NOTE_TYPES = [
  { key: 'progress_note', label: 'Evolução', icon: 'FileText' },
  { key: 'clinical_impression', label: 'Impressão diagnóstica', icon: 'Stethoscope' },
  { key: 'addendum', label: 'Complemento', icon: 'PlusCircle' },
  { key: 'observation', label: 'Observação', icon: 'Eye' },
] as const;

export interface Recording {
  id: string;
  duration?: number;
  startedAt?: string;
  status?: string;
}

// ── API Base & Auth ──

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

// ── NEW: Stats ──

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

// ── NEW: Consultation Flow ──

export async function startConsultation(id: string) {
  const res = await authFetch(`/api/requests/${id}/start-consultation`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao iniciar consulta');
  return res.json();
}

export async function reportCallConnected(id: string) {
  const res = await authFetch(`/api/requests/${id}/report-call-connected`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao reportar conexão');
  return res.json();
}

export async function finishConsultation(id: string, payload?: { conductNotes?: string }) {
  const res = await authFetch(`/api/requests/${id}/finish-consultation`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error('Erro ao finalizar consulta');
  return res.json();
}

export async function saveConsultationSummary(id: string, payload: ConsultationSummary) {
  const res = await authFetch(`/api/requests/${id}/save-consultation-summary`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao salvar resumo');
  return res.json();
}

export async function autoFinishConsultation(id: string) {
  const res = await authFetch(`/api/requests/${id}/auto-finish-consultation`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao auto-finalizar');
  return res.json();
}

// ── NEW: AI Re-analysis ──

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

// ── NEW: Recordings ──

export async function getRecordings(id: string): Promise<{ recordings: Recording[] }> {
  const res = await authFetch(`/api/requests/${id}/recordings`);
  if (!res.ok) throw new Error('Erro ao buscar gravações');
  return res.json();
}

export async function getTranscriptDownloadUrl(id: string): Promise<{ url: string }> {
  const res = await authFetch(`/api/requests/${id}/transcript-download-url`);
  if (!res.ok) throw new Error('Erro ao buscar transcrição');
  return res.json();
}

// ── NEW: Time Bank ──

export async function getTimeBank() {
  const res = await authFetch('/api/requests/time-bank');
  if (!res.ok) throw new Error('Erro ao buscar banco de horas');
  return res.json();
}

// ── Conduct ──

export async function updateConduct(id: string, payload: { conductNotes: string; includeConductInPdf?: boolean }) {
  const res = await authFetch(`/api/requests/${id}/conduct`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao atualizar conduta');
  return res.json();
}

// ── Prescription/Exam Content ──

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

// ── Patients ──

export async function getPatientProfile(patientId: string): Promise<PatientProfile> {
  const res = await authFetch(`/api/requests/by-patient/${patientId}/profile`);
  if (!res.ok) throw new Error('Erro ao buscar paciente');
  return res.json();
}

export async function getPatientRequests(patientId: string) {
  const res = await authFetch(`/api/requests/by-patient/${patientId}`);
  if (!res.ok) throw new Error('Erro ao buscar histórico');
  return res.json();
}

export async function getPatientClinicalSummary(patientId: string): Promise<PatientClinicalSummaryResponse> {
  const res = await authFetch(`/api/requests/by-patient/${patientId}/summary`);
  if (!res.ok) throw new Error('Erro ao buscar resumo clínico');
  return res.json();
}

// ── NEW: Doctor Notes ──

export async function addDoctorNote(patientId: string, note: DoctorNote): Promise<DoctorNoteDto> {
  const res = await authFetch(`/api/requests/by-patient/${patientId}/doctor-notes`, {
    method: 'POST',
    body: JSON.stringify(note),
  });
  if (!res.ok) throw new Error('Erro ao adicionar nota');
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
  const res = await authFetch('/api/certificates/upload', { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Erro ao enviar certificado');
  return res.json();
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

// ── NEW: Consultation Transcription ──

export async function transcribeText(requestId: string, text: string, speaker: 'medico' | 'paciente', startTimeSeconds?: number) {
  const res = await authFetch('/api/consultation/transcribe-text', {
    method: 'POST',
    body: JSON.stringify({ requestId, text, speaker, startTimeSeconds }),
  });
  if (!res.ok) throw new Error('Erro na transcrição');
  return res.json();
}

// ── NEW: AI Assistant ──

export async function getAssistantNextAction(requestId?: string, status?: string, requestType?: string) {
  const res = await authFetch('/api/assistant/next-action', {
    method: 'POST',
    body: JSON.stringify({ requestId, status, requestType }),
  });
  if (!res.ok) throw new Error('Erro ao buscar ação');
  return res.json();
}

// ── NEW: Care Plans ──

export async function getExamSuggestions(consultationId: string) {
  const res = await authFetch(`/api/care-plans/consultations/${consultationId}/ai/exam-suggestions`);
  if (!res.ok) return [];
  return res.json();
}

export async function generateExamSuggestions(consultationId: string) {
  const res = await authFetch(`/api/care-plans/consultations/${consultationId}/ai/exam-suggestions`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao gerar sugestões');
  return res.json();
}

// ── NEW: Triage ──

export async function enrichTriage(payload: { symptoms?: string; requestType?: string }) {
  const res = await authFetch('/api/triage/enrich', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro na triagem');
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

// ── Prescription Images ──

export async function getPrescriptionImage(id: string, index: number): Promise<string> {
  const res = await authFetch(`/api/requests/${id}/prescription-image/${index}`);
  if (!res.ok) throw new Error('Erro ao buscar imagem');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function getExamImage(id: string, index: number): Promise<string> {
  const res = await authFetch(`/api/requests/${id}/exam-image/${index}`);
  if (!res.ok) throw new Error('Erro ao buscar imagem');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
