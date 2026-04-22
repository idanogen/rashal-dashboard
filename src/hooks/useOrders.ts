import { useQuery } from '@tanstack/react-query';
import { fetchAllOrders } from '@/lib/orders';

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: fetchAllOrders,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
