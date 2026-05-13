import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchLatestSync, applySyncDiff } from '@/lib/crane-sync';
import type { SyncDiff } from '@/lib/crane-sync';

export function useLatestSync() {
  return useQuery({
    queryKey: ['craneSync', 'latest'],
    queryFn: fetchLatestSync,
    staleTime: 60 * 1000,
  });
}

export function useApplySync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      diff: SyncDiff;
      meta: { sourceFilename: string; totalRowsInFile: number; performedBy?: string; notes?: string };
    }) => applySyncDiff(input.diff, input.meta),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['cranes'] });
      qc.invalidateQueries({ queryKey: ['craneSync'] });
      toast.success(
        `סנכרון הושלם — ${res.newCranesCount} חדשים, ${res.updatedCranesCount} עודכנו, ${res.unchangedCount} ללא שינוי`
      );
    },
    onError: (e: Error) => toast.error(`שגיאת סנכרון: ${e.message}`),
  });
}
