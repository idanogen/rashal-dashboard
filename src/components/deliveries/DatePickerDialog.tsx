import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CalendarDays, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

// פורמט תאריך מקומי (לא UTC) למניעת באגי timezone
const toLocalDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface DatePickerDialogProps {
  open: boolean;
  onClose: () => void;
  onDateSelected: (date: string) => void;
  orderCount: number;
}

export function DatePickerDialog({
  open,
  onClose,
  onDateSelected,
  orderCount,
}: DatePickerDialogProps) {
  // ברירת מחדל: מחר (אם לא שישי/שבת, אחרת ראשון הבא)
  const defaultDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    while (d.getDay() === 5 || d.getDay() === 6) {
      d.setDate(d.getDate() + 1);
    }
    return toLocalDateStr(d);
  }, []);

  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  const todayStr = useMemo(() => toLocalDateStr(new Date()), []);

  const selectedDateObj = useMemo(
    () => (selectedDate ? new Date(selectedDate + 'T00:00:00') : null),
    [selectedDate]
  );

  const isWeekend =
    selectedDateObj &&
    (selectedDateObj.getDay() === 5 || selectedDateObj.getDay() === 6);
  const isPast = selectedDate < todayStr;
  const isValid = !!selectedDate && !isWeekend && !isPast;

  const handleConfirm = () => {
    if (!selectedDate) return;
    if (isWeekend) {
      toast.error('לא ניתן לתזמן ליום שישי או שבת');
      return;
    }
    if (isPast) {
      toast.error('לא ניתן לתזמן לתאריך בעבר');
      return;
    }
    onDateSelected(selectedDate);
  };

  const handleClose = () => {
    setSelectedDate(defaultDate);
    onClose();
  };

  const formattedDate = selectedDateObj
    ? selectedDateObj.toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            תזמון משלוח
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border bg-primary/5 p-3">
            <p className="text-sm">
              <span className="font-bold text-primary">{orderCount}</span>{' '}
              {orderCount === 1 ? 'הזמנה נבחרה' : 'הזמנות נבחרו'} לתיזמון
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium" htmlFor="delivery-date">
              בחר תאריך משלוח
            </label>
            <input
              id="delivery-date"
              type="date"
              value={selectedDate}
              min={todayStr}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
              dir="ltr"
            />
            {selectedDate && formattedDate && (
              <p className="text-sm text-muted-foreground">{formattedDate}</p>
            )}
            {isWeekend && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                לא ניתן לתזמן ליום שישי או שבת
              </div>
            )}
            {isPast && !isWeekend && (
              <div className="flex items-center gap-1.5 text-xs text-destructive">
                <AlertCircle className="h-3.5 w-3.5" />
                לא ניתן לתזמן לתאריך בעבר
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={handleClose}>
            ביטול
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid}>
            המשך לבניית מסלול
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
