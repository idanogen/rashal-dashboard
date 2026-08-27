import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RotateCcw, X } from 'lucide-react';
import type { StopResolutionKind } from '@/types/calendar-stop';

/**
 * סיבות מהירות — לחיצה ממלאת את שדה הטקסט.
 *
 * 🔴 **רשימה נפרדת לכל מצב, ולא רשימה אחת משותפת.** "הלקוח לא היה בבית"
 * אינה סיבה להמשך טיפול, ו"הציוד לא התאים" אינה סיבה לאי ביצוע. רשימה
 * משותפת הייתה מזמינה בחירה של הסיבה הקרובה ביותר במקום הנכונה, וזה
 * בדיוק מה שהופך את השדה לחסר ערך למי שקורא אותו במשרד.
 */
const QUICK_REASONS: Record<StopResolutionKind, readonly string[]> = {
  not_done: [
    'הלקוח לא היה בבית',
    'הלקוח ביטל',
    'כתובת שגויה',
    'לא הצלחתי ליצור קשר',
    'חוסר במלאי / ציוד',
    'אין גישה / חניה',
  ],
  // ⭐ מהדוגמה של עמי עצמו: "סיפקת כיסא גלגלים ושלחו לך חגורה, והחגורה
  // לא מתאימה." אלה המקרים שבהם הגעתי, עשיתי חלק, וצריך עוד סבב.
  follow_up: [
    'הציוד שסופק לא התאים',
    'חסר חלק, צריך להזמין',
    'נדרש תיקון נוסף',
    'הלקוח ביקש להחליף',
    'נדרשת התאמה במעבדה',
    'סופק חלקית',
  ],
};

interface NotCompletedReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** שם הלקוח של העצירה — לכותרת. */
  customerName?: string;
  /** נקרא עם הסיבה כשהמשתמש מאשר. */
  onConfirm: (reason: string) => void;
  submitting?: boolean;
  /**
   * ⭐ **אותו פופאפ, שני מצבים.** רכיב שני היה מתפצל בשקט ברגע שמישהו
   * ישנה את החסימה על שדה ריק רק באחד מהם.
   */
  kind?: StopResolutionKind;
}

/**
 * פופאפ שנפתח כשנהג/טכנאי מסמן עצירה כ"לא בוצע".
 * מחייב לרשום סיבה לפני סימון. הסיבה נשמרת ל-calendar_stops.notes.
 */
export function NotCompletedReasonDialog({
  open,
  onOpenChange,
  customerName,
  onConfirm,
  submitting = false,
  kind = 'not_done',
}: NotCompletedReasonDialogProps) {
  const followUp = kind === 'follow_up';
  const [reason, setReason] = useState('');

  // איפוס הטקסט בכל פתיחה מחדש של הדיאלוג
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  const handleConfirm = () => {
    if (!canSubmit) return;
    onConfirm(trimmed);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle
            className={`flex items-center gap-2 ${followUp ? 'text-amber-800' : 'text-red-700'}`}
          >
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full ${followUp ? 'bg-amber-100' : 'bg-red-100'}`}
            >
              {followUp ? <RotateCcw className="h-4 w-4" /> : <X className="h-4 w-4" />}
            </span>
            {followUp ? 'נדרש המשך טיפול' : 'סימון כ"לא בוצע"'}
          </DialogTitle>
          <DialogDescription>
            {customerName ? `${customerName}. ` : ''}
            {followUp
              ? 'נא לרשום מה נשאר לטפל. העצירה תיסגר, והפריט יחזור לרשימת הממתינים במשרד עם ההערה שלך.'
              : 'נא לרשום מה הסיבה שהעצירה לא בוצעה.'}
          </DialogDescription>
        </DialogHeader>

        {/* סיבות מהירות */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS[kind].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className="rounded-full border border-input bg-muted/40 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-muted"
            >
              {r}
            </button>
          ))}
        </div>

        <Textarea
          autoFocus
          dir="rtl"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={followUp ? 'מה נשאר לטפל?…' : 'פרט/י את הסיבה…'}
          className="min-h-24"
          onKeyDown={(e) => {
            // Ctrl/Cmd + Enter = אישור מהיר
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleConfirm();
          }}
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            ביטול
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={
              followUp
                ? 'bg-amber-600 text-white hover:bg-amber-700'
                : 'bg-red-600 text-white hover:bg-red-700'
            }
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {/* 🔴 נתפס בצילום: הכותרת התחלפה ל"המשך טיפול" והכפתור המשיך
                לומר "סמן כלא בוצע". מי שקורא את הכפתור ולא את הכותרת היה
                חושב שהוא מדווח על אי ביצוע. */}
            {followUp ? 'שלח להמשך טיפול' : 'סמן כלא בוצע'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
