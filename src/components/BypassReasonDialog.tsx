import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { AlertTriangle, MessageCircleWarning } from 'lucide-react';
import type { CalendarStop } from '@/types/calendar-stop';

/**
 * הסיבות. סדר החשיבות כאן הוא לא אקראי: השתיים הראשונות הן סטיות לגיטימיות
 * שנהג טוב עושה, והן מופיעות ראשונות כדי שהמסך לא ירגיש כמו האשמה. בלי זה
 * הנהג ילמד לבחור את הסיבה הראשונה שהיא "בטוחה" והנתונים ייהרסו.
 */
const REASONS = [
  'הלקוח ביקש שעה אחרת',
  'אני כבר באזור, יעיל יותר',
  'הלקוח לא עונה, אחזור אחר כך',
  'פקק או כביש חסום',
  'אין חניה או גישה כרגע',
];

interface BypassReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** העצירה שהנהג רוצה לעבור אליה. */
  target: CalendarStop | null;
  /** העצירות שייעקפו. */
  bypassed: CalendarStop[];
  submitting?: boolean;
  onConfirm: (reason: string) => void;
}

export function BypassReasonDialog({
  open, onOpenChange, target, bypassed, submitting, onConfirm,
}: BypassReasonDialogProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [other, setOther] = useState('');

  const reason = selected === 'אחר' ? other.trim() : selected;
  const canConfirm = !!reason;

  const handleConfirm = () => {
    if (!reason) return;
    onConfirm(reason);
    setSelected(null);
    setOther('');
  };

  const count = bypassed.length;

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader className="text-start">
          <DialogTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            מעבר מחוץ לסדר
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="text-amber-900">
              אתה עובר אל <span className="font-bold">{target?.customerName}</span>.
            </p>
            <p className="mt-1 text-amber-800">
              {count === 1 ? 'עצירה אחת תיעקף' : `${count} עצירות ייעקפו`}:{' '}
              {bypassed.map((s) => s.customerName).join(' · ')}
            </p>
            <p className="mt-2 flex items-start gap-1.5 text-xs font-semibold text-amber-900">
              <MessageCircleWarning className="mt-px h-3.5 w-3.5 shrink-0" />
              תישלח הודעה לעמי עם פרטי הלקוחות שנעקפו
            </p>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-slate-800">מה הסיבה?</p>
            <div className="space-y-1.5">
              {[...REASONS, 'אחר'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setSelected(r)}
                  className={cn(
                    'w-full rounded-lg border px-3 py-2.5 text-start text-sm transition-colors',
                    selected === r
                      ? 'border-slate-900 bg-slate-900 font-semibold text-white'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  )}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {selected === 'אחר' && (
            <Textarea
              autoFocus
              value={other}
              onChange={(e) => setOther(e.target.value)}
              placeholder="פרט את הסיבה"
              rows={2}
              className="text-start"
            />
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="h-11 flex-1"
          >
            ביטול
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canConfirm || submitting}
            className="h-11 flex-1 bg-amber-600 hover:bg-amber-700"
          >
            {submitting ? 'רושם...' : 'עבור בכל זאת'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
