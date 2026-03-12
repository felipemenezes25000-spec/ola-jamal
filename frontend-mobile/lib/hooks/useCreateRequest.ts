/**
 * useCreateRequest — Mutation hooks for creating new requests.
 *
 * Replaces manual useState(loading) + try/catch in:
 * - new-request/prescription.tsx
 * - new-request/exam.tsx
 * - new-request/consultation.tsx
 *
 * Benefits:
 * - Automatic list invalidation on success
 * - Built-in isPending
 * - Error accessible via mutation.error
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createPrescriptionRequest,
  createExamRequest,
  createConsultationRequest,
  type CreatePrescriptionRequestData,
  type CreateExamRequestData,
  type CreateConsultationRequestData,
} from '../api';
import type { ApiError } from '../api-client';
import { REQUESTS_QUERY_KEY } from './useRequestsQuery';

export function useCreatePrescription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreatePrescriptionRequestData) =>
      createPrescriptionRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY });
    },
  });
}

export function useCreateExam() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateExamRequestData) =>
      createExamRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY });
    },
  });
}

export function useCreateConsultation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateConsultationRequestData) =>
      createConsultationRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY });
    },
  });
}

/**
 * Retorna true se o erro é uma rejeição de duplicata (HTTP 409)
 * vinda da regra de cooldown/pedido ativo.
 */
export function isDuplicateRequestError(err: unknown): err is ApiError & { status: 409 } {
  return (
    !!err &&
    typeof err === 'object' &&
    'status' in err &&
    (err as ApiError).status === 409 &&
    'code' in err &&
    typeof (err as ApiError).code === 'string'
  );
}
