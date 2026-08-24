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
          {open && <CustomerCard customerNumber={customerNumber} phone={phone} />}
        </div>
      </SheetContent>
    </Sheet>
  );
}

/**
 * כפתור קטן שנצמד לשם לקוח בכל רשימה.
 */
export function CustomerCardButton({
  customerNumber, phone, name, className,
}: {
  customerNumber?: string | null;
  phone?: string | null;
  name?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  if (!customerNumber && !phone) return null;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="פתח כרטיס לקוח"
        className={`inline-flex items-center rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 ${className ?? ''}`}
      >
        <IdCard className="h-3.5 w-3.5" />
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
