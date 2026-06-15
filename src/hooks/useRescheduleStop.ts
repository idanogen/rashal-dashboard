import { useMutation, useQueryClient } from '@tanstack/react-query';
import { rescheduleStop } from '@/lib/calendar-stops';
import { persistTimelineEvent } from '@/lib/timeline';
import { useChatAuthor } from '@/hooks/useTimeline';
import type { AssigneeName } from '@/types/route';
import type { CoordinationStatus, StopSourceType } from '@/types/calendar-stop';
import { toast } from 'sonner';

/** Minimal stop reference needed to reschedule + log the system message. */
export interface RescheduleStopRef {
  stopId: string;
  sourceId: string;
  sourceType: StopSourceType;
  deliveryDate: string; // old date
  driver: AssigneeName; // old assignee
  coordinationStatus?: CoordinationStatus;
  timeWindowStart?: string;
  timeWindowEnd?: string;
}

interface RescheduleParams {
  stop: RescheduleStopRef;
  newDate: string;
  newDriver: AssigneeName;
}

function formatHe(date: string): string {
  return new Date(date + 'T00:00:00').toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'numeric',
  });
}

/**
 * שיבוץ מחדש בגרירה בין ימים + חותמת משתמש.
 * אם לעצירה יש תיאום לקוח → נכתבת הודעת מערכת בצ'אט (order/service) שצריך לבטל את התיאום.
 */
export function useRescheduleStop() {
  const queryClient = useQueryClient();
  const { userId, userName } = useChatAuthor();

  return useMutation({
    mutationFn: async ({ stop, newDate, newDriver }: RescheduleParams) => {
      const updated = await rescheduleStop(stop.stopId, {
        newDate,
        newDriver,
        rescheduledBy: userName,
      });

      // הודעת מערכת בצ'אט — רק לעצירה מתואמת (order/service, לא task).
      if (
        stop.coordinationStatus &&
        stop.sourceType !== 'task' &&
        stop.sourceId
      ) {
        const window =
          stop.timeWindowStart && stop.timeWindowEnd
            ? `${stop.timeWindowStart}–${stop.timeWindowEnd}`
            : 'שעה שתואמה';
        const content =
          `🔄 שובץ מחדש מ-${formatHe(stop.deliveryDate)} (${stop.driver}) ` +
          `ל-${formatHe(newDate)} (${newDriver}) ע״י ${userName}. ` +
          `היה תואם ל-${window} בתאריך ${formatHe(stop.deliveryDate)} — יש לבטל את התיאום מול הלקוח.`;
        await persistTimelineEvent({
          id: `event-${Date.now()}`,
          source: {
            kind: stop.sourceType === 'service' ? 'service' : 'order',
            id: stop.sourceId,
          },
          type: 'reschedule',
          userId,
          userName,
          content,
          metadata: {
            action: 'reschedule',
            oldDate: stop.deliveryDate,
            oldDriver: stop.driver,
            newDate,
            newDriver,
            coordinationStatus: stop.coordinationStatus,
          },
        });
      }

      return updated;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ['calendarStops'] });
      if (vars.stop.sourceId) {
        queryClient.invalidateQueries({ queryKey: ['timeline', vars.stop.sourceId] });
      }
      toast.success(`העצירה הועברה ל-${vars.newDriver}`);
    },
    onError: (err) => {
      console.error('[useRescheduleStop]', err);
      toast.error('שגיאה בהעברת העצירה', {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}
