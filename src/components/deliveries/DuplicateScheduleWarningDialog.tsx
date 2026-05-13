import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Calendar, User, Info } from 'lucide-react';
import type { CalendarStop } from '@/types/calendar-stop';
import { STOP_STATUS_LABELS } from '@/types/calendar-stop';

export interface DuplicateConflict {
  /** The customer the user is trying to schedule */
  customerName: string;
  city?: string;
  phone?: string;
  /** Existing active stops blocking this schedule */
  existing: CalendarStop[];
}

interface DuplicateScheduleWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conflicts: DuplicateConflict[];
  /** Called when user dismisses without scheduling */
  onCancel: () => void;
  /** How many of the originally-selected items had NO conflict and were skipped here.
   *  If > 0, we can offer to schedule just those. */
  nonConflictingCount?: number;
  /** Schedule only the items that were not in conflict (skip the conflicting ones). */
  onScheduleOthers?: () => void;
}

export function DuplicateScheduleWarningDialog({
  open,
  onOpenChange,
  conflicts,
  onCancel,
  nonConflictingCount = 0,
  onScheduleOthers,
}: DuplicateScheduleWarningDialogProps) {
  const multiple = conflicts.length > 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            {multiple ? 'כפילויות — שיבוץ נחסם' : 'הלקוח כבר משובץ — שיבוץ נחסם'}
          </DialogTitle>
          <DialogDescription>
            {multiple
              ? `${conflicts.length} מהלקוחות שניסית לשבץ כבר משובצים פעילים ביומן. השיבוץ הכפול נחסם כדי שלא יישלח טכנאי פעמיים לאותו לקוח.`
              : 'הלקוח הזה כבר משובץ פעיל ביומן. השיבוץ הכפול נחסם כדי שלא יישלח טכנאי פעמיים לאותו לקוח.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {conflicts.map((c, idx) => (
            <div
              key={idx}
              className="rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm"
            >
              <div className="flex items-center gap-1.5 font-semibold">
                <User className="h-4 w-4 text-amber-700" />
                {c.customerName}
                {c.city && <span className="text-muted-foreground">· {c.city}</span>}
              </div>
              <ul className="mt-2 space-y-1">
                {c.existing.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3 text-amber-700" />
                    <span className="font-medium">{fmtDate(s.deliveryDate)}</span>
                    <span>·</span>
                    <span>{s.driver}</span>
                    <span>·</span>
                    <span>{STOP_STATUS_LABELS[s.status]}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex items-start gap-2 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            אם זה באמת ביקור שני נפרד — מחק קודם את העצירה הקיימת ביומן (כפתור ה-X), ואז נסה לשבץ שוב.
          </span>
        </div>

        <DialogFooter>
          {nonConflictingCount > 0 && onScheduleOthers && (
            <Button
              variant="outline"
              onClick={() => {
                onScheduleOthers();
                onOpenChange(false);
              }}
            >
              דלג על הכפילויות ושבץ {nonConflictingCount}
            </Button>
          )}
          <Button
            variant="default"
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
          >
            הבנתי
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
