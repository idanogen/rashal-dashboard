import { useQuery } from '@tanstack/react-query';
import { fetchAllPickups } from '@/lib/pickups';

export function usePickups() {
  return useQuery({
    queryKey: ['pickups'],
    queryFn: fetchAllPickups,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
