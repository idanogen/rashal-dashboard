import { useMutation, useQueryClient } from '@tanstack/react-query';
import { geocodeStopAddress, updateStopDetails } from '@/lib/calendar-stops';
import { persistTimelineEvent } from '@/lib/timeline';
import { useChatAuthor } from '@/hooks/useTimeline';
import { buildStopDetailsPatch, describeStopDetailsChange, type StopDetailsCurrent, type StopDetailsForm } from '@/lib/stop-details';
import type { StopSourceType } from '@/types/calendar-stop';
import { toast } from 'sonner';

export interface StopDetailsRef extends StopDetailsCurrent {
  stopId: string;
  sourceId: string;
  sourceType: StopSourceType;
}

/**
 * עריכת פרטי עצירה אחרי שיבוץ. העצירה היא העותק שלנו: פריוריטי לא נוגעת.
 * השינוי נרשם כהודעת מערכת בצ'אט של ההזמנה או הקריאה, כדי שמי שפותח את
 * הכרטיס יראה למה הכתובת שונה ממה שכתוב בפריוריטי.
 */
export function useUpdateStopDetails() {
  const queryClient = useQueryClient();
  const { userId, userName } = useChatAuthor();

  return useMutation({
    mutationFn: async ({ stop, form }: { stop: StopDetailsRef; form: StopDetailsForm }) => {
      const patch = buildStopDetailsPatch(stop, form);
      if (patch.empty) return { patch, updated: null };
      const updated = await updateStopDetails(stop.stopId, patch.fields, patch.relocate);
      if (patch.relocate) {
        // מיקום חדש על המפה, ואז רענון כדי שהסיכה תזוז.
        void geocodeStopAddress({ id: stop.stopId, address: updated.address, city: updated.city })
          .then(() => queryClient.invalidateQueries({ queryKey: ['calendarStops'] }));
      }
      if (stop.sourceType === 'service' || stop.sourceType === 'delivery') {
        await persistTimelineEvent({
          id: `event-${Date.now()}`,
          source: { kind: stop.sourceType === 'service' ? 'service' : 'order', id: stop.sourceId },
          type: 'reschedule',
          userId,
          userName,
          content: `✏️ פרטי העצירה עודכנו ע״י ${userName}: ${describeStopDetailsChange(stop, patch)}. בפריוריטי לא השתנה כלום.`,
          metadata: { action: 'stop_details', ...patch.fields },
        }).catch(() => undefined);
      }
      return { patch, updated };
    },
    onSuccess: ({ patch }, vars) => {
      if (patch.empty) return;
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      if (vars.stop.sourceId) queryClient.invalidateQueries({ queryKey: ['timeline', vars.stop.sourceId] });
      toast.success('פרטי העצירה עודכנו', { description: describeStopDetailsChange(vars.stop, patch) });
    },
    onError: (err) => {
      toast.error('העדכון נכשל', { description: err instanceof Error ? err.message : undefined });
    },
  });
}
