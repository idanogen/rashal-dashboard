import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { updateStop } from '@/lib/calendar-stops';
import type { CalendarStop, CoordinationMethod, CoordinationStatus } from '@/types/calendar-stop';

export interface UpdateCoordinationInput {
  stopId: string;
  fields: {
    coordinationStatus?: CoordinationStatus | undefined;
    coordinationMethod?: CoordinationMethod | undefined;
    coordinatedAt?: string | undefined;
    timeWindowStart?: string | undefined;
    timeWindowEnd?: string | undefined;
    notes?: string | undefined;
    coordinationNeedsCancel?: boolean | undefined;
  };
  /** Hide the default success toast (use when the caller fires another toast). */
  silent?: boolean;
}

export function useUpdateStopCoordination() {
  const qc = useQueryClient();
  return useMutation<CalendarStop, Error, UpdateCoordinationInput>({
    mutationFn: ({ stopId, fields }) => updateStop(stopId, fields),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['calendarStops'] });
      if (!vars.silent) toast.success('סטטוס תיאום עודכן');
    },
    onError: (err) => {
      toast.error(`שגיאה בעדכון: ${err.message}`);
    },
  });
}
