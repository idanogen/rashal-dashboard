import { useState } from 'react';
import { IdCard } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { CustomerCard } from '@/components/customer/CustomerCard';

/**
 * אותו כרטיס בדיוק, במגירה.
 *
 * ⭐ **אותו רכיב ולא עותק שני.** לחיצה על שם לקוח בכל רשימה במערכת
 * פותחת את הכרטיס בלי לעזוב את המסך שעליו עובדים.
 *
 * 🔴 **הכרטיס נטען רק כשהמגירה נפתחת.** רכיב שמתחיל שאילתה בזמן ציור
 * היה מריץ אותה על כל שורה בכל רשימה. [[render_must_not_start_work]]
 */
export function CustomerCardSheet({
  open, onOpenChange, customerNumber, phone, title,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  customerNumber: string | null;
  phone: string | null;
  title?: string | null;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle className="text-start">{title || 'כרטיס לקוח'}</SheetTitle>
        </SheetHeader>
        <div className="mt-3">
          {open && <CustomerCard customerNumber={customerNumber} phone={phone} layout="drawer" />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * הכפתור שפותח את הכרטיס מכל רשימה.
 *
 * 🔴 **נושא כיתוב ולא רק אייקון.** עידן, 25/08/2026: "הכפתור של הכרטיס
 * קטן מידי ולא מובן מספיק." אייקון בלבד מבקש מהמשתמש לנחש, ובמסך עמוס
 * הוא פשוט לא נראה. אייקון עם מילה נקרא בלי לעצור.
 *
 * ⭐ `compact` לשורות צפופות (מסך הסדרן), שם "כרטיס" מספיק.
 */
export function CustomerCardButton({
  customerNumber, phone, name, className, compact = false,
}: {
  customerNumber?: string | null;
  phone?: string | null;
  name?: string | null;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (!customerNumber && !phone) return null;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="כל ההיסטוריה של הלקוח: מה יש אצלו, מה פתוח, ומה היה"
        className={`inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 ${
          compact ? 'px-1.5 py-0.5 text-[10.5px]' : 'px-2 py-1 text-[11.5px]'
        } ${className ?? ''}`}
      >
        <IdCard className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        {compact ? 'כרטיס' : 'כרטיס לקוח'}
      </button>
      <CustomerCardSheet
        open={open}
        onOpenChange={setOpen}
        customerNumber={customerNumber ?? null}
        phone={phone ?? null}
        title={name ?? null}
      />
    </>
  );
}
