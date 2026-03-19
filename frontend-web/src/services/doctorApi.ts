/**
 * doctorApi.ts — Facade / barrel file for the doctor portal API.
 *
 * All API functions are defined in domain-specific modules:
 *   doctor-api-auth.ts         — Auth, profile, base HTTP client (authFetch)
 *   doctor-api-requests.ts     — Request CRUD, actions, stats, AI re-analysis
 *   doctor-api-consultation.ts — Consultation flow, conduct, content, recordings, AI
 *   doctor-api-doctors.ts      — Notifications, certificates, video rooms
 *   doctor-api-clinical.ts     — Patient data, clinical summary, doctor notes
 *   doctor-api-misc.ts         — Specialties, CID, address, prescription images
 *
 * This file keeps type definitions (imported everywhere) and re-exports
 * all functions so existing imports continue to work:
 *   import { getRequests, loginDoctor } from '../services/doctorApi';
 *
 * New code should prefer importing from the specific module:
 *   import { getRequests } from '../services/doctor-api-requests';
 */

// ── Types (kept here — imported by all modules and consumers) ──

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
  doctorId?: string | null;
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
  includeConductInPdf?: boolean;
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
  /** Notas SOAP geradas pela IA após a consulta (JSON com subjective/objective/assessment/plan/medical_terms). */
  consultationSoapNotes?: string | null;
  patientBirthDate?: string | null;
  patientGender?: string | null;
  examQuickPackages?: ExamQuickPackageDto[] | null;
}

/** Alinhado ao DTO .NET `ExamQuickPackageDto`. */
export interface ExamQuickPackageDto {
  key: string;
  name: string;
  exams: string[];
  justification: string;
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

// ── Re-export all domain modules ──

export * from './doctor-api-auth';
export * from './doctor-api-requests';
export * from './doctor-api-consultation';
export * from './doctor-api-doctors';
export * from './doctor-api-clinical';
export * from './doctor-api-misc';
