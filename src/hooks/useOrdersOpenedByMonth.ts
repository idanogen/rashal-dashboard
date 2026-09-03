import { useQuery } from '@tanstack/react-query';
import { fetchOrdersOpenedByMonth } from '@/lib/orders-opened';
import { seriesFrom } from '@/lib/month-series';

/** הזמנות שנפתחו לפי חודש, `months` אחורה כולל הנוכחי. */
export function useOrdersOpenedByMonth(months = 6) {
  const from = seriesFrom(months);
  return useQuery({
    queryKey: ['ordersOpenedByMonth', months, from.getFullYear(), from.getMonth()],
    queryFn: () => fetchOrdersOpenedByMonth(from),
    staleTime: 60 * 1000,
  });
}
