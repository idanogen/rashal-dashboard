import { useMemo } from 'react';
import type { Order } from '@/types/order';
import { getDaysSinceCreated } from '@/lib/utils';

export interface RouteRecommendation {
  city: string;
  orders: Order[];
  totalCount: number;
  oldCount: number; // orders 7+ days old
  oldestDays: number;
  score: number;
}

const PENDING_STATUSES = ['ממתין לתאום', 'תואמה אספקה '];
const OLD_THRESHOLD_DAYS = 7;
const MIN_ORDERS_PER_CITY = 2;
const MAX_RECOMMENDATIONS = 3;

export function useRouteRecommendations(orders: Order[]): RouteRecommendation[] {
  return useMemo(() => {
    // Filter pending orders that have an address
    const pending = orders.filter(
      (o) =>
        o.orderStatus &&
        PENDING_STATUSES.includes(o.orderStatus) &&
        o.address &&
        o.city
    );

    // Group by city
    const cityMap = new Map<string, Order[]>();
    for (const order of pending) {
      const city = order.city!;
      if (!cityMap.has(city)) cityMap.set(city, []);
      cityMap.get(city)!.push(order);
    }

    // Build recommendations
    const recommendations: RouteRecommendation[] = [];

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
