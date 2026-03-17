import { apiClient } from './api-client';
import type {
  RequestResponseDto,
  PatientSummaryDto,
  EncounterSummaryDto,
  MedicalDocumentSummaryDto,
  PatientProfileForDoctorDto,
} from '../types/database';

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
// Patient data via Requests endpoints
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
