import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRoute } from '@/lib/airtable-routes';
import type { ApprovedRoute } from '@/types/route';
import { toast } from 'sonner';

export function useUpdateRoute() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fields }: { id: string; fields: Partial<Pick<ApprovedRoute, 'status' | 'notes' | 'stops' | 'orderIds' | 'stopCount'>> }) =>
      updateRoute(id, fields),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['routes'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },

    onError: (err) => {
      console.error('[updateRoute] Error:', err);
      toast.error('שגיאה בעדכון המסלול');
    },
  });
}
