import { apiClient } from './api-client';
import { logApiError } from './logger';
import {
  RequestResponseDto,
  RequestStatus,
  PaymentResponseDto,
  DoctorProfileDto,
  DoctorListResponseDto,
  PagedResponse,
  CrmValidationResponseDto,
  CertificateInfoDto,
  UploadCertificateResponseDto,
  PatientSummaryDto,
  EncounterSummaryDto,
  MedicalDocumentSummaryDto,
  PatientProfileForDoctorDto,
  VideoRoomResponseDto,
  UserDto,
} from '../types/database';

// Re-export para quem importava de api.ts
export type { UserDto };

// ============================================
// AUTH
// ============================================

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiClient.patch('/api/auth/change-password', {
    currentPassword,
    newPassword,
  });
}

export async function updateAvatar(uri: string, filename?: string): Promise<UserDto> {
  const formData = new FormData();
  const name = filename ?? uri.split('/').pop() ?? 'avatar.jpg';
  const type = name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  formData.append('avatar', {
    uri,
    name,
    type,
  } as unknown as Blob);
  return apiClient.patchMultipart<UserDto>('/api/auth/avatar', formData);
}

// ============================================
// REQUEST MANAGEMENT
// ============================================

function getContentTypeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'heic' || ext === 'heif') return 'image/heic';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

export interface CreatePrescriptionRequestData {
  prescriptionType: 'simples' | 'controlado' | 'azul';
  medications?: string[];  // Backend expects List<string>, NOT objects
  images?: string[]; // URIs for image picker results
}

export async function createPrescriptionRequest(
  data: CreatePrescriptionRequestData
): Promise<{ request: RequestResponseDto; payment?: PaymentResponseDto }> {
  // Always use multipart when images are provided
  if (data.images && data.images.length > 0) {
    const formData = new FormData();
    formData.append('prescriptionType', data.prescriptionType);

    for (let i = 0; i < data.images.length; i++) {
      const uri = data.images[i];
      const filename = uri.split('/').pop() || `prescription_${i}.jpg`;
      const type = getContentTypeFromFilename(filename);

      formData.append('images', {
        uri,
        name: filename,
        type,
      } as unknown as Blob);
    }

    return apiClient.post('/api/requests/prescription', formData, true);
  }

  // JSON without images
  return apiClient.post('/api/requests/prescription', {
    prescriptionType: data.prescriptionType,
    medications: data.medications || [],
  });
}

export interface CreateExamRequestData {
  examType: string;
  exams: string[];
  symptoms?: string;
  images?: string[];
}

export async function createExamRequest(
  data: CreateExamRequestData
): Promise<{ request: RequestResponseDto; payment?: PaymentResponseDto }> {
  // Use multipart when images are provided
  if (data.images && data.images.length > 0) {
    const formData = new FormData();
    formData.append('examType', data.examType);
    // Backend splits by \n, comma, or semicolon for multipart
    formData.append('exams', data.exams.join('\n'));
    if (data.symptoms) formData.append('symptoms', data.symptoms);

    for (let i = 0; i < data.images.length; i++) {
      const uri = data.images[i];
      const filename = uri.split('/').pop() || `exam_${i}.jpg`;
      const type = getContentTypeFromFilename(filename);

      formData.append('images', {
        uri,
        name: filename,
        type,
      } as unknown as Blob);
    }

    return apiClient.post('/api/requests/exam', formData, true);
  }

  // JSON without images
  return apiClient.post('/api/requests/exam', {
    examType: data.examType,
    exams: data.exams,
    symptoms: data.symptoms,
  });
}

export interface CreateConsultationRequestData {
  consultationType: 'psicologo' | 'medico_clinico';
  durationMinutes: number;
  symptoms: string;
}

export interface AssistantNextActionRequestData {
  requestId?: string;
  status?: string;
  requestType?: string;
  hasSignedDocument?: boolean;
}

export interface AssistantNextActionResponseData {
  title: string;
  statusSummary: string;
  whatToDo: string;
  eta: string;
  ctaLabel: string | null;
  intent: 'pay' | 'download' | 'track' | 'wait' | 'support' | 'none' | string;
}

export interface AssistantCompleteRequestData {
  flow: 'prescription' | 'exam' | 'consultation';
  prescriptionType?: string;
  imagesCount?: number;
  examType?: string;
  examsCount?: number;
  symptoms?: string;
  consultationType?: string;
  durationMinutes?: number;
}

export interface AssistantCompletenessCheckData {
  id: string;
  label: string;
  required: boolean;
  done: boolean;
}

export interface AssistantCompleteResponseData {
  score: number;
  doneCount: number;
  totalCount: number;
  missingFields: string[];
  checks: AssistantCompletenessCheckData[];
  hasUrgencyRisk: boolean;
  urgencySignals: string[];
  urgencyMessage: string | null;
}

export async function createConsultationRequest(
  data: CreateConsultationRequestData
): Promise<{ request: RequestResponseDto; payment?: PaymentResponseDto }> {
  return apiClient.post('/api/requests/consultation', data);
}

export async function getAssistantNextAction(
  data: AssistantNextActionRequestData
): Promise<AssistantNextActionResponseData> {
  return apiClient.post('/api/assistant/next-action', data);
}

export async function evaluateAssistantCompleteness(
  data: AssistantCompleteRequestData
): Promise<AssistantCompleteResponseData> {
  return apiClient.post('/api/assistant/complete', data);
}

export async function fetchRequests(
  filters?: {
    status?: RequestStatus | string;
    type?: string;
    page?: number;
    pageSize?: number;
  },
  options?: { signal?: AbortSignal }
): Promise<PagedResponse<RequestResponseDto>> {
  return apiClient.get(
    '/api/requests',
    {
      status: filters?.status,
      type: filters?.type,
      page: filters?.page || 1,
      pageSize: filters?.pageSize || 20,
    },
    options
  );
}

export async function fetchRequestById(requestId: string, options?: { signal?: AbortSignal }): Promise<RequestResponseDto> {
  return apiClient.get(`/api/requests/${requestId}`, undefined, options);
}

export async function updateRequestStatus(
  requestId: string,
  status: string,
  rejectionReason?: string
): Promise<RequestResponseDto> {
  return apiClient.put(`/api/requests/${requestId}/status`, {
    status,
    rejectionReason,
  });
}

export interface ApproveRequestData {
  medications?: string[];
  exams?: string[];
  notes?: string;
}

export async function approveRequest(
  requestId: string,
  data?: ApproveRequestData
): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/approve`, data ?? {});
}

export async function rejectRequest(requestId: string, rejectionReason: string): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/reject`, { rejectionReason });
}

export async function assignToQueue(requestId: string): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/assign-queue`, {});
}

export async function acceptConsultation(
  requestId: string
): Promise<{ request: RequestResponseDto; video_room: VideoRoomResponseDto }> {
  return apiClient.post(`/api/requests/${requestId}/accept-consultation`, {});
}

/** Médico inicia a consulta (status Paid → InConsultation). O timer só começa quando ambos reportam chamada conectada. */
export async function startConsultation(requestId: string): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/start-consultation`, {});
}

/** Médico ou paciente reporta que a chamada de vídeo está conectada (WebRTC). Quando ambos tiverem reportado, o timer começa. */
export async function reportCallConnected(requestId: string): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/report-call-connected`, {});
}

/** Médico encerra a consulta; opcionalmente envia notas clínicas. */
export async function finishConsultation(
  requestId: string,
  data?: { clinicalNotes?: string }
): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/finish-consultation`, data ?? {});
}

/** Médico salva nota clínica editada no prontuário (writeback do resumo da consulta). */
export async function saveConsultationSummary(
  requestId: string,
  data: { anamnesis?: string; plan?: string }
): Promise<{ saved: boolean }> {
  return apiClient.post(`/api/requests/${requestId}/save-consultation-summary`, data);
}

export async function signRequest(
  requestId: string,
  options?: { pfxPassword?: string; signatureData?: string; signedDocumentUrl?: string }
): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/sign`, {
    pfxPassword: options?.pfxPassword,
    signatureData: options?.signatureData,
    signedDocumentUrl: options?.signedDocumentUrl,
  });
}

export async function reanalyzePrescription(
  requestId: string,
  prescriptionImageUrls: string[]
): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/reanalyze-prescription`, {
    prescriptionImageUrls,
  });
}

export async function reanalyzeExam(
  requestId: string,
  examImageUrls?: string[],
  textDescription?: string
): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/reanalyze-exam`, {
    examImageUrls,
    textDescription,
  });
}

export async function reanalyzeAsDoctor(requestId: string): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/reanalyze-as-doctor`, {});
}

export async function generatePdf(requestId: string): Promise<{ success: boolean; pdfUrl: string; message: string }> {
  return apiClient.post(`/api/requests/${requestId}/generate-pdf`, {});
}

/** Retorna o PDF em blob para preview (receita). */
export async function getPreviewPdf(requestId: string): Promise<Blob> {
  return apiClient.getBlob(`/api/requests/${requestId}/preview-pdf`);
}

/** Retorna o PDF em blob para preview (pedido de exame). */
export async function getPreviewExamPdf(requestId: string): Promise<Blob> {
  return apiClient.getBlob(`/api/requests/${requestId}/preview-exam-pdf`);
}

/** Valida conformidade da receita (campos obrigatórios por tipo). Retorna { valid, missingFields?, messages? }. */
/** Valida conformidade da receita (campos obrigatórios por tipo). */
export async function validatePrescription(
  requestId: string
): Promise<{ valid: true } | { valid: false; missingFields: string[]; messages: string[] }> {
  try {
    const res = await apiClient.post<{ valid?: boolean; missingFields?: string[]; messages?: string[] }>(
      `/api/requests/${requestId}/validate-prescription`,
      {}
    );
    if (res?.valid) return { valid: true };
    return {
      valid: false,
      missingFields: res?.missingFields ?? [],
      messages: res?.messages ?? [],
    };
  } catch (e: unknown) {
    const err = e as Record<string, unknown> | undefined;
    if (err && (err as { status?: number }).status === 400 && ((err as { missingFields?: unknown }).missingFields ?? (err as { messages?: unknown }).messages)) {
      return {
        valid: false,
        missingFields: (err as { missingFields?: string[] }).missingFields ?? [],
        messages: (err as { messages?: string[]; message?: string }).messages ?? [(err as { message?: string }).message ?? 'Erro desconhecido'],
      };
    }
    throw e;
  }
}

/** Paciente marca o documento como entregue (Signed → Delivered) ao baixar/abrir o PDF. */
export async function markRequestDelivered(requestId: string): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/mark-delivered`, {});
}

export async function updatePrescriptionContent(
  requestId: string,
  data: { medications?: string[]; notes?: string; prescriptionKind?: string }
): Promise<RequestResponseDto> {
  return apiClient.patch(`/api/requests/${requestId}/prescription-content`, data);
}

export async function updateExamContent(
  requestId: string,
  data: { exams?: string[]; notes?: string }
): Promise<RequestResponseDto> {
  return apiClient.patch(`/api/requests/${requestId}/exam-content`, data);
}

export async function autoFinishConsultation(requestId: string): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/auto-finish-consultation`, {});
}

export async function getTimeBankBalance(consultationType: string): Promise<{ balanceSeconds: number; balanceMinutes: number; consultationType: string }> {
  return apiClient.get(`/api/requests/time-bank?consultationType=${encodeURIComponent(consultationType)}`);
}

/** Envia texto já transcrito (Daily.co) com speaker. Usado quando transcrição é feita no cliente. */
export async function transcribeTextChunk(
  requestId: string,
  text: string,
  speaker: 'medico' | 'paciente'
): Promise<{ ok: boolean; fullLength?: number }> {
  return apiClient.post('/api/consultation/transcribe-text', {
    requestId,
    text,
    speaker,
  });
}

/** Envia chunk de áudio para transcrição em tempo real. Paciente envia (stream=remote); médico só visualiza. */
export async function transcribeAudioChunk(
  requestId: string,
  audioBlob: Blob | { uri: string; name: string; type: string },
  stream: 'local' | 'remote' = 'remote'
): Promise<{ transcribed: boolean; text?: string; fullLength?: number }> {
  const formData = new FormData();
  formData.append('requestId', requestId);
  formData.append('stream', stream);
  // React Native FormData accepts { uri, name, type } objects for file uploads
  formData.append('file', audioBlob as unknown as Blob);
  return apiClient.post('/api/consultation/transcribe', formData, true);
}

/**
 * Testa transcrição sem consulta ativa (apenas backend em Development).
 * Útil para validar transcrição (Deepgram) sem consulta ativa.
 */
export async function transcribeTestAudio(
  audioBlob: Blob | { uri: string; name: string; type: string }
): Promise<{ transcribed: boolean; text?: string; fileSize?: number; fileName?: string }> {
  const formData = new FormData();
  formData.append('file', audioBlob as unknown as Blob);
  return apiClient.post('/api/consultation/transcribe-test', formData, true);
}

// ============================================
// CONDUCT MANAGEMENT
// ============================================

export interface UpdateConductData {
  conductNotes?: string | null;
  includeConductInPdf?: boolean;
}

export async function updateConduct(
  requestId: string,
  data: UpdateConductData,
): Promise<RequestResponseDto> {
  return apiClient.put(`/api/requests/${requestId}/conduct`, data);
}

export function parseAiSuggestedExams(json: string | null | undefined): string[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((e: unknown) => typeof e === 'string') : [];
  } catch { return []; }
}

// ============================================
// PAYMENT MANAGEMENT
// ============================================

export interface CreatePaymentData {
  requestId: string;
  paymentMethod?: string;
  token?: string;
  installments?: number;
  paymentMethodId?: string;
  issuerId?: number;
  payerEmail?: string;
  payerCpf?: string;
  saveCard?: boolean;
}

export async function createPayment(data: CreatePaymentData): Promise<PaymentResponseDto> {
  return apiClient.post('/api/payments', data);
}

/** Retorna o pagamento pendente ou null se não existir (resposta 200 com body null). */
export async function fetchPaymentByRequest(requestId: string): Promise<PaymentResponseDto | null> {
  const result = await apiClient.get<PaymentResponseDto | null>(`/api/payments/by-request/${requestId}`);
  return result ?? null;
}

export async function fetchPayment(paymentId: string): Promise<PaymentResponseDto> {
  return apiClient.get(`/api/payments/${paymentId}`);
}

export async function fetchPixCode(paymentId: string): Promise<string> {
  return apiClient.get(`/api/payments/${paymentId}/pix-code`);
}

export async function confirmPayment(paymentId: string): Promise<PaymentResponseDto> {
  return apiClient.post(`/api/payments/${paymentId}/confirm`, {});
}

export async function confirmPaymentByRequest(requestId: string): Promise<PaymentResponseDto> {
  return apiClient.post(`/api/payments/confirm-by-request/${requestId}`, {});
}

/** Sincroniza status do pagamento com Mercado Pago (útil quando webhook falha). */
export async function syncPaymentStatus(requestId: string): Promise<PaymentResponseDto> {
  return apiClient.post(`/api/payments/sync-status/${requestId}`, {});
}

/** Retorna URL do Checkout Pro e ID do pagamento para abrir no navegador e exibir na tela */
export async function getCheckoutProUrl(requestId: string): Promise<{ initPoint: string; paymentId: string }> {
  return apiClient.get(`/api/payments/checkout-pro/${requestId}`);
}

export interface SavedCardDto {
  id: string;
  mpCardId: string;
  lastFour: string;
  brand: string;
}

/** Lista cartões salvos do usuário */
export async function fetchSavedCards(): Promise<SavedCardDto[]> {
  return apiClient.get<SavedCardDto[]>('/api/payments/saved-cards');
}

/** Pagar com cartão salvo (token criado via mp.fields.createCardToken no frontend) */
export async function payWithSavedCard(
  requestId: string,
  savedCardId: string,
  token: string
): Promise<PaymentResponseDto> {
  return apiClient.post('/api/payments/saved-card', {
    requestId,
    savedCardId,
    token,
  });
}

// ============================================
// NOTIFICATIONS — implementação em api-notifications.ts
// ============================================
// eslint-disable-next-line import/first -- grouped with notification exports
import {
  fetchNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getUnreadNotificationsCount,
} from './api-notifications';
export { fetchNotifications, markNotificationRead, markAllNotificationsRead, getUnreadNotificationsCount };

// ============================================
// DOCTORS
// ============================================

export async function fetchDoctors(
  filters?: {
    specialty?: string;
    available?: boolean;
    page?: number;
    pageSize?: number;
  }
): Promise<PagedResponse<DoctorListResponseDto>> {
  return apiClient.get('/api/doctors', {
    specialty: filters?.specialty,
    available: filters?.available,
    page: filters?.page || 1,
    pageSize: filters?.pageSize || 20,
  });
}

export async function fetchDoctorById(doctorId: string): Promise<DoctorListResponseDto> {
  return apiClient.get(`/api/doctors/${doctorId}`);
}

export async function fetchDoctorQueue(specialty?: string): Promise<DoctorListResponseDto[]> {
  return apiClient.get('/api/doctors/queue', { specialty });
}

export async function updateDoctorAvailability(
  doctorId: string,
  available: boolean
): Promise<void> {
  return apiClient.put(`/api/doctors/${doctorId}/availability`, { available });
}

/** Perfil do médico logado (inclui endereço/telefone profissional). */
export async function getMyDoctorProfile(): Promise<DoctorProfileDto | null> {
  return apiClient.get<DoctorProfileDto | null>('/api/doctors/me');
}

/** Atualiza endereço e telefone profissional (obrigatórios para assinar receitas). */
export async function updateDoctorProfile(data: {
  professionalAddress?: string | null;
  professionalPhone?: string | null;
  professionalPostalCode?: string | null;
  professionalStreet?: string | null;
  professionalNumber?: string | null;
  professionalNeighborhood?: string | null;
  professionalComplement?: string | null;
  professionalCity?: string | null;
  professionalState?: string | null;
}): Promise<DoctorProfileDto> {
  return apiClient.patch('/api/doctors/me/profile', data);
}

export async function validateCrm(
  crm: string,
  uf: string
): Promise<CrmValidationResponseDto> {
  return apiClient.post('/api/doctors/validate-crm', { crm, uf });
}

// ============================================
// PUSH TOKENS — implementação em api-notifications.ts
// ============================================
export {
  registerPushToken,
  unregisterPushToken,
  fetchPushTokens,
  setPushPreference,
  sendTestPush,
} from './api-notifications';

// ============================================
// VIDEO — implementação em api-video.ts
// ============================================
export { createVideoRoom, fetchVideoRoom } from './api-video';

// ============================================
// SPECIALTIES
// ============================================

export async function fetchSpecialties(): Promise<string[]> {
  try {
    return await apiClient.get<string[]>('/api/specialties');
  } catch (e) {
    if (__DEV__) logApiError(0, '/api/specialties', (e as { message?: string })?.message ?? String(e));
    throw e;
  }
}

// ============================================
// CERTIFICATES (matches CertificatesController)
// ============================================

export async function uploadCertificate(
  pfxUri: string,
  password: string,
  /** On web, pass the File object from DocumentPicker asset.file */
  webFile?: File
): Promise<UploadCertificateResponseDto> {
  const formData = new FormData();
  const filename = pfxUri.split('/').pop() || 'certificate.pfx';

  if (webFile) {
    // Web: use the real File object
    formData.append('pfxFile', webFile, webFile.name || filename);
  } else {
    // React Native: use the uri-based object
    formData.append('pfxFile', {
      uri: pfxUri,
      name: filename,
      type: 'application/x-pkcs12',
    } as unknown as Blob);
  }
  formData.append('password', password);

  return apiClient.post('/api/certificates/upload', formData, true);
}

// GET /api/certificates/status → { hasValidCertificate: boolean }
export async function getCertificateStatus(): Promise<{ hasValidCertificate: boolean }> {
  return apiClient.get('/api/certificates/status');
}

// GET /api/certificates/active → CertificateInfoDto (404 if none)
export async function getActiveCertificate(): Promise<CertificateInfoDto | null> {
  try {
    return await apiClient.get('/api/certificates/active');
  } catch (error: unknown) {
    if ((error as { status?: number })?.status === 404) return null;
    throw error;
  }
}

// POST /api/certificates/{id}/revoke → { message: string }
export async function revokeCertificate(id: string, reason: string): Promise<void> {
  return apiClient.post(`/api/certificates/${id}/revoke`, { reason });
}

// ============================================
// INTEGRATIONS — implementação em api-integrations.ts
// ============================================
export { getMercadoPagoPublicKey, getIntegrationStatus } from './api-integrations';

// ============================================
// DOCTOR STATS (derived from requests)
// ============================================

export interface DoctorStats {
  pendingCount: number;
  inReviewCount: number;
  completedCount: number;
  totalEarnings: number;
}

export async function fetchDoctorStats(): Promise<DoctorStats> {
  try {
    const res = await apiClient.get<{ pendingCount: number; inReviewCount: number; completedCount: number; totalEarnings: number }>(
      '/api/requests/stats'
    );
    return {
      pendingCount: res.pendingCount ?? 0,
      inReviewCount: res.inReviewCount ?? 0,
      completedCount: res.completedCount ?? 0,
      totalEarnings: res.totalEarnings ?? 0,
    };
  } catch (e) {
    if (__DEV__) logApiError(0, '/api/requests/stats', (e as { message?: string })?.message ?? String(e));
    return { pendingCount: 0, inReviewCount: 0, completedCount: 0, totalEarnings: 0 };
  }
}

// ============================================
// VIDEO - By Request — implementação em api-video.ts
// ============================================
export { fetchVideoRoomByRequest } from './api-video';

// ============================================
// CLINICAL / FHIR-LITE (prontuário)
// ============================================

export async function fetchMyPatientSummary(): Promise<PatientSummaryDto> {
  return apiClient.get('/api/fhir-lite/patient-summary');
}

export async function fetchMyEncounters(
  limit = 50,
  offset = 0
): Promise<EncounterSummaryDto[]> {
  return apiClient.get('/api/fhir-lite/encounters', { limit, offset });
}

export async function fetchMyDocuments(
  limit = 50,
  offset = 0
): Promise<MedicalDocumentSummaryDto[]> {
  return apiClient.get('/api/fhir-lite/documents', { limit, offset });
}

/** Doctor Read: médico obtém resumo do paciente (requer vínculo). */
export async function getDoctorPatientSummary(patientId: string): Promise<PatientSummaryDto> {
  return apiClient.get(`/api/fhir-lite/doctor/patient/${patientId}/summary`);
}

/** Doctor Read: médico obtém encounters do paciente. */
export async function getDoctorPatientEncounters(
  patientId: string,
  limit = 50,
  offset = 0
): Promise<EncounterSummaryDto[]> {
  return apiClient.get(`/api/fhir-lite/doctor/patient/${patientId}/encounters`, { limit, offset });
}

/** Doctor Read: médico obtém documentos do paciente. */
export async function getDoctorPatientDocuments(
  patientId: string,
  limit = 50,
  offset = 0
): Promise<MedicalDocumentSummaryDto[]> {
  return apiClient.get(`/api/fhir-lite/doctor/patient/${patientId}/documents`, { limit, offset });
}

// ============================================
export async function getPatientRequests(patientId: string): Promise<RequestResponseDto[]> {
  const data = await apiClient.get<RequestResponseDto[]>(`/api/requests/by-patient/${patientId}`);
  return Array.isArray(data) ? data : [];
}

/** Médico obtém perfil do paciente (dados cadastrais) para identificação. */
export async function getPatientProfileForDoctor(
  patientId: string
): Promise<PatientProfileForDoctorDto | null> {
  try {
    return await apiClient.get<PatientProfileForDoctorDto>(
      `/api/requests/by-patient/${patientId}/profile`
    );
  } catch {
    return null;
  }
}

/** Resumo estruturado estilo Epic/Cerner. */
export interface PatientClinicalSummaryStructured {
  problemList: string[];
  activeMedications: string[];
  narrativeSummary: string;
  carePlan: string | null;
  alerts: string[];
}

/** Nota clínica do médico (FHIR/Epic-inspired). */
export interface DoctorNoteDto {
  id: string;
  noteType: string;
  content: string;
  requestId?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Resposta do resumo clínico (IA ou fallback). */
export interface PatientClinicalSummaryResponse {
  summary: string | null;
  fallback: string | null;
  structured?: PatientClinicalSummaryStructured | null;
  /** Notas clínicas do médico (progress_note, clinical_impression, addendum, observation). */
  doctorNotes?: DoctorNoteDto[];
}

/** Médico obtém resumo narrativo completo do prontuário (IA). Consolida tudo em um texto único. */
export async function getPatientClinicalSummary(
  patientId: string
): Promise<PatientClinicalSummaryResponse> {
  try {
    const data = await apiClient.get<PatientClinicalSummaryResponse>(
      `/api/requests/by-patient/${patientId}/summary`
    );
    return data ?? { summary: null, fallback: null };
  } catch {
    return { summary: null, fallback: null };
  }
}

/** Tipos de nota clínica (FHIR/Epic-inspired). */
export const DOCTOR_NOTE_TYPES = [
  { key: 'progress_note', label: 'Evolução', icon: 'document-text' },
  { key: 'clinical_impression', label: 'Impressão diagnóstica', icon: 'medical' },
  { key: 'addendum', label: 'Complemento', icon: 'add-circle' },
  { key: 'observation', label: 'Observação', icon: 'eye' },
] as const;

/** Médico adiciona nota clínica ao prontuário. */
export async function addDoctorPatientNote(
  patientId: string,
  data: { noteType: string; content: string; requestId?: string | null }
): Promise<DoctorNoteDto> {
  return apiClient.post(`/api/requests/by-patient/${patientId}/doctor-notes`, {
    noteType: data.noteType,
    content: data.content.trim(),
    requestId: data.requestId ?? null,
  });
}

// ALIASES (for convenience in screens)
// ============================================
export function getRequests(
  params?: { page?: number; pageSize?: number; status?: string; type?: string },
  options?: { signal?: AbortSignal }
) {
  return fetchRequests(params, options);
}
export const getRequestById = fetchRequestById;
export const getPaymentByRequest = fetchPaymentByRequest;
export const getPaymentById = fetchPayment;
export const getPixCode = fetchPixCode;
export const getNotifications = (params?: { page?: number; pageSize?: number }) =>
  fetchNotifications(params?.page, params?.pageSize);
export const markNotificationAsRead = markNotificationRead;
export const markAllNotificationsAsRead = markAllNotificationsRead;
export const getDoctorQueue = (specialty?: string) =>
  fetchDoctorQueue(specialty);
/** Paciente cancela o pedido (apenas antes do pagamento). */
export async function cancelRequest(requestId: string): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/cancel`, {});
}

/**
 * Retorna a URL autenticada para download do PDF assinado via proxy do backend.
 * Usa token temporário de curta duração (gerado pelo backend) em vez do JWT completo
 * para não expor credenciais em logs, referrer headers e histórico do browser.
 */
export async function getDocumentDownloadUrl(requestId: string): Promise<string> {
  const baseUrl = apiClient.getBaseUrl();
  try {
    // Pede ao backend um token descartável de curta duração para este documento
    const { token: docToken } = await apiClient.post<{ token: string }>(
      `/api/requests/${requestId}/document-token`, {}
    );
    return `${baseUrl}/api/requests/${requestId}/document?token=${encodeURIComponent(docToken)}`;
  } catch {
    // Fallback: se o endpoint de document-token não existir ainda, usa JWT (retrocompatibilidade)
    const token = await apiClient.getAuthToken();
    return `${baseUrl}/api/requests/${requestId}/document${token ? `?token=${encodeURIComponent(token)}` : ''}`;
  }
}

/** Ordena pedidos do mais recente para o mais antigo (createdAt desc, desempate updatedAt desc). */
export function sortRequestsByNewestFirst(items: RequestResponseDto[]): RequestResponseDto[] {
  return [...items].sort((a, b) => {
    const ta = new Date(a.createdAt ?? 0).getTime();
    const tb = new Date(b.createdAt ?? 0).getTime();
    if (tb !== ta) return tb - ta;
    const ua = new Date(a.updatedAt ?? 0).getTime();
    const ub = new Date(b.updatedAt ?? 0).getTime();
    return ub - ua;
  });
}
