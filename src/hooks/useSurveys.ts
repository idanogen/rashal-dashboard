import { useQuery } from '@tanstack/react-query';
import { fetchSurveys } from '@/lib/surveys';

export function useSurveys(days = 30) {
  return useQuery({
    queryKey: ['surveys', days],
    queryFn: () => fetchSurveys(days),
    staleTime: 60 * 1000,
  });
}
