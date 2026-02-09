import { useMemo } from 'react';
import type { Order } from '@/types/order';
import { getDaysSinceCreated } from '@/lib/utils';

export interface CoordinationRecommendation {
  city: string;
  orders: Order[];
  totalCount: number;
  oldCount: number; // orders 7+ days old
  oldestDays: number;
  score: number;
}

const WAITING_STATUS = 'ממתין לתאום';
const OLD_THRESHOLD_DAYS = 7;
const MIN_ORDERS_PER_CITY = 2;
const MAX_RECOMMENDATIONS = 3;

/**
 * Hook להמלצות על הזמנות לתיאום מחר.
 * מסנן רק הזמנות בסטטוס "ממתין לתאום", מקבץ לפי עיר,
 * ומחשב ניקוד לפי הזמנות ותיקות וריכוז גיאוגרפי.
 */
export function useTomorrowCoordinationRecommendations(orders: Order[]): CoordinationRecommendation[] {
  return useMemo(() => {
    // Filter ONLY "waiting for coordination" orders with address
    const waiting = orders.filter(
      (o) => o.orderStatus === WAITING_STATUS && o.address && o.city
    );

    // Group by city
    const cityMap = new Map<string, Order[]>();
    for (const order of waiting) {
      const city = order.city!;
      if (!cityMap.has(city)) cityMap.set(city, []);
      cityMap.get(city)!.push(order);
    }

    // Build recommendations
    const recommendations: CoordinationRecommendation[] = [];

    for (const [city, cityOrders] of cityMap) {
      if (cityOrders.length < MIN_ORDERS_PER_CITY) continue;

      let oldCount = 0;
      let oldestDays = 0;

      for (const order of cityOrders) {
        const days = getDaysSinceCreated(order.created);
        if (days !== null) {
          if (days >= OLD_THRESHOLD_DAYS) oldCount++;
          if (days > oldestDays) oldestDays = days;
        }
      }

      // Score: prioritize cities with old orders and high density
      // Same formula as useRouteRecommendations
      const score = oldCount * 3 + cityOrders.length * 1 + oldestDays * 0.5;

      recommendations.push({
        city,
        orders: cityOrders,
        totalCount: cityOrders.length,
        oldCount,
        oldestDays,
        score,
      });
    }

    // Sort by score descending, return top N
    return recommendations
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RECOMMENDATIONS);
  }, [orders]);
}
