import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchPayment, fetchPaymentByRequest, fetchPixCode, syncPaymentStatus } from '../api';
import type { PaymentResponseDto } from '../../types/database';

// ── Query Key Factory ───────────────────────────────────────────

export const paymentKeys = {
  all: ['payment'] as const,
  detail: (id: string) => ['payment', id] as const,
  pixCode: (id: string) => ['payment', id, 'pix-code'] as const,
  byRequest: (requestId: string) => ['payment', 'by-request', requestId] as const,
};

/** Erro para sinalizar redirect (deep link antigo envia requestId). */
export class PaymentRedirectError extends Error {
  constructor(
    message: string,
    public readonly redirectTo: string,
  ) {
    super(message);
    this.name = 'PaymentRedirectError';
  }
}

// ── Main Query Hook ─────────────────────────────────────────────

/**
 * React Query hook for the payment detail screen.
 *
 * Replaces the manual useState + useEffect + setInterval polling with:
 * - Automatic loading/error state
 * - refetchInterval for PIX polling (replaces manual setInterval)
 * - Auto-stop polling when payment is approved
 * - AppState-aware refetch on resume
 * - Deduplication
 * - Redirect when id is requestId (deep link fallback)
 *
 * @param paymentId - The payment ID to fetch (or requestId for redirect)
 * @param polling  - Enable PIX polling (default: false, enable when on PIX screen)
 */
export function usePaymentQuery(paymentId: string | undefined, polling = false) {
  return useQuery({
    queryKey: paymentKeys.detail(paymentId ?? ''),
    queryFn: async () => {
      if (!paymentId) throw new Error('paymentId required');
      try {
        return await fetchPayment(paymentId);
      } catch (e: unknown) {
        const msg = (e as Error)?.message ?? '';
        if (msg.toLowerCase().includes('not found') || msg.includes('404')) {
          const byRequest = await fetchPaymentByRequest(paymentId);
          if (byRequest) {
            throw new PaymentRedirectError('Redirect', `/payment/${byRequest.id}`);
          }
          throw new PaymentRedirectError('Use request route', `/payment/request/${paymentId}`);
        }
        throw e;
      }
    },
    enabled: !!paymentId,
    staleTime: 5_000,
    gcTime: 5 * 60_000,
    // PIX polling: 5s when active, stop when approved
    refetchInterval: (query) => {
      if (!polling) return false;
      const data = query.state.data as PaymentResponseDto | undefined;
      if (data?.status === 'approved') return false; // Stop polling
      return 5_000;
    },
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true, // Recheck when coming back from bank app
    retry: (failureCount, error) => {
      if (error instanceof PaymentRedirectError) return false;
      const status = (error as { status?: number })?.status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 2;
    },
  });
}

// ── PIX Code Query ──────────────────────────────────────────────

/**
 * Fetch PIX copy-paste code for a payment.
 * Only runs when paymentId is provided.
 */
export function usePixCodeQuery(paymentId: string | undefined) {
  return useQuery({
    queryKey: paymentKeys.pixCode(paymentId ?? ''),
    queryFn: () => fetchPixCode(paymentId!),
    enabled: !!paymentId,
    staleTime: 30 * 60_000, // PIX code doesn't change
    gcTime: 60 * 60_000,
  });
}

// ── Payment by Request (fallback for deep links) ────────────────

export function usePaymentByRequestQuery(requestId: string | undefined) {
  return useQuery({
    queryKey: paymentKeys.byRequest(requestId ?? ''),
    queryFn: () => fetchPaymentByRequest(requestId!),
    enabled: !!requestId,
    staleTime: 10_000,
  });
}

// ── Sync Mutation ───────────────────────────────────────────────

/**
 * Sync payment status with Mercado Pago (resolves failed webhooks).
 * Updates the payment cache on success.
 */
export function useSyncPaymentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ requestId }: { requestId: string }) =>
      syncPaymentStatus(requestId),
    onSuccess: (synced) => {
      // Update the payment detail cache directly
      queryClient.setQueryData(paymentKeys.detail(synced.id), synced);
    },
  });
}

// ── Helpers ──────────────────────────────────────────────────────

/** Invalidate payment caches after payment changes. */
export function useInvalidatePayment() {
  const queryClient = useQueryClient();
  return (paymentId?: string) => {
    if (paymentId) {
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(paymentId) });
    } else {
      queryClient.invalidateQueries({ queryKey: paymentKeys.all });
    }
  };
}

/** Atualiza cache do pagamento (polling, sync, etc). */
export function usePaymentQueryHelpers() {
  const queryClient = useQueryClient();
  const setPaymentData = (paymentId: string, data: PaymentResponseDto) => {
    queryClient.setQueryData(paymentKeys.detail(paymentId), data);
  };
  return { setPaymentData };
}
