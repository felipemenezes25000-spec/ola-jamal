/**
 * doctor-api-consultation.ts — Consultation flow, conduct, content,
 * recordings, transcription, AI assistant, and care plans.
 */

import { authFetch } from './doctor-api-auth';
import type {
  ConsultationSummary,
  Medication,
  ExamItem,
  Recording,
} from './doctorApi';

// ── Consultation Flow ──

export async function startConsultation(id: string) {
  const res = await authFetch(`/api/requests/${id}/start-consultation`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Erro ao iniciar consulta');
  return res.json();
}

export async function reportCallConnected(id: string) {
  const res = await authFetch(`/api/requests/${id}/report-call-connected`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Erro ao reportar conexão');
  return res.json();
}

export async function finishConsultation(
  id: string,
  payload?: { conductNotes?: string }
) {
  const res = await authFetch(`/api/requests/${id}/finish-consultation`, {
    method: 'POST',
    body: JSON.stringify(payload || {}),
  });
  if (!res.ok) throw new Error('Erro ao finalizar consulta');
  return res.json();
}

export async function saveConsultationSummary(
  id: string,
  payload: ConsultationSummary
) {
  const res = await authFetch(`/api/requests/${id}/save-consultation-summary`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao salvar resumo');
  return res.json();
}

export async function autoFinishConsultation(id: string) {
  const res = await authFetch(`/api/requests/${id}/auto-finish-consultation`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Erro ao auto-finalizar');
  return res.json();
}

// ── Recordings ──

export async function getRecordings(
  id: string
): Promise<{ requestId: string; roomName: string; recordings: Recording[] }> {
  const res = await authFetch(`/api/requests/${id}/recordings`);
  if (!res.ok) throw new Error('Erro ao buscar gravações');
  return res.json();
}

export async function getTranscriptDownloadUrl(
  id: string
): Promise<{ signedUrl: string; expiresIn: number }> {
  const res = await authFetch(`/api/requests/${id}/transcript-download-url`);
  if (!res.ok) throw new Error('Erro ao buscar transcrição');
  return res.json();
}

// ── Conduct ──

export async function updateConduct(
  id: string,
  payload: { conductNotes: string; includeConductInPdf?: boolean }
) {
  const res = await authFetch(`/api/requests/${id}/conduct`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro ao atualizar conduta');
  return res.json();
}

// ── Prescription/Exam Content ──

export async function updatePrescriptionContent(
  id: string,
  payload: {
    medications?: Medication[];
    notes?: string;
    prescriptionKind?: string;
  }
) {
  // Backend espera medications: string[] (texto livre), não Medication[]
  const body = {
    medications:
      payload.medications
        ?.map((m) =>
          typeof m === 'string'
            ? m
            : [m.name, m.dosage, m.frequency, m.duration, m.notes]
                .filter(Boolean)
                .join(' — ')
        )
        .filter(Boolean) ?? undefined,
    notes: payload.notes ?? undefined,
    prescriptionKind: payload.prescriptionKind ?? undefined,
  };
  const res = await authFetch(`/api/requests/${id}/prescription-content`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Erro ao atualizar receita');
  return res.json();
}

export async function updateExamContent(
  id: string,
  payload: { exams?: ExamItem[]; notes?: string }
) {
  // Backend espera exams: string[] (nomes), não ExamItem[]
  const body = {
    exams:
      payload.exams
        ?.map((e) => (typeof e === 'string' ? e : e.name).trim())
        .filter(Boolean) ?? undefined,
    notes: payload.notes ?? undefined,
  };
  const res = await authFetch(`/api/requests/${id}/exam-content`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Erro ao atualizar exame');
  return res.json();
}

/**
 * Returns a blob URL for the prescription PDF preview.
 * ⚠️ Caller MUST call URL.revokeObjectURL(url) when done to avoid memory leaks.
 */
export async function getPreviewPdf(id: string): Promise<string> {
  const res = await authFetch(`/api/requests/${id}/preview-pdf`);
  if (!res.ok) throw new Error('Erro ao gerar preview');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

/**
 * Returns a blob URL for the exam PDF preview.
 * ⚠️ Caller MUST call URL.revokeObjectURL(url) when done to avoid memory leaks.
 */
export async function getPreviewExamPdf(id: string): Promise<string> {
  const res = await authFetch(`/api/requests/${id}/preview-exam-pdf`);
  if (!res.ok) throw new Error('Erro ao gerar preview');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export async function validatePrescription(id: string): Promise<{
  valid: boolean;
  missingFields?: string[];
  messages?: string[];
}> {
  const res = await authFetch(`/api/requests/${id}/validate-prescription`, {
    method: 'POST',
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) return { valid: true, ...data };
  if (res.status === 400)
    return {
      valid: false,
      missingFields: data.missingFields ?? [],
      messages: data.messages ?? [],
    };
  throw new Error('Erro ao validar');
}

// ── Transcription ──

export async function transcribeText(
  requestId: string,
  text: string,
  speaker: 'medico' | 'paciente',
  startTimeSeconds?: number
) {
  const res = await authFetch('/api/consultation/transcribe-text', {
    method: 'POST',
    body: JSON.stringify({ requestId, text, speaker, startTimeSeconds }),
  });
  if (!res.ok) throw new Error('Erro na transcrição');
  return res.json();
}

export async function refreshAnamnesis(requestId: string) {
  const res = await authFetch('/api/consultation/refresh-anamnesis', {
    method: 'POST',
    body: JSON.stringify({ requestId }),
  });
  if (!res.ok) throw new Error('Erro ao atualizar anamnese');
  return res.json();
}

// ── AI Assistant ──

export async function getAssistantNextAction(
  requestId?: string,
  status?: string,
  requestType?: string
) {
  const res = await authFetch('/api/assistant/next-action', {
    method: 'POST',
    body: JSON.stringify({ requestId, status, requestType }),
  });
  if (!res.ok) throw new Error('Erro ao buscar ação');
  return res.json();
}

// ── Care Plans ──

export async function getExamSuggestions(symptoms: string, examType?: string) {
  const res = await authFetch('/api/assistant/suggest-exams', {
    method: 'POST',
    body: JSON.stringify({ symptoms, examType }),
  });
  if (!res.ok)
    return { suggestions: [], message: 'Não foi possível gerar sugestões.' };
  return res.json();
}

/** @deprecated Use getExamSuggestions — mantido para compatibilidade. */
export const generateExamSuggestions = getExamSuggestions;

// ── Triage ──

export async function enrichTriage(payload: {
  context: string;
  ruleText: string;
  step?: string;
  ruleKey?: string;
  prescriptionType?: string;
  examType?: string;
  exams?: string[];
  symptoms?: string;
  totalRequests?: number;
}) {
  const res = await authFetch('/api/triage/enrich', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Erro na triagem');
  return res.json();
}

// ── Post-consultation document emission ──

export interface PrescriptionItemEmit {
  drug: string;
  concentration?: string;
  form?: string;
  posology?: string;
  duration?: string;
  quantity?: number;
  notes?: string;
}

export interface ExamItemEmitWeb {
  type: string;
  code?: string;
  description: string;
}

export interface PostConsultationEmitPayload {
  requestId: string;
  certificatePassword?: string;
  mainIcd10Code?: string;
  anamnesis?: string;
  structuredAnamnesis?: string;
  physicalExam?: string;
  plan?: string;
  differentialDiagnosis?: string;
  patientInstructions?: string;
  redFlags?: string;
  prescription?: {
    type: 'simples' | 'controlado';
    generalInstructions?: string;
    items: PrescriptionItemEmit[];
  };
  examOrder?: {
    clinicalJustification?: string;
    priority?: string;
    items: ExamItemEmitWeb[];
  };
  medicalCertificate?: {
    certificateType: 'afastamento' | 'comparecimento' | 'aptidao';
    body: string;
    icd10Code?: string;
    leaveDays?: number;
    leaveStartDate?: string;
    leavePeriod?: 'integral' | 'meio_periodo';
    includeIcd10: boolean;
  };
  referral?: {
    professionalName: string;
    specialty?: string;
    reason: string;
    icd10Code?: string;
  };
}

export interface PostConsultationEmitResult {
  encounterId: string;
  prescriptionId?: string;
  examOrderId?: string;
  medicalCertificateId?: string;
  referralId?: string;
  documentsEmitted: number;
  documentTypes: string[];
  message: string;
  warnings?: string[];
  errors?: string[];
}

/**
 * Emite todos os documentos pós-consulta (receita, exames, atestado) num único request.
 */
export async function emitPostConsultationDocuments(
  payload: PostConsultationEmitPayload
): Promise<PostConsultationEmitResult> {
  const res = await authFetch('/api/post-consultation/emit', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Erro ao emitir documentos pós-consulta');
  }
  return res.json();
}
