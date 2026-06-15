import { useState } from 'react';
import { Undo2, MapPin } from 'lucide-react';
import type { Order } from '@/types/order';
import { OrderChatButton } from '@/components/OrderChatButton';
import { OrderDetailDialog } from '@/components/orders/OrderDetailDialog';

interface ReturnedFromRouteSectionProps {
  /** Orders that came back from the route (a not_completed stop exists). */
  orders: Order[];
}

/**
 * Highlighted "returned from route" banner for the dashboard — orders that were
 * marked "לא בוצע" and bounced back to pending. Clicking a card opens its detail.
 */
export function ReturnedFromRouteSection({ orders }: ReturnedFromRouteSectionProps) {
  const [selected, setSelected] = useState<Order | null>(null);

  if (orders.length === 0) return null;

  return (
    <div className="rounded-lg border border-red-300 bg-red-50/60 p-3 shadow-sm dark:border-red-900 dark:bg-red-950/10">
      <div className="mb-2 flex items-center gap-2">
        <Undo2 className="h-4 w-4 text-red-600" />
        <h3 className="text-sm font-bold text-red-700 dark:text-red-400">
          חזרו מהקו ({orders.length})
        </h3>
        <span className="text-[11px] text-red-600/70">
          סומנו "לא בוצע" — ממתינות לשיבוץ מחדש
        </span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => (
          <div
            key={order.id}
            onClick={() => setSelected(order)}
            className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-red-200 bg-background/80 p-2 transition-colors hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-950/20"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{order.customerName}</p>
              {(order.address || order.city) && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                  <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                  <span className="truncate">
                    {order.address}
                    {order.address && order.city ? ', ' : ''}
                    {order.city}
                  </span>
                </p>
              )}
            </div>
            <div onClick={(e) => e.stopPropagation()}>
              <OrderChatButton order={order} />
            </div>
          </div>
        ))}
      </div>

      <OrderDetailDialog
        order={selected}
        open={!!selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
