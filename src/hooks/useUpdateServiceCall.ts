import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateServiceCall } from '@/lib/service-calls';
import type { ServiceCall } from '@/types/service-call';
import { toast } from 'sonner';

interface UpdateServiceCallParams {
  id: string;
  fields: Partial<Omit<ServiceCall, 'id'>>;
}

export function useUpdateServiceCall() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, fields }: UpdateServiceCallParams) => updateServiceCall(id, fields),

    onMutate: async ({ id, fields }) => {
      await queryClient.cancelQueries({ queryKey: ['serviceCalls'] });

      const previous = queryClient.getQueryData<ServiceCall[]>(['serviceCalls']);

      queryClient.setQueryData<ServiceCall[]>(['serviceCalls'], (old) =>
        old?.map((c) => (c.id === id ? { ...c, ...fields } : c)) ?? []
      );

      return { previous };
    },

    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['serviceCalls'], context.previous);
      }
      console.error('[updateServiceCall] Error:', err.message, { id: variables.id, fields: variables.fields });
      toast.error('שגיאה בעדכון קריאת השירות', {
        description: err instanceof Error ? err.message : undefined,
      });
    },

    onSuccess: () => {
      toast.success('קריאת השירות עודכנה בהצלחה');
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceCalls'] });
    },
  });
}
