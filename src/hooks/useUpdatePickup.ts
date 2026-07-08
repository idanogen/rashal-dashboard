import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updatePickup } from '@/lib/pickups';
import type { Pickup } from '@/types/pickup';
import { toast } from 'sonner';

interface UpdatePickupParams {
  id: string;
  fields: Partial<Omit<Pickup, 'id'>>;
}

export function useUpdatePickup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fields }: UpdatePickupParams) => updatePickup(id, fields),

    onMutate: async ({ id, fields }) => {
      await queryClient.cancelQueries({ queryKey: ['pickups'] });
      const previous = queryClient.getQueryData<Pickup[]>(['pickups']);
      queryClient.setQueryData<Pickup[]>(['pickups'], (old) =>
        old?.map((p) => (p.id === id ? { ...p, ...fields } : p)) ?? []
      );
      return { previous };
    },

    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['pickups'], context.previous);
      }
      console.error('[updatePickup] Error:', err.message, { id: variables.id });
      toast.error('שגיאה בעדכון האיסוף', {
        description: err instanceof Error ? err.message : undefined,
      });
    },

    onSuccess: () => {
      toast.success('האיסוף עודכן בהצלחה');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['pickups'] });
    },
  });
}
