import { useQuery } from '@tanstack/react-query';
import { fetchAllOrders } from '@/lib/airtable';

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: fetchAllOrders,
    staleTime: 30 * 1000,       // Data is fresh for 30 seconds
    refetchInterval: 60 * 1000, // Auto-refetch every 60 seconds
    refetchOnWindowFocus: true,
  });
}
