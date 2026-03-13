/**
 * useDoctorRequestsQuery — React Query para lista de pedidos do médico.
 * Alinha com o padrão do mobile (useRequestsQuery).
 */

import { useQuery } from '@tanstack/react-query';
import { getRequests } from '@/services/doctor-api-requests';
import { parseApiList } from '@/lib/doctor-helpers';
import type { MedicalRequest } from '@/services/doctorApi';

export const DOCTOR_REQUESTS_QUERY_KEY = ['doctor', 'requests'] as const;

function sortByNewestFirst(items: MedicalRequest[]): MedicalRequest[] {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function useDoctorRequestsQuery() {
  return useQuery({
    queryKey: DOCTOR_REQUESTS_QUERY_KEY,
    queryFn: async () => {
      const data = await getRequests({ page: 1, pageSize: 500 });
      const items = parseApiList<MedicalRequest>(data);
      return sortByNewestFirst(items);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) => {
      const err = error as { status?: number };
      if (err?.status === 401 || err?.status === 403) return false;
      return failureCount < 2;
    },
  });
}
