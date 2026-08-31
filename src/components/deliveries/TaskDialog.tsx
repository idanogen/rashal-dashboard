import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type AssigneeName } from '@/types/route';
import { useAssignees } from '@/hooks/useAssignees';
import { useFieldSuggestions } from '@/hooks/useFieldSuggestions';
import { SuggestInput } from '@/components/SuggestInput';
import { ClipboardList } from 'lucide-react';

/** פרטים שממלאים את הטופס מראש — שיבוץ יזום מתוך חיפוש שנתקע. */
export interface TaskPrefill {
  customerName?: string;
  customerNumber?: string;
  address?: string;
  city?: string;
  phone?: string;
  notes?: string;
}

interface TaskDialogProps {
  open: boolean;
  onClose: () => void;
  /** תאריך קבוע מהיומן. כש-`dateEditable` דולק הוא רק ברירת המחדל. */
  date: string | null;
  /**
   * ⭐ שדה תאריך בתוך הדיאלוג. נולד מהתלונה של עמי (31/08/2026): לקוח
   * שכבר טופל בעבר צריך ביקור חדש, ואין לו שום רשומה ממתינה לגרור ליומן.
   * מהחיפוש אין תא-יום ללחוץ עליו, ולכן התאריך נבחר כאן.
   */
  dateEditable?: boolean;
  /** כותרת חלופית — ברירת המחדל "משימה חדשה". */
  title?: string;
  initial?: TaskPrefill;
  /** רשימת המשובצים. ברירת המחדל היא כל הצוות הפעיל מטבלת `assignees`. */
  assignees?: AssigneeName[];
  /** תווית השדה — ברירת מחדל "נהג". */
  assigneeLabel?: string;
  onSubmit: (data: {
    date: string;
    driver: AssigneeName;
    customerName: string;
    customerNumber?: string;
    address?: string;
    city?: string;
    phone?: string;
    notes?: string;
  }) => void;
}

/** מחר, ואם מחר שישי/שבת — יום ראשון. חישוב מקומי, לא UTC. */
function nextWorkday(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 5 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TaskDialog({
  open,
  onClose,
  date,
  dateEditable = false,
  title,
  initial,
  assignees: assigneesProp,
  assigneeLabel = 'עובד',
  onSubmit,
}: TaskDialogProps) {
  const team = useAssignees();
  const assignees = assigneesProp ?? team.assignable;
  // ⭐ מה שכבר נרשם במערכת מוצע כאן. ראה `lib/suggestions.ts` להסבר למה
  // ה"זיכרון" שהיה פעם נעלם: הוא היה של הדפדפן, לא שלנו.
  const suggest = useFieldSuggestions();
  // "סוג כיסא" ושאר התיאורים החוזרים יושבים בשני מקומות: הערות של משימות
  // קודמות, ושמות המכשירים מקריאות השירות.
  const noteOptions = useMemo(
    () => [...suggest.notes, ...suggest.devices],
    [suggest.notes, suggest.devices],
  );
  const [driver, setDriver] = useState<AssigneeName>('');
  // 🔴 **נגזר ולא אפקט.** הרשימה מגיעה מהשרת ועשויה להגיע אחרי הפתיחה;
  // setState בתוך אפקט היה מייצר רינדור נוסף על כל פתיחה, וזה בדיוק סוג
  // הקוד שהפיל כאן פעם את המיקוד בשדה.
  const selected = driver || assignees[0] || '';
  const [customerName, setCustomerName] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [pickedDate, setPickedDate] = useState('');

  useEffect(() => {
    if (open) {
      setDriver('');
      setCustomerName(initial?.customerName ?? '');
      setAddress(initial?.address ?? '');
      setCity(initial?.city ?? '');
      setPhone(initial?.phone ?? '');
      setNotes(initial?.notes ?? '');
      setPickedDate(date ?? nextWorkday());
    }
    // הפרטים נלכדים ברגע הפתיחה בכוונה: שינוי אובייקט ה-initial תוך כדי
    // הקלדה לא אמור לדרוס את מה שהמשתמש כבר תיקן.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const effectiveDate = dateEditable ? pickedDate : (date ?? '');

  const handleSubmit = () => {
    if (!customerName.trim() || !selected || !effectiveDate) return;
    onSubmit({
      date: effectiveDate,
      driver: selected,
      customerName: customerName.trim(),
      customerNumber: initial?.customerNumber,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      phone: phone.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const dateLabel = !dateEditable && date
    ? new Date(date + 'T00:00:00').toLocaleDateString('he-IL', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
      })
    : '';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-amber-600" />
            {title ?? `משימה חדשה ל${assigneeLabel}`}
          </DialogTitle>
          {dateLabel && (
            <p className="text-xs text-muted-foreground">{dateLabel}</p>
          )}
        </DialogHeader>

        <div className="space-y-3 py-2">
          {dateEditable && (
            <div className="space-y-1.5">
              <Label htmlFor="task-date" className="text-xs">
                תאריך *
              </Label>
              <Input
                id="task-date"
                type="date"
                value={pickedDate}
                onChange={(e) => setPickedDate(e.target.value)}
                dir="ltr"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="task-driver" className="text-xs">
              {assigneeLabel}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {assignees.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDriver(d)}
                  className={`rounded-lg border px-3 py-2 text-sm transition-all ${
                    selected === d
                      ? 'border-primary bg-primary/10 font-semibold'
                      : 'hover:bg-muted'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-customer" className="text-xs">
              שם הלקוח / תיאור המשימה *
            </Label>
            <SuggestInput
              id="task-customer"
              value={customerName}
              onChange={setCustomerName}
              options={suggest.customers}
              placeholder="לדוגמה: איסוף ציוד מהספק"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="task-city" className="text-xs">
                עיר
              </Label>
              <SuggestInput
                id="task-city"
                value={city}
                onChange={setCity}
                options={suggest.cities}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-phone" className="text-xs">
                טלפון
              </Label>
              <Input
                id="task-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-address" className="text-xs">
              כתובת
            </Label>
            <SuggestInput
              id="task-address"
              value={address}
              onChange={setAddress}
              options={suggest.addresses}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-notes" className="text-xs">
              הערות
            </Label>
            <SuggestInput
              id="task-notes"
              value={notes}
              onChange={setNotes}
              options={noteOptions}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={!customerName.trim() || !effectiveDate}>
            הוסף ליומן
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
