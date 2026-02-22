import { apiClient } from './api-client';
import {
  RequestResponseDto,
  RequestStatus,
  PaymentResponseDto,
  NotificationResponseDto,
  DoctorProfileDto,
  DoctorListResponseDto,
  PagedResponse,
  VideoRoomResponseDto,
  CrmValidationResponseDto,
  PushTokenDto,
  CertificateInfoDto,
  UploadCertificateResponseDto,
} from '../types/database';

// ============================================
// AUTH
// ============================================

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiClient.patch('/api/auth/change-password', {
    currentPassword,
    newPassword,
  });
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
      } as any);
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
      } as any);
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

export async function createConsultationRequest(
  data: CreateConsultationRequestData
): Promise<{ request: RequestResponseDto; payment?: PaymentResponseDto }> {
  return apiClient.post('/api/requests/consultation', data);
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

/** Médico inicia a consulta (status Paid → InConsultation). */
export async function startConsultation(requestId: string): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/start-consultation`, {});
}

/** Médico encerra a consulta; opcionalmente envia notas clínicas. */
export async function finishConsultation(
  requestId: string,
  data?: { clinicalNotes?: string }
): Promise<RequestResponseDto> {
  return apiClient.post(`/api/requests/${requestId}/finish-consultation`, data ?? {});
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
  } catch (e: any) {
    if (e?.status === 400 && (e?.missingFields ?? e?.messages)) {
      return {
        valid: false,
        missingFields: e.missingFields ?? [],
        messages: e.messages ?? [e.message],
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
// NOTIFICATIONS
// ============================================

export async function fetchNotifications(
  page: number = 1,
  pageSize: number = 20
): Promise<PagedResponse<NotificationResponseDto>> {
  return apiClient.get('/api/notifications', { page, pageSize });
}

export async function markNotificationRead(notificationId: string): Promise<NotificationResponseDto> {
  return apiClient.put(`/api/notifications/${notificationId}/read`, {});
}

export async function markAllNotificationsRead(): Promise<void> {
  return apiClient.put('/api/notifications/read-all', {});
}

export async function getUnreadNotificationsCount(): Promise<number> {
  const res = await apiClient.get<{ count: number }>('/api/notifications/unread-count');
  return res?.count ?? 0;
}

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

export async function validateCrm(
  crm: string,
  uf: string
): Promise<CrmValidationResponseDto> {
  return apiClient.post('/api/doctors/validate-crm', { crm, uf });
}

// ============================================
// PUSH TOKENS
// ============================================

export async function registerPushToken(token: string, deviceType: string): Promise<void> {
  return apiClient.post('/api/push-tokens', { token, deviceType });
}

export async function unregisterPushToken(token: string): Promise<void> {
  return apiClient.delete(`/api/push-tokens?token=${encodeURIComponent(token)}`);
}

export async function fetchPushTokens(): Promise<PushTokenDto[]> {
  return apiClient.get('/api/push-tokens');
}

export async function setPushPreference(pushEnabled: boolean): Promise<void> {
  return apiClient.put('/api/push-tokens/preference', { pushEnabled });
}

// ============================================
// VIDEO
// ============================================

export async function createVideoRoom(requestId: string): Promise<VideoRoomResponseDto> {
  return apiClient.post('/api/video/rooms', { requestId });
}

export async function fetchVideoRoom(roomId: string): Promise<VideoRoomResponseDto> {
  return apiClient.get(`/api/video/rooms/${roomId}`);
}

// ============================================
// SPECIALTIES
// ============================================

export async function fetchSpecialties(): Promise<string[]> {
  return apiClient.get('/api/specialties');
}

// ============================================
// CERTIFICATES (matches CertificatesController)
// ============================================

export async function uploadCertificate(
  pfxUri: string,
  password: string
): Promise<UploadCertificateResponseDto> {
  const formData = new FormData();
  const filename = pfxUri.split('/').pop() || 'certificate.pfx';

  formData.append('pfxFile', {
    uri: pfxUri,
    name: filename,
    type: 'application/x-pkcs12',
  } as any);
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
  } catch (error: any) {
    if (error.status === 404) return null;
    throw error;
  }
}

// POST /api/certificates/{id}/revoke → { message: string }
export async function revokeCertificate(id: string, reason: string): Promise<void> {
  return apiClient.post(`/api/certificates/${id}/revoke`, { reason });
}

// ============================================
// INTEGRATIONS
// ============================================

export async function getMercadoPagoPublicKey(): Promise<{ publicKey: string }> {
  return apiClient.get('/api/integrations/mercadopago-public-key');
}

export async function getIntegrationStatus(): Promise<any> {
  return apiClient.get('/api/integrations/status');
}

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
    const allRequests = await fetchRequests({ pageSize: 1000 });
    const requests = allRequests.items;

    const pendingCount = requests.filter(
      (r) => !r.doctorId && ['submitted', 'paid'].includes(r.status)
    ).length;

    const inReviewCount = requests.filter(
      (r) => r.doctorId &&
        ['in_review', 'approved', 'signed', 'consultation_ready', 'in_consultation'].includes(r.status)
    ).length;

    const completedCount = requests.filter(
      (r) => r.doctorId && ['completed', 'delivered', 'consultation_finished'].includes(r.status)
    ).length;

    const totalEarnings = requests
      .filter((r) => r.doctorId && ['completed', 'delivered', 'consultation_finished'].includes(r.status))
      .reduce((sum, r) => sum + (r.price ?? 0), 0);

    return { pendingCount, inReviewCount, completedCount, totalEarnings };
  } catch {
    return { pendingCount: 0, inReviewCount: 0, completedCount: 0, totalEarnings: 0 };
  }
}

// ============================================
// VIDEO - By Request (added endpoint)
// ============================================

export async function fetchVideoRoomByRequest(requestId: string): Promise<VideoRoomResponseDto | null> {
  try {
    return await apiClient.get(`/api/video/rooms/by-request/${requestId}`);
  } catch (error: any) {
    if (error.status === 404) return null;
    throw error;
  }
}

// ============================================
export async function getPatientRequests(patientId: string): Promise<RequestResponseDto[]> {
  const data = await apiClient.get<RequestResponseDto[]>(`/api/requests/by-patient/${patientId}`);
  return Array.isArray(data) ? data : [];
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
