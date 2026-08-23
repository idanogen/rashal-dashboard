import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAssignees } from '@/lib/assignees';
import { primeAssigneeStyles } from '@/types/delivery';
import type { Assignee } from '@/types/assignee';

export const ASSIGNEES_QUERY_KEY = ['assignees'] as const;

/**
 * צוות השטח החי.
 *
 * ⭐ כל בורר שיבוץ קורא מכאן, ולכן עובד שנוסף במסך הצוות מופיע בשיבוץ
 * בלי פריסה. `all` כולל גם לא-פעילים, כדי שכרטיס היסטורי יידע להציג שם.
 */
export function useAssignees() {
  const query = useQuery({
    queryKey: ASSIGNEES_QUERY_KEY,
    queryFn: fetchAssignees,
    staleTime: 5 * 60 * 1000,
  });

  const all: Assignee[] = useMemo(() => query.data ?? [], [query.data]);

  return useMemo(() => {
    // 🔴 הצבעים מוזנים למטמון של `assigneeStyle`, שנקרא מתוך רינדור שאין
    // לו גישה ל-hook (תאי יומן, מרקרים על המפה). בלי זה כל השיבוצים
    // היו נצבעים אפור.
    primeAssigneeStyles(all);

    const active = all.filter((a) => a.active);
    return {
      all,
      active,
      /** מי שאפשר לשבץ לו עצירה: כל הפעילים, נהגים וטכנאים כאחד. */
      assignable: active.map((a) => a.name),
      /**
       * סדר תצוגה אחיד ביומן ובמפה. **כולל לא-פעילים בכוונה:** עצירה
       * היסטורית של מי שעזב עדיין צריכה מקום קבוע ולא לקפוץ לראש
       * הרשימה בגלל `indexOf` שמחזיר מינוס אחת.
       */
      order: all.map((a) => a.name),
      drivers: active.filter((a) => a.kind !== 'technician').map((a) => a.name),
      technicians: active.filter((a) => a.kind !== 'driver').map((a) => a.name),
      /** טכנאי שאינו נהג. קובע לאיזה מסך משימה מנותבת. */
      isTechnicianOnly: (name: string) =>
        all.find((a) => a.name === name)?.kind === 'technician',
      byName: (name: string) => all.find((a) => a.name === name),
      isLoading: query.isLoading,
      error: query.error,
    };
  }, [all, query.isLoading, query.error]);
}
