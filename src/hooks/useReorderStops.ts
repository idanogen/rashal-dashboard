import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reorderStops } from '@/lib/calendar-stops';
import type { DriverName } from '@/types/route';
import { toast } from 'sonner';

interface ReorderStopsParams {
  deliveryDate: string;
  driver: DriverName;
  orderedIds: string[];
}

export function useReorderStops() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ deliveryDate, driver, orderedIds }: ReorderStopsParams) =>
      reorderStops(deliveryDate, driver, orderedIds),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
    },

    onError: (err) => {
      console.error('[reorderStops] Error:', err);
      toast.error('שגיאה בסידור העצירות');
    },
  });
}
