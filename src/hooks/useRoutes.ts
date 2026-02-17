import { useQuery } from '@tanstack/react-query';
import { fetchAllRoutes } from '@/lib/airtable-routes';

export function useRoutes() {
  return useQuery({
    queryKey: ['routes'],
    queryFn: fetchAllRoutes,
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
