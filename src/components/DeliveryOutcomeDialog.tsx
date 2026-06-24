import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PackageCheck, GraduationCap, Ban } from 'lucide-react';

/** תוצאות אספקה אפשריות — חובה לבחור אחת לפני סימון "סופק" (משלוחים בלבד). */
export const DELIVERY_OUTCOMES = ['בוצע השבה', 'בוצע הדרכה', 'אין צורך'] as const;
export type DeliveryOutcome = (typeof DELIVERY_OUTCOMES)[number];

const OPTION_CONFIG: Record<
  DeliveryOutcome,
  { Icon: typeof PackageCheck; className: string }
> = {
  'בוצע השבה': {
    Icon: PackageCheck,
    className: 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100',
  },
  'בוצע הדרכה': {
    Icon: GraduationCap,
    className: 'border-violet-200 bg-violet-50 text-violet-700 hover:bg-violet-100',
  },
  'אין צורך': {
    Icon: Ban,
    className: 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
  },
};

interface DeliveryOutcomeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerName?: string;
  submitting?: boolean;
  /** נקרא עם הבחירה — מסמן את המשלוח כסופק. */
  onSelect: (outcome: DeliveryOutcome) => void;
}

/**
 * נפתח כשנהג מסמן משלוח כ"סופק". חובה לבחור תוצאה אחת מ-3 —
 * בלי בחירה אי אפשר להשלים. הבחירה נשמרת ל-notes + ללוג הפעולות.
 */
export function DeliveryOutcomeDialog({
  open,
  onOpenChange,
  customerName,
  submitting = false,
  onSelect,
}: DeliveryOutcomeDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-emerald-700">סימון משלוח כסופק</DialogTitle>
          <DialogDescription>
            {customerName ? `${customerName} — ` : ''}מה בוצע באספקה? יש לבחור כדי להשלים.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2.5 pt-1">
          {DELIVERY_OUTCOMES.map((outcome) => {
            const { Icon, className } = OPTION_CONFIG[outcome];
            return (
              <button
                key={outcome}
                type="button"
                disabled={submitting}
                onClick={() => onSelect(outcome)}
                className={`flex h-14 items-center gap-3 rounded-lg border px-4 text-base font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${className}`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {outcome}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
