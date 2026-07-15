import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ASSIGNEES, type AssigneeName } from '@/types/route';
import { Truck, Package } from 'lucide-react';

interface DriverSelectorProps {
  open: boolean;
  onClose: () => void;
  onSelectDriver: (driver: AssigneeName) => void;
  orderInfo?: string;
  customerName?: string;
  /** רשימת המשובצים להצגה — ברירת מחדל: נהגי חלוקה. למסך שירות יועברו טכנאים. */
  assignees?: AssigneeName[];
  /** כותרת הדיאלוג — ברירת מחדל "בחר נהג למשלוח". */
  title?: string;
}

export function DriverSelector({
  open,
  onClose,
  onSelectDriver,
  orderInfo,
  customerName,
  assignees = ASSIGNEES,
  title = 'בחר עובד',
}: DriverSelectorProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-base">{title}</DialogTitle>
        </DialogHeader>

        {orderInfo && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">{orderInfo}</div>
              {customerName && (
                <div className="truncate text-xs text-muted-foreground">
                  {customerName}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 py-2">
          {assignees.map((name) => (
            <button
              key={name}
              className="group relative flex h-24 flex-col items-center justify-center gap-2.5 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 transition-all duration-200 hover:shadow-md hover:ring-2 hover:ring-primary/30 active:scale-[0.97]"
              onClick={() => onSelectDriver(name)}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background/80 text-primary shadow-sm transition-transform group-hover:scale-110">
                <Truck className="h-5 w-5" />
              </div>
              <span className="text-sm font-medium">{name}</span>
            </button>
          ))}
        </div>

        <Button
          variant="ghost"
          onClick={onClose}
          className="w-full text-muted-foreground hover:text-foreground"
        >
          ביטול
        </Button>
      </DialogContent>
    </Dialog>
  );
}
