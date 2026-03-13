/**
 * useDoctorRequestDetailQuery — React Query para detalhe de pedido do médico.
 * Alinha com o padrão do mobile (useRequestDetailQuery).
 */

import { useQuery } from '@tanstack/react-query';
import { getRequestById } from '@/services/doctor-api-requests';

export const doctorRequestDetailKeys = {
  all: ['doctor', 'request-detail'] as const,
  detail: (id: string) => ['doctor', 'request-detail', id] as const,
};

export function useDoctorRequestDetailQuery(id: string | undefined) {
  return useQuery({
    queryKey: doctorRequestDetailKeys.detail(id ?? ''),
    queryFn: () => getRequestById(id!),
    enabled: !!id,
    staleTime: 15_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) => {
      const err = error as { status?: number };
      if (err?.status === 401 || err?.status === 403 || err?.status === 404) return false;
      return failureCount < 2;
    },
  });
}
