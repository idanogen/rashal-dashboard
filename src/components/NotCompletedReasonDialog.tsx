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
import { Loader2, X } from 'lucide-react';

/** סיבות מהירות נפוצות — לחיצה ממלאת את שדה הטקסט. */
const QUICK_REASONS = [
  'הלקוח לא היה בבית',
  'הלקוח ביטל',
  'כתובת שגויה',
  'לא הצלחתי ליצור קשר',
  'חוסר במלאי / ציוד',
  'אין גישה / חניה',
] as const;

interface NotCompletedReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** שם הלקוח של העצירה — לכותרת. */
  customerName?: string;
  /** נקרא עם הסיבה כשהמשתמש מאשר. */
  onConfirm: (reason: string) => void;
  submitting?: boolean;
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
}: NotCompletedReasonDialogProps) {
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
          <DialogTitle className="flex items-center gap-2 text-red-700">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100">
              <X className="h-4 w-4" />
            </span>
            סימון כ"לא בוצע"
          </DialogTitle>
          <DialogDescription>
            {customerName ? `${customerName} — ` : ''}נא לרשום מה הסיבה שהעצירה לא בוצעה.
          </DialogDescription>
        </DialogHeader>

        {/* סיבות מהירות */}
        <div className="flex flex-wrap gap-1.5">
          {QUICK_REASONS.map((r) => (
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
          placeholder="פרט/י את הסיבה…"
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
            className="bg-red-600 text-white hover:bg-red-700"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            סמן כלא בוצע
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
