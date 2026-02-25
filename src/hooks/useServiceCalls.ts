import { useQuery } from '@tanstack/react-query';
import { fetchAllServiceCalls } from '@/lib/airtable-service-calls';

export function useServiceCalls() {
  return useQuery({
    queryKey: ['serviceCalls'],
    queryFn: fetchAllServiceCalls,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
