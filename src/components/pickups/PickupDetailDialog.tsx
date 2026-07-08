import type { Pickup } from '@/types/pickup';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Undo2, Package, MapPin, Phone, Warehouse, FileText } from 'lucide-react';

interface PickupDetailDialogProps {
  pickup: Pickup | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value, ltr }: { label: string; value?: string | number | null; ltr?: boolean }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium" dir={ltr ? 'ltr' : undefined}>
        {value}
      </span>
    </div>
  );
}

export function PickupDetailDialog({ pickup, open, onOpenChange }: PickupDetailDialogProps) {
  if (!pickup) return null;
  const lines = pickup.lines ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2 className="h-5 w-5 text-teal-600" />
            איסוף — {pickup.customerName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="מספר מסמך" value={pickup.priorityPickupId} ltr />
            <Field label="סטטוס פריוריטי" value={pickup.priorityStatus} />
            <Field label="מספר לקוח" value={pickup.customerNumber} ltr />
            <Field label="תאריך" value={pickup.pickupDate?.slice(0, 10)} ltr />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg bg-muted/40 p-3 text-sm">
            {pickup.address && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                {pickup.address}
                {pickup.city ? `, ${pickup.city}` : ''}
              </span>
            )}
            {pickup.phone && (
              <span className="flex items-center gap-1.5" dir="ltr">
                <Phone className="h-4 w-4 text-muted-foreground" />
                {pickup.phone}
              </span>
            )}
            {pickup.toWarehouse && (
              <span className="flex items-center gap-1.5">
                <Warehouse className="h-4 w-4 text-muted-foreground" />
                {pickup.toWarehouse}
              </span>
            )}
          </div>

          {(pickup.sourceOrder || pickup.deliveryNote || pickup.reference) && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <FileText className="h-4 w-4" />
              {pickup.sourceOrder && <span dir="ltr">הזמנה {pickup.sourceOrder}</span>}
              {pickup.deliveryNote && <span dir="ltr">· ת.משלוח {pickup.deliveryNote}</span>}
              {pickup.reference && <span dir="ltr">· אסמכתא {pickup.reference}</span>}
            </div>
          )}

          <div>
            <div className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Package className="h-4 w-4 text-teal-600" />
              פריטים לאיסוף
              <Badge variant="secondary" className="h-5 px-1.5 text-xs">{lines.length}</Badge>
            </div>
            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">אין שורות פריטים</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                      <th className="p-2 text-start font-medium">מק"ט</th>
                      <th className="p-2 text-start font-medium">תיאור</th>
                      <th className="p-2 text-start font-medium">כמות</th>
                      <th className="p-2 text-start font-medium">סיבת החזרה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={l.trans ?? i} className="border-b last:border-0">
                        <td className="p-2 font-mono text-xs" dir="ltr">{l.part ?? '—'}</td>
                        <td className="p-2">{l.desc ?? '—'}</td>
                        <td className="p-2 tabular-nums">
                          {l.qty ?? '—'}
                          {l.unit ? ` ${l.unit}` : ''}
                        </td>
                        <td className="p-2 text-muted-foreground">{l.returnReason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
