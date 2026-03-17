import { apiClient } from './api-client';
import { logApiError } from './logger';
import type {
  DoctorProfileDto,
  DoctorListResponseDto,
  PagedResponse,
  CrmValidationResponseDto,
  CertificateInfoDto,
  UploadCertificateResponseDto,
} from '../types/database';

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
    logApiError(0, '/api/requests/stats', (e as { message?: string })?.message ?? String(e));
    return { pendingCount: 0, inReviewCount: 0, completedCount: 0, totalEarnings: 0 };
  }
}
