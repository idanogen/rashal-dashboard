import { useQuery } from '@tanstack/react-query';
import { fetchSecurityMatrix } from '@/lib/security-matrix';

export function useSecurityMatrix() {
  return useQuery({
    queryKey: ['securityMatrix'],
    queryFn: fetchSecurityMatrix,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
