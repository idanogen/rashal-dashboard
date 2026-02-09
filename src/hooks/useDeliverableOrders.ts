import { useMemo } from 'react';
import { useOrders } from './useOrders';
import type { Order } from '@/types/order';

export interface CityGroup {
  city: string;
  orders: Order[];
}

export function useDeliverableOrders() {
  const { data: orders, isLoading, error } = useOrders();

  // Filter only orders with "תואמה אספקה " status that have address + city
  const deliverable = useMemo(() => {
    if (!orders) return [];
    return orders.filter(
      (o) => o.orderStatus === 'תואמה אספקה ' && o.address && o.city
    );
  }, [orders]);

  // Group by city, sorted by count (largest first)
  const cityGroups = useMemo((): CityGroup[] => {
    const map = new Map<string, Order[]>();
    for (const order of deliverable) {
      const city = order.city!;
      if (!map.has(city)) map.set(city, []);
      map.get(city)!.push(order);
    }
    return [...map.entries()]
      .map(([city, cityOrders]) => ({ city, orders: cityOrders }))
      .sort((a, b) => b.orders.length - a.orders.length);
  }, [deliverable]);

  return {
    deliverable,
    cityGroups,
    isLoading,
    error,
    totalOrders: orders?.length ?? 0,
  };
}
