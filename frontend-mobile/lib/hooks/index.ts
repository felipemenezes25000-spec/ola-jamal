/**
 * React Query hooks — barrel export.
 *
 * All data-fetching hooks centralized here.
 * Screens should import from this file:
 *   import { useRequestDetailQuery } from '../lib/hooks';
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

// ── Create Request (mutations) ──────────────────────────────────
export {
  useCreatePrescription,
  useCreateExam,
  useCreateConsultation,
} from './useCreateRequest';

// ── Payment ────────────────────────────────────────────────────
export {
  usePaymentQuery,
  usePixCodeQuery,
  usePaymentByRequestQuery,
  useSyncPaymentStatus,
  useInvalidatePayment,
  usePaymentQueryHelpers,
  paymentKeys,
  PaymentRedirectError,
} from './usePaymentQuery';
