import { useQuery } from '@tanstack/react-query';
import { fetchAllCranes } from '@/lib/cranes';

export function useCranes() {
  return useQuery({
    queryKey: ['cranes'],
    queryFn: fetchAllCranes,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
