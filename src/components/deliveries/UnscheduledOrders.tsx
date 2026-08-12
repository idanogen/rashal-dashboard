import { useMemo } from 'react';
import { Package } from 'lucide-react';

import { OrderDetailDialog } from '@/components/orders/OrderDetailDialog';
import {
  UnscheduledPanel,
  type DispatchItemVM,
  type HandledMatch,
} from '@/components/dispatch/UnscheduledPanel';
import type { Order } from '@/types/order';

interface UnscheduledOrdersProps {
  orders: Order[];
  orderCountByZone: Map<string, number>;
  orderZoneMap: Map<string, string>;
  // Selection props
  selectedOrderIds?: Set<string>;
  onToggleSelect?: (orderId: string) => void;
  /** Replace the whole selection with these IDs (or empty = clear). */
  onSelectAll?: (orderIds: string[]) => void;
  onBulkSchedule?: () => void;
  onClearSelection?: () => void;
  /** נשמר לתאימות — הכרטיס לא משתמש בזה. */
  isDragging?: boolean;
  /** הזמנות שמחכות לבחירת נהג — opacity מופחת על הכרטיס */
  pendingScheduleIds?: Set<string>;
  /** orderId → group size for "x2" badge on duplicate groups */
  groupSize?: Map<string, number>;
  /** orderIds that came back from the route (a not_completed stop exists). */
  returnedIds?: Set<string>;
  /** הזמנות שכבר טופלו (תואמה אספקה / סופק) — לחיווי "כבר משובץ" כשחיפוש ריק בממתינים. */
  handledOrders?: Order[];
}

export function UnscheduledOrders({
  orders,
  orderCountByZone,
  orderZoneMap,
  selectedOrderIds,
  onToggleSelect,
  onSelectAll,
  onBulkSchedule,
  onClearSelection,
  pendingScheduleIds,
  groupSize,
  returnedIds,
  handledOrders,
}: UnscheduledOrdersProps) {
  const items = useMemo<DispatchItemVM[]>(
    () =>
      orders.map((order) => ({
        id: order.id,
        dragId: `order-${order.id}`,
        dragData: { type: 'order', order },
        zoneId: orderZoneMap.get(order.id) || 'unassigned',
        customerName: order.customerName,
        customerNumber: order.customerNumber,
        phone: order.phone,
        addressLine: `${order.address ?? ''}${order.city ? `, ${order.city}` : ''}`.replace(
          /^, /,
          ''
        ),
        created: order.created,
        dupCount: groupSize?.get(order.id),
        searchText: [order.customerName, order.customerNumber, order.phone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase(),
        meta:
          order.items && order.items.length > 0 ? (
            <p
              className="mt-0.5 text-[11px] text-muted-foreground"
              title={order.items
                .map(
                  (it) =>
                    `${it.desc ?? it.part ?? ''}${it.qty && it.qty !== 1 ? ` ×${it.qty}` : ''}`
                )
                .join('\n')}
            >
              ציוד: <bdi>{order.items[0].desc ?? order.items[0].part}</bdi>
              {order.items[0].qty && order.items[0].qty !== 1 ? ` ×${order.items[0].qty}` : ''}
              {order.items.length > 1 && (
                <span className="font-medium"> (+{order.items.length - 1} פריטים)</span>
              )}
            </p>
          ) : undefined,
        renderDetail: (open, onClose) => (
          <OrderDetailDialog order={order} open={open} onClose={onClose} />
        ),
        history: {
          currentId: order.id,
          customerNumber: order.customerNumber,
          customerName: order.customerName,
        },
      })),
    [orders, orderZoneMap, groupSize]
  );

  const handled = useMemo<HandledMatch[]>(
    () =>
      (handledOrders ?? []).map((o) => ({
        id: o.id,
        customerName: o.customerName,
        customerNumber: o.customerNumber,
        status: o.orderStatus,
      })),
    [handledOrders]
  );

  return (
    <UnscheduledPanel
      items={items}
      title="הזמנות ממתינות לתיאום"
      Icon={Package}
      accentBorder="border-s-blue-500"
      noun={{ one: 'הזמנה', many: 'הזמנות' }}
      emptyText="אין הזמנות ממתינות לתיאום"
      searchPlaceholder="חיפוש: שם / מספר לקוח / טלפון"
      storageKey="orders"
      countByZone={orderCountByZone}
      selectedIds={selectedOrderIds}
      onToggleSelect={onToggleSelect}
      onSelectAll={onSelectAll}
      onClearSelection={onClearSelection}
      onBulkSchedule={onBulkSchedule}
      pendingScheduleIds={pendingScheduleIds}
      returnedIds={returnedIds}
      handled={handled}
    />
  );
}
