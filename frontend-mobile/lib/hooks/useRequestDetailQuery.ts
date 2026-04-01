import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import {
  fetchRequestById,
  markRequestDelivered,
  cancelRequest,
  getDocumentDownloadUrl,
} from '../api';
import type { RequestResponseDto } from '../../types/database';
import { REQUESTS_QUERY_KEY } from './useRequestsQuery';

const AWAITING_STATUSES = ['approved', 'searching_doctor', 'in_consultation', 'pending_post_consultation'] as const;

// ── Query Key Factory ───────────────────────────────────────────

export const requestDetailKeys = {
  all: ['request-detail'] as const,
  detail: (id: string) => ['request-detail', id] as const,
};

// ── Main Query Hook ─────────────────────────────────────────────

/**
 * React Query hook for request detail screen.
 *
 * Replaces the manual useState/useEffect/useCallback pattern with:
 * - Automatic loading/error state
 * - Cache with instant back-navigation
 * - Background refetch on focus
 * - Polling when awaiting consultation
 * - Deduplication (multiple components can use same requestId)
 * - Retry with 401/403 bailout
 *
 * Usage:
 *   const { data: request, isLoading, error, refetch } = useRequestDetailQuery();
 */
export function useRequestDetailQuery(requestIdOverride?: string) {
  const { id } = useLocalSearchParams<{ id: string }>();
  const requestId = requestIdOverride ?? (Array.isArray(id) ? id[0] : id) ?? '';

  return useQuery({
    queryKey: requestDetailKeys.detail(requestId),
    queryFn: ({ signal }) => fetchRequestById(requestId, { signal }),
    enabled: !!requestId,
    staleTime: 15_000, // 15s — detail can change fast (sign, consultation)
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const data = query.state.data as RequestResponseDto | undefined;
      if (!data) return false;
      const awaiting =
        (AWAITING_STATUSES as readonly string[]).includes(data.status) ||
        (data.requestType === 'consultation' && data.status === 'approved');
      return awaiting ? 5000 : false;
    },
    retry: (failureCount, error) => {
      const name = (error as { name?: string })?.name;
      if (name === 'AbortError') return false;
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });
}

// ── Mutation Hooks ───────────────────────────────────────────────

/** Mark request as delivered (Signed → Delivered). */
export function useMarkDelivered() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => markRequestDelivered(requestId),
    onSuccess: (updated) => {
      // Update detail cache
      queryClient.setQueryData(requestDetailKeys.detail(updated.id), updated);
      // Invalidate list cache
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY });
    },
  });
}

/** Cancel request (patient). */
export function useCancelRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string) => cancelRequest(requestId),
    onSuccess: (updated) => {
      queryClient.setQueryData(requestDetailKeys.detail(updated.id), updated);
      queryClient.invalidateQueries({ queryKey: REQUESTS_QUERY_KEY });
    },
  });
}

/** Get secure download URL for signed document. */
export function useDocumentUrl(requestId: string | undefined) {
  return useQuery({
    queryKey: ['document-url', requestId],
    queryFn: () => getDocumentDownloadUrl(requestId!),
    enabled: !!requestId,
    staleTime: 4 * 60_000, // Token lasts ~5min, refetch before expiry
    gcTime: 5 * 60_000,
  });
}

// ── Helpers ──────────────────────────────────────────────────────

/** Invalidate a specific request detail (e.g., after SignalR event). */
export function useInvalidateRequestDetail() {
  const queryClient = useQueryClient();
  return (requestId: string) =>
    queryClient.invalidateQueries({
      queryKey: requestDetailKeys.detail(requestId),
    });
}

/** Optimistically update request detail cache. */
export function useOptimisticUpdateRequest() {
  const queryClient = useQueryClient();
  return (requestId: string, updater: (old: RequestResponseDto) => RequestResponseDto) => {
    queryClient.setQueryData<RequestResponseDto>(
      requestDetailKeys.detail(requestId),
      (old) => (old ? updater(old) : old)
    );
  };
}
