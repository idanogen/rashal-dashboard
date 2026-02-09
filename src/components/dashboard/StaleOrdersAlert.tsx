import { useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Order } from '@/types/order';
import { getDaysSinceCreated } from '@/lib/utils';

interface StaleOrdersAlertProps {
  orders: Order[];
  onShowStale: () => void;
}

export function StaleOrdersAlert({ orders, onShowStale }: StaleOrdersAlertProps) {
  const staleCount = useMemo(() => {
    return orders.filter((o) => {
      if (o.orderStatus === 'סופק') return false;
      const days = getDaysSinceCreated(o.created);
      return days !== null && days >= 7;
    }).length;
  }, [orders]);

  if (staleCount === 0) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100">
          <AlertTriangle className="h-5 w-5 text-red-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-red-800">
            {staleCount} הזמנות ממתינות מעל 7 ימים!
          </p>
          <p className="text-xs text-red-600">יש לטפל בהן בהקדם</p>
        </div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onShowStale}
        className="shrink-0 border-red-300 text-red-700 hover:bg-red-100"
      >
        הצג
      </Button>
    </div>
  );
}
