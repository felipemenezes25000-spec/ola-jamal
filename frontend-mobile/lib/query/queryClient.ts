import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15000,
      retry: 1,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false,
    },
  },
});

export const queryKeys = {
  requests: (filters?: { page?: number; pageSize?: number; status?: string; type?: string }) => ['requests', filters ?? {}] as const,
  request: (id: string) => ['request', id] as const,
  paymentByRequest: (id: string) => ['paymentByRequest', id] as const,
  counters: ['counters'] as const,
};

