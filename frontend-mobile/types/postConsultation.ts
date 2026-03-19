/**
 * Types para emissão de documentos pós-consulta.
 * Corresponde aos DTOs do backend: PostConsultationEmitRequest/Response.
 */

// ── Request DTOs ──

export interface PrescriptionItemEmit {
  drug: string;
  concentration?: string;
  form?: string;
  posology?: string;
  duration?: string;
  quantity?: number;
  notes?: string;
}

export interface PrescriptionEmit {
  type: 'simples' | 'controlado';
  generalInstructions?: string;
  items: PrescriptionItemEmit[];
}

export interface ExamItemEmit {
  type: string;
  code?: string;
  description: string;
}

export interface ExamOrderEmit {
  clinicalJustification?: string;
  priority?: string;
  items: ExamItemEmit[];
}

export interface MedicalCertificateEmit {
  certificateType: 'afastamento' | 'comparecimento' | 'aptidao';
  body: string;
  icd10Code?: string;
  leaveDays?: number;
  leaveStartDate?: string;
  leavePeriod?: 'integral' | 'meio_periodo';
  includeIcd10: boolean;
}

export interface ReferralEmit {
  professionalName: string;
  specialty?: string;
  reason: string;
  icd10Code?: string;
}

export interface PostConsultationEmitRequest {
  requestId: string;
  /** Senha do certificado A1 (PFX) para assinar os documentos. Obrigatória para gerar PDFs assinados. */
  certificatePassword?: string;
  mainIcd10Code?: string;
  anamnesis?: string;
  structuredAnamnesis?: string;
  physicalExam?: string;
  plan?: string;
  differentialDiagnosis?: string;
  patientInstructions?: string;
  redFlags?: string;
  prescription?: PrescriptionEmit;
  examOrder?: ExamOrderEmit;
  medicalCertificate?: MedicalCertificateEmit;
  referral?: ReferralEmit;
}

// ── Response DTO ──

export interface PostConsultationEmitResponse {
  encounterId: string;
  prescriptionId?: string;
  examOrderId?: string;
  medicalCertificateId?: string;
  referralId?: string;
  documentsEmitted: number;
  documentTypes: string[];
  message: string;
}

// ── CID Package (dados locais para pré-preenchimento) ──

export interface CidPackageMedication {
  drug: string;
  posology: string;
  indication: string;
}

export interface CidPackage {
  code: string;
  name: string;
  defaultLeaveDays: number;
  defaultCertificateBody: string;
  medications: CidPackageMedication[];
  exams: string[];
  examJustification: string;
}
