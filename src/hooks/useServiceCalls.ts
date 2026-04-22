import { useQuery } from '@tanstack/react-query';
import { fetchAllServiceCalls } from '@/lib/service-calls';

export function useServiceCalls() {
  return useQuery({
    queryKey: ['serviceCalls'],
    queryFn: fetchAllServiceCalls,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
