import { useQuery } from '@tanstack/react-query';
import { fetchMorningReport } from '@/lib/morning-report';

/** `date` ריק = יום העבודה האחרון שהיו בו עצירות (המסד מחליט). */
export function useMorningReport(date: string | null) {
  return useQuery({
    queryKey: ['morningReport', date ?? 'default'],
    queryFn: () => fetchMorningReport(date),
    staleTime: 5 * 60 * 1000,
  });
}
