import { useQuery } from '@tanstack/react-query';
import { fetchNewCustomers } from '@/lib/customers';

export function useNewCustomers() {
  return useQuery({
    queryKey: ['newCustomers'],
    queryFn: fetchNewCustomers,
    staleTime: 60 * 1000,
  });
}
