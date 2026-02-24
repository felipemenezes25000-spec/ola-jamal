import { useQuery } from '@tanstack/react-query';
import { getPaymentByRequest } from '../lib/api';
import { queryKeys } from '../lib/query/queryClient';

export function usePaymentByRequest(id?: string) {
  return useQuery({
    queryKey: id ? queryKeys.paymentByRequest(id) : ['paymentByRequest', 'missing-id'],
    queryFn: () => getPaymentByRequest(id!),
    enabled: !!id,
  });
}

