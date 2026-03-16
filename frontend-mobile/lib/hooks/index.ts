/**
 * React Query hooks — barrel export.
 *
 * All data-fetching hooks centralized here.
 * Screens should import from this file:
 *   import { useRequestDetailQuery, usePaymentQuery } from '../lib/hooks';
 */

// ── Request Lists ───────────────────────────────────────────────
export {
  useRequestsQuery,
  useInvalidateRequests,
  useRefetchRequests,
  getCachedRequests,
  REQUESTS_QUERY_KEY,
} from './useRequestsQuery';

export {
  useDoctorRequestsQuery,
  useInvalidateDoctorRequests,
  DOCTOR_REQUESTS_QUERY_KEY,
} from './useDoctorRequestsQuery';

// ── Request Detail ──────────────────────────────────────────────
export {
  useRequestDetailQuery,
  useMarkDelivered,
  useCancelRequest,
  useDocumentUrl,
  useInvalidateRequestDetail,
  useOptimisticUpdateRequest,
  requestDetailKeys,
} from './useRequestDetailQuery';

// ── Doctor Actions (mutations) ──────────────────────────────────
export { useDoctorActions } from './useDoctorActions';

// ── Create Request (mutations) ──────────────────────────────────
export {
  useCreatePrescription,
  useCreateExam,
  useCreateConsultation,
} from './useCreateRequest';
