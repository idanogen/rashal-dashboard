import { useMemo } from 'react';
import type { Order } from '@/types/order';
import { getDaysSinceCreated } from '@/lib/utils';
import {
  geocodeOrderByCity,
  calculateDistance,
  type GeocodedOrder,
} from '@/lib/geocoding';

/**
 * תוצאת אופטימיזציית מסלול
 */
export interface OptimizedRoute {
  /** הזמנות בסדר אופטימלי */
  orders: Order[];
  /** סה"כ מרחק משוער בק"מ (מעוגל) */
  totalDistance: number;
  /** האם בוצע גיאוקודינג מוצלח */
  hasGeocoding: boolean;
}

// קבועים
const WAITING_STATUS = 'ממתין לתאום';
const OLD_THRESHOLD_DAYS = 7; // הזמנות 7+ ימים נחשבות "ותיקות"
const MIN_ORDERS_FOR_OPTIMIZATION = 2; // מינימום הזמנות לאופטימיזציה

/**
 * Hook לאופטימיזציית מסלול משלוחים
 *
 * אלגוריתם:
 * 1. סינון הזמנות לפי סטטוס "ממתין לתאום" + כתובת + עיר
 * 2. ניקוד כל הזמנה לפי דחיפות (ימים + ותיקות)
 * 3. גיאוקודינג ברמת עיר
 * 4. אופטימיזציה Greedy Nearest-Neighbor:
 *    - התחל עם ההזמנה בעלת הציון הגבוה ביותר
 *    - בכל שלב בחר את ההזמנה הקרובה ביותר
 *    - עצור כשמגיעים למספר המבוקש
 *
 * @param orders - כל ההזמנות
 * @param targetCount - כמה נקודות אספקה רוצים במסלול
 * @param startingAddress - כתובת התחלה אופציונלית (לא בשימוש כרגע)
 * @returns מסלול אופטימלי
 */
export function useRouteOptimizer(
  orders: Order[],
  targetCount: number,
  startingAddress?: string
): OptimizedRoute {
  return useMemo(() => {
    // שלב 1: סינון - רק הזמנות ממתינות לתיאום עם כתובת ועיר
    const waitingOrders = orders.filter(
      (order) =>
        order.orderStatus === WAITING_STATUS &&
        order.address &&
        order.city
    );

    // אם אין מספיק הזמנות
    if (waitingOrders.length === 0) {
      return {
        orders: [],
        totalDistance: 0,
        hasGeocoding: false,
      };
    }

    // שלב 2: חישוב ציון לכל הזמנה
    const scoredOrders = waitingOrders.map((order) => {
      const days = getDaysSinceCreated(order.created) ?? 0;
      const isOld = days >= OLD_THRESHOLD_DAYS;

      // ציון: הזמנות ותיקות מקבלות +3, ימים מקבלים משקל של 0.5
      const score = (isOld ? 3 : 0) + days * 0.5;

      return { order, score, days };
    });

    // שלב 3: מיון לפי ציון (מהגבוה לנמוך)
    scoredOrders.sort((a, b) => b.score - a.score);

    // קח פי 2 מהכמות המבוקשת (כדי שיהיו אפשרויות לאופטימיזציה)
    const candidateCount = Math.min(
      targetCount * 2,
      scoredOrders.length
    );
    const candidates = scoredOrders.slice(0, candidateCount);

    // שלב 4: גיאוקודינג
    const geocoded: GeocodedOrder[] = candidates.map((item) =>
      geocodeOrderByCity(item.order)
    );

    // סינון - רק הזמנות עם קואורדינטות
    const withCoordinates = geocoded.filter((order) => order.coordinates);

    // אם אין מספיק הזמנות עם קואורדינטות - fallback למיון לפי ציון
    if (withCoordinates.length < MIN_ORDERS_FOR_OPTIMIZATION) {
      const topOrders = scoredOrders
        .slice(0, Math.min(targetCount, scoredOrders.length))
        .map((item) => item.order);

      return {
        orders: topOrders,
        totalDistance: 0,
        hasGeocoding: false,
      };
    }

    // שלב 5: אופטימיזציה Greedy Nearest-Neighbor
    const route: GeocodedOrder[] = [];
    const unvisited = [...withCoordinates];
    let totalDistance = 0;

    // התחל עם ההזמנה בעלת הציון הגבוה ביותר (אינדקס 0)
    let current = unvisited.shift()!;
    route.push(current);

    // בנה את המסלול
    while (route.length < targetCount && unvisited.length > 0) {
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      // מצא את ההזמנה הקרובה ביותר
      for (let i = 0; i < unvisited.length; i++) {
        const distance = calculateDistance(
          current.coordinates!,
          unvisited[i].coordinates!
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      // הוסף את ההזמנה הקרובה ביותר למסלול
      const nearest = unvisited.splice(nearestIndex, 1)[0];
      route.push(nearest);
      totalDistance += nearestDistance;
      current = nearest;
    }

    return {
      orders: route.map((geocodedOrder) => {
        // החזר Order רגיל (ללא coordinates)
        const { coordinates, ...order } = geocodedOrder;
        return order as Order;
      }),
      totalDistance: Math.round(totalDistance),
      hasGeocoding: true,
    };
  }, [orders, targetCount, startingAddress]);
}
