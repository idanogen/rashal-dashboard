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
import { AlertTriangle, Loader2 } from 'lucide-react';

interface DoubleConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** שם הפריט (לקוח) — מוצג בהודעה. */
  itemName?: string;
  /** טקסט שלב ראשון. */
  message?: string;
  /** תווית כפתור האישור הסופי. */
  confirmLabel?: string;
  submitting?: boolean;
  onConfirm: () => void;
}

/**
 * אישור כפול — שני שלבים לפני פעולה הרסנית (ביטול).
 * שלב 1: שאלה רגילה. שלב 2: אזהרה מודגשת "האם אתה בטוח???".
 * רק אישור בשלב 2 מפעיל את onConfirm.
 */
export function DoubleConfirmDialog({
  open,
  onOpenChange,
  itemName,
  message = 'האם לבטל את הפריט? הוא יסומן כבוטל.',
  confirmLabel = 'כן, בטל סופית',
  submitting = false,
  onConfirm,
}: DoubleConfirmDialogProps) {
  const [stage, setStage] = useState<1 | 2>(1);

  // איפוס לשלב 1 בכל פתיחה מחדש.
  useEffect(() => {
    if (open) setStage(1);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        {stage === 1 ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <AlertTriangle className="h-5 w-5" />
                ביטול
              </DialogTitle>
              <DialogDescription>
                {itemName ? `${itemName} — ` : ''}{message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                חזור
              </Button>
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => setStage(2)}
              >
                המשך לביטול
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center justify-center gap-2 text-center text-xl text-red-700">
                <AlertTriangle className="h-6 w-6" />
                האם אתה בטוח???
              </DialogTitle>
              <DialogDescription className="text-center">
                פעולה זו אינה הפיכה. {itemName ? `"${itemName}" ` : 'הפריט '}יסומן כבוטל.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                לא, חזור
              </Button>
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={onConfirm}
                disabled={submitting}
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {confirmLabel}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
