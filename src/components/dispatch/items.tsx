import { OrderDetailDialog } from '@/components/orders/OrderDetailDialog';
import { ServiceCallDetailDialog } from '@/components/service-calls/ServiceCallDetailDialog';
import { Badge } from '@/components/ui/badge';
import type { DispatchItemVM } from '@/components/dispatch/UnscheduledPanel';
import type { NewCustomer } from '@/types/customer';
import { isBareCustomer } from '@/types/customer';
import type { Order } from '@/types/order';
import type { Pickup } from '@/types/pickup';
import type { ServiceCall } from '@/types/service-call';
import { getZoneForCity } from '@/types/zone';
import { mediaBadge, MEDIA_BADGE_CLASS } from '@/lib/media-request-badge';
import type { MediaRequestState } from '@/hooks/useMediaRequests';

/**
 * המרת ארבעת סוגי העבודה ל-DispatchItemVM. הבנאים האלה נקראים גם מהרכיבים
 * העוטפים וגם מ-DispatchPage, כדי שהחיפוש והסינון המשותפים יעבדו על אותו
 * מידע בדיוק שהכרטיס מציג.
 *
 * 🔴 dragId ו-dragData חייבים להישאר כפי שהם. ה-handlers ב-DispatchPage
 * מזהים לפיהם, ואין ביניהם חוזה מטיפוס שיתפוס שינוי.
 */

/** מחרוזת חיפוש אחת מכל השדות של הרשומה, מנוקה ומוכנה ב-lowercase. */
function haystack(...parts: (string | number | null | undefined)[]): string {
  return parts
    .filter((p) => p !== null && p !== undefined && p !== '')
    .join(' ')
    .toLowerCase();
}

function joinAddress(address?: string, city?: string): string | undefined {
  const line = `${address ?? ''}${city ? `${address ? ', ' : ''}${city}` : ''}`;
  return line || undefined;
}

// ─── הזמנות ────────────────────────────────────────────────
export function buildOrderItems(
  orders: Order[],
  zoneMap: Map<string, string>,
  groupSize?: Map<string, number>
): DispatchItemVM[] {
  return orders.map((order) => ({
    id: order.id,
    dragId: `order-${order.id}`,
    dragData: { type: 'order', order },
    zoneId: zoneMap.get(order.id) || 'unassigned',
    customerName: order.customerName,
    customerNumber: order.customerNumber,
    phone: order.phone,
    addressLine: joinAddress(order.address, order.city),
    created: order.created,
    dupCount: groupSize?.get(order.id),
    searchText: haystack(
      order.customerName,
      order.customerNumber,
      order.phone,
      order.fax,
      order.address,
      order.city,
      order.healthFund,
      order.openedBy,
      order.agent,
      order.orderStatus,
      order.priorityStatus,
      order.customerStatus,
      order.customerRequestedTime,
      ...(order.items ?? []).flatMap((it) => [it.part, it.desc, it.serial])
    ),
    meta:
      order.items && order.items.length > 0 ? (
        <p
          className="mt-0.5 text-[11px] text-muted-foreground"
          title={order.items
            .map((it) => `${it.desc ?? it.part ?? ''}${it.qty && it.qty !== 1 ? ` ×${it.qty}` : ''}`)
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
  }));
}

// ─── קריאות שירות ──────────────────────────────────────────
export function buildServiceCallItems(
  calls: ServiceCall[],
  zoneMap: Map<string, string>,
  groupSize?: Map<string, number>,
  mediaStates?: Map<string, MediaRequestState>
): DispatchItemVM[] {
  return calls.map((call) => {
    const mediaState = mediaStates?.get(call.id);
    const badge = mediaState ? mediaBadge(mediaState.state) : null;
    return {
    id: call.id,
    dragId: `servicecall-${call.id}`,
    dragData: { type: 'serviceCall', call },
    zoneId: zoneMap.get(call.id) || 'unassigned',
    customerName: call.customerName,
    customerNumber: call.customerNumber,
    phone: call.phone,
    addressLine: joinAddress(call.address, call.city),
    created: call.created,
    dupCount: groupSize?.get(call.id),
    searchText: haystack(
      call.customerName,
      call.customerNumber,
      call.phone,
      call.address,
      call.city,
      call.healthFund,
      call.openedBy,
      call.serviceCallStatus,
      call.priorityStatus,
      call.customerStatus,
      call.deviceSerial,
      call.deviceName,
      call.deviceDesc,
      call.faultDesc,
      call.symptomDesc,
      call.callType,
      call.serviceType
    ),
    meta: (
      <>
        {/* חיווי "תמונה לפני טכנאי": ירוק = יש תמונה, אפשר לתאם. */}
        {badge && (
          <p className="mt-0.5">
            <span
              className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${MEDIA_BADGE_CLASS[badge.tone]}`}
              title={mediaState?.mediaReceivedAt ? `התקבלה ${new Date(mediaState.mediaReceivedAt).toLocaleString('he-IL')}` : undefined}
            >
              {badge.label}
            </span>
          </p>
        )}
        {(call.faultDesc || call.symptomDesc) && (
          <p className="mt-0.5 text-[11px] font-medium text-amber-800">
            תקלה: {call.faultDesc ?? call.symptomDesc}
            {call.faultDesc && call.symptomDesc ? ` · ${call.symptomDesc}` : ''}
          </p>
        )}
        {(call.deviceName || call.deviceSerial) && (
          <p
            className="mt-0.5 text-[11px] text-muted-foreground"
            title={call.deviceDesc ?? undefined}
          >
            מכשיר: <bdi>{call.deviceName ?? '—'}</bdi>
            {call.deviceSerial && (
              <>
                {' '}
                · סריאלי <bdi>{call.deviceSerial}</bdi>
              </>
            )}
          </p>
        )}
      </>
    ),
    renderDetail: (open, onClose) => (
      <ServiceCallDetailDialog call={call} open={open} onClose={onClose} />
    ),
    history: {
      currentId: call.id,
      customerNumber: call.customerNumber,
      customerName: call.customerName,
    },
    };
  });
}

// ─── איסופים ───────────────────────────────────────────────
export function buildPickupItems(
  pickups: Pickup[],
  onShowDetails: (pickup: Pickup) => void
): DispatchItemVM[] {
  return pickups.map((pickup) => {
    const lineCount = pickup.lines?.length ?? 0;
    return {
      id: pickup.id,
      dragId: pickup.id,
      dragData: { type: 'pickup', pickup },
      zoneId: getZoneForCity(pickup.city) || 'unassigned',
      customerName: pickup.customerName,
      customerNumber: pickup.customerNumber,
      phone: pickup.phone,
      addressLine: joinAddress(pickup.address, pickup.city),
      created: pickup.created,
      searchText: haystack(
        pickup.customerName,
        pickup.customerNumber,
        pickup.phone,
        pickup.address,
        pickup.city,
        pickup.priorityPickupId,
        pickup.priorityStatus,
        pickup.pickupStatus,
        pickup.sourceOrder,
        pickup.deliveryNote,
        pickup.reference,
        pickup.toWarehouse,
        pickup.agent,
        pickup.openedBy,
        ...(pickup.lines ?? []).flatMap((l) => [
          l.part,
          l.desc,
          l.barcode,
          l.sourceOrder,
          l.returnReason,
        ])
      ),
      meta: pickup.priorityPickupId ? (
        <p className="mt-0.5 text-[11px] text-muted-foreground" dir="ltr">
          מסמך: {pickup.priorityPickupId}
        </p>
      ) : undefined,
      footerBadges: (
        <>
          {pickup.priorityStatus && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {pickup.priorityStatus}
            </Badge>
          )}
          {lineCount > 0 && (
            <Badge variant="outline" className="h-4 px-1 text-[10px]">
              {lineCount} פריטים
            </Badge>
          )}
        </>
      ),
      onShowDetails: () => onShowDetails(pickup),
      history: {
        currentId: pickup.id,
        customerNumber: pickup.customerNumber,
        customerName: pickup.customerName,
      },
    };
  });
}

// ─── לקוחות חדשים ──────────────────────────────────────────
export function buildCustomerItems(customers: NewCustomer[]): DispatchItemVM[] {
  return customers.map((customer) => ({
    id: customer.customerNumber,
    dragId: customer.customerNumber,
    dragData: { type: 'customer', customer },
    zoneId: getZoneForCity(customer.city) || 'unassigned',
    customerName: customer.customerName,
    customerNumber: customer.customerNumber,
    phone: customer.phone,
    addressLine: joinAddress(customer.address, customer.city),
    created: customer.openedAt,
    searchText: haystack(
      customer.customerName,
      customer.customerNumber,
      customer.phone,
      customer.fax,
      customer.address,
      customer.city,
      customer.agent,
      customer.healthFund,
      customer.openedBy
    ),
    nameBadge: isBareCustomer(customer) ? (
      <span className="ms-1 inline-flex h-4 shrink-0 items-center rounded bg-violet-600 px-1 text-[10px] font-semibold text-white">
        ללא הזמנה
      </span>
    ) : undefined,
    footerBadges: (
      <>
        {customer.healthFund && (
          <Badge variant="outline" className="h-4 max-w-[140px] truncate px-1 text-[10px]">
            {customer.healthFund}
          </Badge>
        )}
        {customer.hasOrder && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
            יש הזמנה
          </Badge>
        )}
        {customer.hasServiceCall && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
            יש קריאה
          </Badge>
        )}
        {customer.hasPickup && (
          <Badge variant="secondary" className="h-4 px-1 text-[10px]">
            יש איסוף
          </Badge>
        )}
        {customer.openedBy && (
          <span className="text-[10px] text-muted-foreground">נפתח ע"י {customer.openedBy}</span>
        )}
      </>
    ),
    history: {
      currentId: customer.customerNumber,
      customerNumber: customer.customerNumber,
      customerName: customer.customerName,
    },
  }));
}
