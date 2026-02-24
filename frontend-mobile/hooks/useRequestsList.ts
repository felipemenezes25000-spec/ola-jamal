import { useQuery } from '@tanstack/react-query';
import { getRequests } from '../lib/api';
import { queryKeys } from '../lib/query/queryClient';

export function useRequestsList(filters?: { page?: number; pageSize?: number; status?: string; type?: string }) {
  return useQuery({
    queryKey: queryKeys.requests(filters),
    queryFn: () => getRequests(filters),
  });
}

