// ============================================
// USER & AUTH TYPES (matches Auth/AuthDtos.cs)
// ============================================

export type UserRole = 'patient' | 'doctor' | 'admin' | 'sus';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  cpf: string | null;
  birthDate: string | null;
  avatarUrl: string | null;
  role: UserRole;
  profileComplete: boolean;
  createdAt: string;
  updatedAt: string;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  complement?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}

export interface AuthResponseDto {
  user: UserDto;
  token: string;
  doctorProfile?: DoctorProfileDto;
  profileComplete: boolean;
}

export interface DoctorProfileDto {
  id: string;
  userId: string;
  crm: string;
  crmState: string;
  specialty: string;
  bio: string | null;
  rating: number;
  totalConsultations: number;
  available: boolean;
  createdAt: string;
  /** Obrigatório para assinar receitas. */
  professionalAddress?: string | null;
  /** Obrigatório para assinar receitas. */
  professionalPhone?: string | null;
  professionalPostalCode?: string | null;
  professionalStreet?: string | null;
  professionalNumber?: string | null;
  professionalNeighborhood?: string | null;
  professionalComplement?: string | null;
  professionalCity?: string | null;
  professionalState?: string | null;
  university?: string | null;
  courses?: string | null;
  hospitalsServices?: string | null;
}

// ============================================
// REQUEST TYPES (matches Requests/RequestDtos.cs + EnumHelper snake_case)
// ============================================

export type RequestType = 'prescription' | 'exam' | 'consultation';
export type PrescriptionType = 'simples' | 'controlado' | 'azul';
/** Tipo de receita para conformidade: simple, antimicrobial, controlled_special */
export type PrescriptionKind = 'simple' | 'antimicrobial' | 'controlled_special';

export type RequestStatus =
  | 'submitted'
  | 'in_review'
  | 'approved'
  | 'signed'
  | 'delivered'
  | 'rejected'
  | 'searching_doctor'
  | 'consultation_ready'
  | 'in_consultation'
  | 'consultation_finished'
  | 'cancelled'
  | 'pending'
  | 'analyzing'
  | 'completed'
  // Legados (backend pode retornar; fluxo de pagamento removido — tratados como approved)
  | 'approved_pending_payment'
  | 'pending_payment'
  | 'paid';

export interface RequestResponseDto {
  id: string;
  patientId: string;
  patientName: string | null;
  doctorId: string | null;
  doctorName: string | null;
  requestType: RequestType;
  status: RequestStatus;
  prescriptionType: PrescriptionType | null;
  prescriptionKind: PrescriptionKind | null;
  medications: string[] | null;
  prescriptionImages: string[] | null;
  examType: string | null;
  exams: string[] | null;
  examImages: string[] | null;
  symptoms: string | null;
  notes: string | null;
  rejectionReason: string | null;
  accessCode: string | null;
  signedAt: string | null;
  signedDocumentUrl: string | null;
  signatureId: string | null;
  createdAt: string;
  updatedAt: string;
  aiSummaryForDoctor: string | null;
  aiExtractedJson: string | null;
  aiRiskLevel: string | null;
  aiUrgency: string | null;
  aiReadabilityOk: boolean | null;
  aiMessageToUser: string | null;
  /** Preço (legado; fluxo de pagamento removido). */
  price?: number | null;
  /** Transcrição da consulta por vídeo (apenas solicitações tipo consultation). */
  consultationTranscript?: string | null;
  /** Anamnese estruturada da consulta (JSON). */
  consultationAnamnesis?: string | null;
  /** Sugestões da IA da consulta (JSON array de strings). */
  consultationAiSuggestions?: string | null;
  /** Artigos científicos (provider, url, title, clinicalRelevance) que apoiam o CID sugerido. */
  consultationEvidence?: string | null;
  /** Notas SOAP geradas pela IA após a consulta (JSON com subjective/objective/assessment/plan/medical_terms). */
  consultationSoapNotes?: string | null;
  /** Indica se existe gravação de vídeo da consulta (obter URL via GET .../recording-download-url). */
  consultationHasRecording?: boolean;
  /** Tipo de consulta: 'psicologo' | 'medico_clinico' */
  consultationType?: string | null;
  /** Minutos contratados na criação da consulta */
  contractedMinutes?: number | null;
  /** Quando o médico iniciou a consulta (sincroniza o timer entre médico e paciente) */
  consultationStartedAt?: string | null;
  /** Observação orientativa gerada pela plataforma na criação */
  autoObservation?: string | null;
  /** Conduta médica registrada pelo médico */
  doctorConductNotes?: string | null;
  /** Se a conduta será incluída no PDF assinado */
  includeConductInPdf?: boolean | null;
  /** Sugestão de conduta da IA para o médico */
  aiConductSuggestion?: string | null;
  /** Exames sugeridos pela IA (JSON array string) */
  aiSuggestedExams?: string | null;
  /** Última atualização da conduta (audit) */
  conductUpdatedAt?: string | null;
  /** Médico que atualizou a conduta (audit) */
  conductUpdatedBy?: string | null;
}

// ============================================
// NOTIFICATION TYPES (matches Notifications/NotificationDtos.cs)
// ============================================

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface NotificationResponseDto {
  id: string;
  userId: string;
  title: string;
  message: string;
  notificationType: NotificationType;
  read: boolean;
  data: Record<string, unknown> | null;
  createdAt: string;
}

// ============================================
// DOCTOR TYPES (matches Doctors/DoctorDtos.cs)
// ============================================

export interface DoctorListResponseDto {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  crm: string;
  crmState: string;
  specialty: string;
  bio: string | null;
  rating: number;
  totalConsultations: number;
  available: boolean;
  approvalStatus: string;
  birthDate?: string | null;
  cpf?: string | null;
  street?: string | null;
  number?: string | null;
  neighborhood?: string | null;
  complement?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  professionalAddress?: string | null;
  professionalPhone?: string | null;
  professionalPostalCode?: string | null;
  professionalStreet?: string | null;
  professionalNumber?: string | null;
  professionalNeighborhood?: string | null;
  professionalComplement?: string | null;
  professionalCity?: string | null;
  professionalState?: string | null;
  university?: string | null;
  courses?: string | null;
  hospitalsServices?: string | null;
}

// ============================================
// VIDEO TYPES (matches Video/VideoDtos.cs)
// ============================================

export type VideoRoomStatus = 'waiting' | 'active' | 'ended';

export interface VideoRoomResponseDto {
  id: string;
  requestId: string;
  roomName: string;
  roomUrl: string | null;
  status: VideoRoomStatus;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  createdAt: string;
}

// ============================================
// PAGINATION (matches DTOs/PagedResponse.cs - NO totalPages)
// ============================================

export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
}

// ============================================
// CERTIFICATE TYPES (matches Certificates/CertificateDtos.cs)
// ============================================

export interface CertificateInfoDto {
  id: string;
  subjectName: string;
  issuerName: string;
  notBefore: string;
  notAfter: string;
  isValid: boolean;
  isExpired: boolean;
  daysUntilExpiry: number;
}

export interface UploadCertificateResponseDto {
  success: boolean;
  message: string | null;
  certificateId: string | null;
}

// ============================================
// CRM VALIDATION (matches DoctorsController response)
// ============================================

export interface CrmValidationResponseDto {
  valid: boolean;
  doctorName: string | null;
  crm: string | null;
  uf: string | null;
  specialty: string | null;
  situation: string | null;
  error: string | null;
}

// ============================================
// PUSH TOKEN TYPES
// ============================================

export interface PushTokenDto {
  id: string;
  userId: string;
  token: string;
  deviceType: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string; // Backend não retorna; opcional para compatibilidade
}

// ============================================
// CLINICAL / FHIR-LITE TYPES (matches Clinical/ClinicalDtos.cs)
// ============================================

/** Tipos de encontro clínico (EncounterType enum, serializado como camelCase string) */
export type EncounterTypeName = 'teleconsultation' | 'prescriptionRenewal' | 'examOrder' | 'followUp' | 'orientation';

/** Tipos de documento médico (DocumentType enum, serializado como camelCase string) */
export type DocumentTypeName = 'prescription' | 'examOrder' | 'medicalReport';

export interface PatientSummaryDto {
  id: string;
  identifier: { cpf: string };
  name: { full: string; social?: string | null };
  birthDate: string | null;
  sex: string | null;
  contact: { phone?: string | null; email?: string | null };
  address?: {
    line1?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  } | null;
  stats: {
    totalRequests: number;
    totalPrescriptions: number;
    totalExams: number;
    totalConsultations: number;
    lastConsultationDate?: string | null;
    lastConsultationDaysAgo?: number | null;
  };
  medications: string[];
  exams: string[];
}

export interface EncounterSummaryDto {
  id: string;
  type: EncounterTypeName;
  startedAt: string;
  finishedAt: string | null;
  mainIcd10Code: string | null;
}

export interface MedicalDocumentSummaryDto {
  id: string;
  documentType: DocumentTypeName;
  status: string;
  createdAt: string;
  signedAt: string | null;
  encounterId: string | null;
}

/** Perfil do paciente para visualização pelo médico (identificação). */
export interface PatientProfileForDoctorDto {
  name: string;
  email: string | null;
  phone: string | null;
  birthDate: string | null;
  cpfMasked: string | null;
  gender: string | null;
  street: string | null;
  number: string | null;
  neighborhood: string | null;
  complement: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  avatarUrl: string | null;
}

// ============================================
// LEGACY COMPATIBILITY
// ============================================

export type User = UserDto;
export type DoctorProfile = DoctorProfileDto;
export type Request = RequestResponseDto;
export type Notification = NotificationResponseDto;
