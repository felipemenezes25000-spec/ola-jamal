import { apiClient, POST_CONSULTATION_EMIT_TIMEOUT_MS } from './api-client';
import type {
  RequestResponseDto,
  RequestStatus,
  PagedResponse,
  VideoRoomResponseDto,
} from '../types/database';
import type {
  PostConsultationEmitRequest,
  PostConsultationEmitResponse,
} from '../types/postConsultation';

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
): Promise<{ request: RequestResponseDto }> {
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

    // Enviar medications também no multipart (senão são perdidos)
    if (data.medications && data.medications.length > 0) {
      data.medications.forEach((med) => formData.append('medications', med));
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
): Promise<{ request: RequestResponseDto }> {
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
  intent: 'download' | 'track' | 'wait' | 'support' | 'none' | string;
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
): Promise<{ request: RequestResponseDto }> {
  return apiClient.post('/api/requests/consultation', data);
}

export async function getAssistantNextAction(
  data: AssistantNextActionRequestData
): Promise<AssistantNextActionResponseData> {
  return apiClient.post('/api/assistant/next-action', data);
}

export interface ExamSuggestion {
  exam: string;
  reason: string;
}

export interface SuggestExamsResponse {
  suggestions: ExamSuggestion[];
  message?: string;
}

export async function suggestExamsFromSymptoms(
  symptoms: string,
  examType?: string,
): Promise<SuggestExamsResponse> {
  return apiClient.post('/api/assistant/suggest-exams', { symptoms, examType });
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

/** Resposta do start-consultation: request + aviso opcional de paciente crônico (CFM 2.314/2022). */
export interface StartConsultationResponse {
  request: RequestResponseDto;
  chronicWarning: string | null;
}

/** Médico inicia a consulta (status Paid → InConsultation). O timer só começa quando ambos reportam chamada conectada. */
export async function startConsultation(requestId: string): Promise<StartConsultationResponse> {
  return apiClient.post<StartConsultationResponse>(`/api/requests/${requestId}/start-consultation`, {});
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

/** Paciente cancela o pedido (apenas enquanto ainda não assinado). */
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
  } catch (err) {
    // SECURITY FIX: Não expor JWT completo na URL
    if (__DEV__) console.warn('[getDocumentDownloadUrl] document-token endpoint failed:', err);
    throw {
      message: 'Não foi possível gerar o link de download. Tente novamente em alguns instantes.',
      status: (err as { status?: number })?.status ?? 0,
    };
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


// ============================================
// POST-CONSULTATION DOCUMENT EMISSION
// ============================================

/**
 * Emite todos os documentos pós-consulta (receita, exames, atestado) num único request.
 * O backend cria os documentos, vincula ao Encounter e retorna os IDs.
 */
export async function emitPostConsultationDocuments(
  data: PostConsultationEmitRequest
): Promise<PostConsultationEmitResponse> {
  const res = await apiClient.post<PostConsultationEmitResponse>(
    '/api/post-consultation/emit',
    data,
    { timeoutMs: POST_CONSULTATION_EMIT_TIMEOUT_MS },
  );
  return res;
}


// ============================================
// POST-CONSULTATION DOCUMENTS — PATIENT ACCESS
// ============================================

/** Documento emitido na pós-consulta (retornado pelo backend). */
export interface ConsultationDocument {
  id: string;
  documentType: 'prescription' | 'examorder' | 'medicalcertificate' | 'medicalreport';
  status: 'draft' | 'signed' | 'revoked';
  signedAt: string | null;
  expiresAt: string | null;
  accessCode: string | null;
  dispensedCount: number;
  label: string;
  icon: string;
  color: string;
}

/**
 * Lista todos os documentos emitidos na pós-consulta de um request.
 * Funciona tanto para paciente quanto para médico.
 */
export async function getConsultationDocuments(
  requestId: string
): Promise<ConsultationDocument[]> {
  const res = await apiClient.get<{ documents: ConsultationDocument[] }>(
    `/api/post-consultation/${requestId}/documents`
  );
  return Array.isArray(res.documents) ? res.documents : [];
}

/**
 * Retorna a URL de download para um MedicalDocument específico.
 * Usa o mesmo mecanismo de token temporário do download de request.
 */
export async function getDocumentDownloadUrlById(documentId: string): Promise<string> {
  const baseUrl = apiClient.getBaseUrl();
  try {
    const { token: docToken } = await apiClient.post<{ token: string }>(
      `/api/post-consultation/documents/${documentId}/token`, {}
    );
    return `${baseUrl}/api/post-consultation/documents/${documentId}/download?token=${encodeURIComponent(docToken)}`;
  } catch (err) {
    // SECURITY FIX: Não expor JWT completo na URL
    if (__DEV__) console.warn('[getDocumentDownloadUrlById] document-token endpoint failed:', err);
    throw {
      message: 'Não foi possível gerar o link de download. Tente novamente em alguns instantes.',
      status: (err as { status?: number })?.status ?? 0,
    };
  }
}
