import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getRequests, sortRequestsByNewestFirst } from '../api';
import type { RequestResponseDto } from '../../types/database';

export const REQUESTS_QUERY_KEY = ['requests'] as const;

export function useRequestsQuery() {
  return useQuery({
    queryKey: REQUESTS_QUERY_KEY,
    queryFn: async () => {
      const response = await getRequests({ page: 1, pageSize: 50 });
      return sortRequestsByNewestFirst(response.items ?? []);
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: (failureCount, error) => {
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403) return false;
      return failureCount < 2;
    },
  });
}

export function useInvalidateRequests() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY });
}

/** Força refetch silencioso (ex: após SignalR event). */
export function useRefetchRequests() {
  const queryClient = useQueryClient();
  return () => queryClient.refetchQueries({ queryKey: REQUESTS_QUERY_KEY });
}

/** Lê cache sem refetch (útil para leituras pré-navegação). */
export function getCachedRequests(queryClient: ReturnType<typeof useQueryClient>): RequestResponseDto[] {
  return queryClient.getQueryData<RequestResponseDto[]>(REQUESTS_QUERY_KEY) ?? [];
}
