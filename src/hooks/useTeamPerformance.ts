import { useQuery } from '@tanstack/react-query';
import { fetchTeamPerformance } from '@/lib/team-performance';

export function useTeamPerformance(days: number) {
  return useQuery({
    queryKey: ['teamPerformance', days],
    queryFn: () => fetchTeamPerformance(days),
    staleTime: 5 * 60 * 1000,
  });
}
