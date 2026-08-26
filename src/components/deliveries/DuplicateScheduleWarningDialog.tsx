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
  /**
   * מעביר את השיבוץ **הקיים** ליום ולעובד שנבחרו, במקום ליצור שיבוץ שני.
   * 🔴 בלי זה הדיאלוג הוא מבוי סתום: הוא חוסם ושולח את העובד לנווט ליום
   * אחר ביומן, למחוק שם שורה, ולחזור.
   */
  onReschedule?: () => void;
  /**
   * ⭐ **סוגר את השיבוץ הקיים כ"בוצע" ואז משבץ את החדש.**
   *
   * 🔴 זו התשובה הנכונה למקרה הנפוץ, ועד 26/08/2026 היא לא הייתה קיימת:
   * ברוב המקרים השיבוץ ה"פעיל" הוא אספקה שכבר בוצעה לפני שבוע ואיש לא
   * סגר אותה. אין מה להעביר, צריך לסגור. נמדד: **294 מתוך 299** העצירות
   * הפעילות מתוארכות לעבר, ו-236 מהן מעל חודש.
   */
  onCloseExisting?: () => void;
  /** התאריך שנבחר, לניסוח הכפתור. */
  targetDate?: string;
}

export function DuplicateScheduleWarningDialog({
  open,
  onOpenChange,
  conflicts,
  onCancel,
  nonConflictingCount = 0,
  onScheduleOthers,
  onReschedule,
  onCloseExisting,
  targetDate,
}: DuplicateScheduleWarningDialogProps) {
  const multiple = conflicts.length > 1;

  // ⭐ **הוותק הוא מה שמכריע איזו פעולה נכונה**, ולכן הוא מחושב ומוצג ולא
  // נשאר בראש של מי שקורא את התאריך. שיבוץ מלפני שבוע כמעט תמיד אומר
  // "כבר קרה ולא נסגר", ושיבוץ למחר אומר "באמת מתוכנן".
  const today = new Date().toISOString().slice(0, 10);
  const stalest = conflicts
    .flatMap((c) => c.existing)
    .map((s) => s.deliveryDate)
    .filter((d) => d < today)
    .sort()[0];
  const staleCount = conflicts
    .flatMap((c) => c.existing)
    .filter((s) => s.deliveryDate < today).length;
  const allStale = staleCount > 0 && staleCount === conflicts.flatMap((c) => c.existing).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
        {/* 🔴 `text-start` מקומי: הפרימיטיב מגדיר `sm:text-left`, כיוון
            פיזי שבתוך RTL מיישר לצד הלא נכון. תוקן כאן בלבד, כדי לא
            להזיז 20 דיאלוגים אחרים בלי לצלם אותם. */}
        <DialogHeader className="sm:text-start">
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            {multiple ? 'כמה מהלקוחות כבר משובצים' : 'הלקוח כבר משובץ ביומן'}
          </DialogTitle>
          <DialogDescription>
            {multiple
              ? `${conflicts.length} מהלקוחות שניסית לשבץ מחזיקים כבר שיבוץ פתוח ביומן. שיבוץ נוסף היה שולח עובד פעמיים לאותו לקוח.`
              : 'ללקוח הזה כבר יש שיבוץ פתוח ביומן. שיבוץ נוסף היה שולח עובד פעמיים לאותו לקוח.'}
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
            {allStale ? (
              <>
                <span className="font-semibold text-foreground">
                  {multiple ? 'כל השיבוצים הקיימים בתאריך שכבר עבר' : `השיבוץ הקיים הוא מ-${fmtShort(stalest!)}, תאריך שכבר עבר`}
                  .
                </span>{' '}
                כמעט תמיד זה אומר שהעבודה כבר בוצעה ופשוט לא נסגרה ביומן.{' '}
                <span className="font-semibold text-foreground">&quot;כבר בוצע, סגור אותו&quot;</span>{' '}
                סוגר אותה ומשבץ את החדש.
              </>
            ) : (
              <>
                אם השיבוץ הקיים כבר בוצע ולא נסגר,{' '}
                <span className="font-semibold text-foreground">&quot;כבר בוצע, סגור אותו&quot;</span>.
                אם הוא באמת מתוכנן קדימה,{' '}
                <span className="font-semibold text-foreground">&quot;העבר את השיבוץ הקיים&quot;</span>{' '}
                מזיז אותו ליום ולעובד שבחרת.
              </>
            )}
          </span>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {/* 🔴 סדר הכפתורים נגזר מהוותק ולא קבוע: כשכל השיבוצים בעבר,
              "כבר בוצע" הוא הפעולה הראשית, וההעברה יורדת למשנית. */}
          {onCloseExisting && (
            <Button
              variant={allStale ? 'default' : 'outline'}
              onClick={() => {
                onCloseExisting();
                onOpenChange(false);
              }}
            >
              {multiple ? `כבר בוצעו, סגור ושבץ (${conflicts.length})` : 'כבר בוצע, סגור ושבץ'}
            </Button>
          )}
          {onReschedule && (
            <Button
              variant={allStale ? 'outline' : 'default'}
              onClick={() => {
                onReschedule();
                onOpenChange(false);
              }}
            >
              {multiple
                ? `העבר את ${conflicts.length} הקיימים`
                : `העבר את הקיים${targetDate ? ` ל-${fmtShort(targetDate)}` : ''}`}
            </Button>
          )}
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
            variant="ghost"
            onClick={() => {
              onCancel();
              onOpenChange(false);
            }}
          >
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** תאריך קצר לכפתור. */
function fmtShort(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}
