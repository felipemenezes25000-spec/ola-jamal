// ============================================
// USER & AUTH TYPES (matches Auth/AuthDtos.cs)
// ============================================

export type UserRole = 'patient' | 'doctor';

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
}

// ============================================
// REQUEST TYPES (matches Requests/RequestDtos.cs + EnumHelper snake_case)
// ============================================

export type RequestType = 'prescription' | 'exam' | 'consultation';
export type PrescriptionType = 'simples' | 'controlado' | 'azul';

export type RequestStatus =
  | 'submitted'
  | 'in_review'
  | 'approved_pending_payment'
  | 'paid'
  | 'signed'
  | 'delivered'
  | 'rejected'
  | 'pending_payment'
  | 'searching_doctor'
  | 'consultation_ready'
  | 'in_consultation'
  | 'consultation_finished'
  | 'cancelled'
  | 'pending'
  | 'analyzing'
  | 'approved'
  | 'completed';

export interface RequestResponseDto {
  id: string;
  patientId: string;
  patientName: string | null;
  doctorId: string | null;
  doctorName: string | null;
  requestType: RequestType;
  status: RequestStatus;
  prescriptionType: PrescriptionType | null;
  medications: string[] | null;
  prescriptionImages: string[] | null;
  examType: string | null;
  exams: string[] | null;
  examImages: string[] | null;
  symptoms: string | null;
  price: number | null;
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
}

// ============================================
// PAYMENT TYPES (matches Payments/PaymentDtos.cs)
// ============================================

export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'refunded';

export interface PaymentResponseDto {
  id: string;
  requestId: string;
  userId: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod: string;
  externalId: string | null;
  pixQrCode: string | null;
  pixQrCodeBase64: string | null;
  pixCopyPaste: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
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
  data: Record<string, any> | null;
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
// LEGACY COMPATIBILITY
// ============================================

export type User = UserDto;
export type DoctorProfile = DoctorProfileDto;
export type Request = RequestResponseDto;
export type Payment = PaymentResponseDto;
export type Notification = NotificationResponseDto;
