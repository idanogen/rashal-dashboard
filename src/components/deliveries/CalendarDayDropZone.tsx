import { useDroppable } from '@dnd-kit/core';
import { toLocalDateStr } from '@/lib/calendar-meta';

/** עמודת יום שאפשר לגרור אליה עצירה. הוצא מ-`DeliveryCalendar.tsx` ב-28/10/2026. */
export function CalendarDayDropZone({
  date,
  children,
  isToday,
  isPast,
  widthClass,
}: {
  date: Date;
  children: React.ReactNode;
  isToday: boolean;
  isPast: boolean;
  widthClass: string;
}) {
  const dateStr = toLocalDateStr(date);
  const { isOver, setNodeRef } = useDroppable({
    id: `day-${dateStr}`,
    data: { type: 'day', date: dateStr },
  });

  return (
    <div
      ref={setNodeRef}
      data-rail-day={dateStr}
      className={`rounded-xl border bg-card shadow-sm transition-all duration-200 overflow-hidden ${widthClass} ${
        isToday ? 'ring-2 ring-primary shadow-md' : ''
      } ${isPast ? 'opacity-70' : ''} ${
        isOver
          ? 'ring-2 ring-primary bg-primary/5 scale-[1.02] shadow-lg'
          : ''
      }`}
    >
      {children}
    </div>
  );
}
