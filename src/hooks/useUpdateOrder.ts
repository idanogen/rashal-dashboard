import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOrder } from '@/lib/airtable';
import type { Order } from '@/types/order';
import { toast } from 'sonner';

interface UpdateOrderParams {
  id: string;
  fields: Partial<Omit<Order, 'id'>>;
}

export function useUpdateOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fields }: UpdateOrderParams) => updateOrder(id, fields),

    onMutate: async ({ id, fields }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['orders'] });

      // Snapshot previous value
      const previous = queryClient.getQueryData<Order[]>(['orders']);

      // Optimistically update
      queryClient.setQueryData<Order[]>(['orders'], (old) =>
        old?.map((o) => (o.id === id ? { ...o, ...fields } : o)) ?? []
      );

      return { previous };
    },

    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(['orders'], context.previous);
      }
      console.error('[updateOrder] Error:', err.message, { id: variables.id, fields: variables.fields });
      toast.error('שגיאה בעדכון ההזמנה', {
        description: err instanceof Error ? err.message : undefined,
      });
    },

    onSuccess: () => {
      toast.success('ההזמנה עודכנה בהצלחה');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
