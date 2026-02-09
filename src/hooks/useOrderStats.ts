import { useMemo } from 'react';
import type { Order, OrderStats } from '@/types/order';

export function useOrderStats(orders: Order[]): OrderStats {
  return useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    // Calculate start of this week (Sunday)
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const weekStart = startOfWeek.toISOString().split('T')[0];

    // Count by worker
    const byWorker: Record<string, number> = {};
    for (const order of orders) {
      const worker = order.openedBy || 'לא ידוע';
      byWorker[worker] = (byWorker[worker] || 0) + 1;
    }

    return {
      total: orders.length,
      byOrderStatus: {
        waiting: orders.filter((o) => o.orderStatus === 'ממתין לתאום').length,
        outOfStock: orders.filter((o) => o.orderStatus === 'איו במלאי').length,
        delivered: orders.filter((o) => o.orderStatus === 'סופק').length,
      },
      byWorker,
      byStatus: {
        todo: orders.filter((o) => o.status === 'Todo' || !o.status).length,
        inProgress: orders.filter((o) => o.status === 'In progress').length,
        done: orders.filter((o) => o.status === 'Done').length,
      },
      uniqueCities: [...new Set(orders.map((o) => o.city).filter(Boolean) as string[])].sort(
        (a, b) => a.localeCompare(b, 'he')
      ),
      todayCount: orders.filter((o) => o.created === today).length,
      thisWeekDelivered: orders.filter(
        (o) => o.orderStatus === 'סופק' && o.created >= weekStart
      ).length,
    };
  }, [orders]);
}
