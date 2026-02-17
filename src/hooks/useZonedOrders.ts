import { useMemo } from 'react';
import { useOrders } from './useOrders';
import { getZoneForCity, ZONES } from '@/types/zone';
import type { Order } from '@/types/order';

export interface ZonedOrdersResult {
  /** כל ההזמנות (ללא שינוי) */
  allOrders: Order[];
  /** הזמנות ממתינות לתיאום עם כתובת ועיר */
  unscheduledOrders: Order[];
  /** הזמנות שתואמה אספקה */
  scheduledOrders: Order[];
  /** הזמנות שסופקו */
  deliveredOrders: Order[];
  /** כמות הזמנות ממתינות לכל אזור */
  orderCountByZone: Map<string, number>;
  /** מיפוי orderId → zoneId */
  orderZoneMap: Map<string, string>;
  /** קבל אזור של הזמנה */
  getOrderZone: (orderId: string) => string | undefined;
  isLoading: boolean;
  error: Error | null;
}

export function useZonedOrders(): ZonedOrdersResult {
  const { data: orders, isLoading, error } = useOrders();

  const result = useMemo(() => {
    const allOrders = orders ?? [];

    // מיפוי כל הזמנה לאזור
    const orderZoneMap = new Map<string, string>();
    for (const order of allOrders) {
      const zoneId = getZoneForCity(order.city);
      if (zoneId) {
        orderZoneMap.set(order.id, zoneId);
      }
    }

    // סינון לפי סטטוס
    const unscheduledOrders = allOrders.filter(
      (o) =>
        o.orderStatus === 'ממתין לתאום' &&
        o.address &&
        o.city
    );

    const scheduledOrders = allOrders.filter(
      (o) => o.orderStatus === 'תואמה אספקה '
    );

    const deliveredOrders = allOrders.filter(
      (o) => o.orderStatus === 'סופק'
    );

    // ספירת הזמנות ממתינות לכל אזור
    const orderCountByZone = new Map<string, number>();
    // אתחול כל האזורים ל-0
    for (const zone of ZONES) {
      orderCountByZone.set(zone.id, 0);
    }
    // ספירה
    for (const order of unscheduledOrders) {
      const zoneId = orderZoneMap.get(order.id);
      if (zoneId) {
        orderCountByZone.set(zoneId, (orderCountByZone.get(zoneId) ?? 0) + 1);
      }
    }

    const getOrderZone = (orderId: string) => orderZoneMap.get(orderId);

    return {
      allOrders,
      unscheduledOrders,
      scheduledOrders,
      deliveredOrders,
      orderCountByZone,
      orderZoneMap,
      getOrderZone,
    };
  }, [orders]);

  return {
    ...result,
    isLoading,
    error: error as Error | null,
  };
}
