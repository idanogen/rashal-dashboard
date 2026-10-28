import { MapPin, Pencil, Phone } from 'lucide-react';
import type { CalendarStop } from '@/types/delivery';

/**
 * כתובת, "במקור", טלפון וטלפון נוסף של העצירה, והעיפרון של המשרד.
 * 28/10/2026 (עידן): מוסיפים ולא דורסים. הטלפון מפריוריטי נשאר, הנוסף לידו;
 * כתובת לניווט שונה מציגה "במקור" עם הכתובת מפריוריטי.
 */
export function StopCardContact({ stop, isResolved, onEditDetails }: {
  stop: CalendarStop;
  isResolved: boolean;
  onEditDetails?: (stop: CalendarStop) => void;
}) {
  return (
    <>
      {/* Address (+ עריכה: הכתובת על העצירה היא מה שהנהג נוסע אליו, לא מה שבפריוריטי) */}
      {(stop.address || stop.city || onEditDetails) && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1 min-w-0">
          <MapPin className="h-3 w-3 flex-shrink-0" />
          <span className="truncate">
            {stop.address || stop.city ? (
              <>
                {stop.address}
                {stop.city ? `, ${stop.city}` : ''}
              </>
            ) : (
              <span className="italic">אין כתובת</span>
            )}
          </span>
          {onEditDetails && !isResolved && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onEditDetails(stop);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="ms-auto flex h-5 w-5 flex-shrink-0 items-center justify-center rounded hover:bg-primary/10 hover:text-primary"
              title="עריכת כתובת, עיר וטלפון של העצירה"
              aria-label="עריכת פרטי העצירה"
            >
              <Pencil className="h-3 w-3" />
            </button>
          )}
        </p>
      )}

      {stop.originalAddress && (
        <p className="text-[11px] text-muted-foreground/80 mt-0.5 ps-4 truncate" title="הכתובת כפי שהגיעה מפריוריטי. לא נמחקה.">
          במקור: {stop.originalAddress}{stop.originalCity ? `, ${stop.originalCity}` : ''}
        </p>
      )}

      {/* Phone */}
      {stop.phone && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
          <Phone className="h-3 w-3 flex-shrink-0" />
          <a href={`tel:${stop.phone}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary font-medium" dir="ltr">
            {stop.phone}
          </a>
        </p>
      )}
      {stop.phoneExtra && (
        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1" title="טלפון נוסף שנרשם מהשטח או מהמשרד. הראשי לא נדרס.">
          <Phone className="h-3 w-3 flex-shrink-0" />
          <a href={`tel:${stop.phoneExtra}`} onClick={(e) => e.stopPropagation()} className="hover:text-primary font-medium" dir="ltr">
            {stop.phoneExtra}
          </a>
          <span className="rounded bg-muted px-1 text-[10px]">נוסף</span>
        </p>
      )}
    </>
  );
}
