import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRequests, sortRequestsByNewestFirst } from '../api';
import type { RequestResponseDto } from '../../types/database';

export const DOCTOR_REQUESTS_QUERY_KEY = ['doctor-requests'] as const;

/**
 * Query principal da fila do médico.
 *
 * refetchInterval adaptativo:
 *   - SignalR conectado  → 30s (fallback silencioso)
 *   - SignalR desconectado → 8s (polling mais agressivo)
 *
 * Eventos SignalR devem chamar `useInvalidateDoctorRequests()` para
 * invalidar o cache e forçar refetch imediato sem polling.
 */
export function useDoctorRequestsQuery(isSignalRConnected: boolean) {
  return useQuery<RequestResponseDto[]>({
    queryKey: DOCTOR_REQUESTS_QUERY_KEY,
    queryFn: async () => {
      const response = await getRequests({ page: 1, pageSize: 500 });
      return sortRequestsByNewestFirst(response.items ?? []);
    },
    staleTime: 10_000,
    gcTime: 5 * 60_000,
    refetchInterval: isSignalRConnected ? 30_000 : 8_000,
    refetchIntervalInBackground: false,
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
  });
}

/** Invalida e refetcha silenciosamente — usar em listeners SignalR. */
export function useInvalidateDoctorRequests() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: DOCTOR_REQUESTS_QUERY_KEY });
}
