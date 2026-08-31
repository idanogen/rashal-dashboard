import { useMemo } from 'react';
import { Package } from 'lucide-react';

import { buildOrderItems } from '@/components/dispatch/items';
import {
  UnscheduledPanel,
  type HandledMatch,
  type VisitPrefill,
} from '@/components/dispatch/UnscheduledPanel';
import type { Order } from '@/types/order';
import type { ReturnedInfo } from '@/lib/returned-from-route';

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
  /** ישות ⟵ הסיבה שהנהג רשם. עובר יחד עם returnedIds ולא בנפרד. */
  returnedInfo?: Map<string, ReturnedInfo>;
  /** הזמנות שכבר טופלו (תואמה אספקה / סופק) — לחיווי "כבר משובץ" כשחיפוש ריק בממתינים. */
  handledOrders?: Order[];
  /** מזהה הזמנה ⟵ "משובץ ל-01/09 · רודי", כשקיימת עצירה פעילה ביומן. */
  handledStopLines?: Map<string, string>;
  /** שיבוץ יזום מהמבוי הסתום של החיפוש — ראה UnscheduledPanel. */
  onScheduleVisit?: (prefill: VisitPrefill) => void;
  /** חיפוש ואזורים משותפים למסך הסדרן. כשמועברים, הפאנל לא מצייר אותם בעצמו. */
  search?: string;
  selectedZones?: string[];
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
  returnedInfo,
  handledOrders,
  handledStopLines,
  onScheduleVisit,
  search,
  selectedZones,
}: UnscheduledOrdersProps) {
  const items = useMemo(
    () => buildOrderItems(orders, orderZoneMap, groupSize),
    [orders, orderZoneMap, groupSize]
  );

  const handled = useMemo<HandledMatch[]>(
    () =>
      (handledOrders ?? []).map((o) => ({
        id: o.id,
        customerName: o.customerName,
        customerNumber: o.customerNumber,
        status: o.orderStatus,
        phone: o.phone,
        address: o.address,
        city: o.city,
        scheduledLine: handledStopLines?.get(o.id),
      })),
    [handledOrders, handledStopLines]
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
      returnedInfo={returnedInfo}
      handled={handled}
      onScheduleVisit={onScheduleVisit}
      search={search}
      selectedZones={selectedZones}
    />
  );
}
