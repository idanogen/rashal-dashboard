import { Archive, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { archiveOrderManually, restoreArchivedOrder } from '@/lib/orders-archive';
import type { Order } from '@/types/order';

/**
 * "העבר לארכיון" ידני על הזמנה שמחכה לתיאום (פגישה 17/11: "אני קיבלתי החלטה כמנהל,
 * אני מעיף את זה לארכיון"). הפיך: הודעת האישור נותנת "בטל", והמסך /calls-archive?tab=orders מחזיר.
 */
export function OrderArchiveButton({ order, onDone }: { order: Order; onDone: () => void }) {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['orders'] });
    qc.invalidateQueries({ queryKey: ['ordersArchive'] });
  };
  const undo = () =>
    restoreArchivedOrder(order.id).then(
      () => { refresh(); toast.success('ההזמנה חזרה לרשימה'); },
      (e) => toast.error('לא הוחזרה', { description: e instanceof Error ? e.message : undefined }),
    );
  const archive = useMutation({
    mutationFn: () => archiveOrderManually(order.id),
    onSuccess: () => {
      refresh();
      onDone();
      toast.success(`${order.priorityOrderId ?? order.customerName} עברה לארכיון`, {
        action: { label: 'בטל', onClick: () => void undo() },
      });
    },
    onError: (e) => toast.error('ההזמנה לא עברה לארכיון', { description: e instanceof Error ? e.message : undefined }),
  });

  if ((order.orderStatus ?? 'ממתין לתאום') !== 'ממתין לתאום') return null;

  return (
    <div className="flex justify-end border-t pt-3">
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => archive.mutate()} disabled={archive.isPending}>
        {archive.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
        העבר לארכיון
      </Button>
    </div>
  );
}
