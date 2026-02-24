import { useQuery } from '@tanstack/react-query';
import { fetchRequestById } from '../lib/api';
import { queryKeys } from '../lib/query/queryClient';

export function useRequest(id?: string) {
  return useQuery({
    queryKey: id ? queryKeys.request(id) : ['request', 'missing-id'],
    queryFn: () => fetchRequestById(id!),
    enabled: !!id,
  });
}

