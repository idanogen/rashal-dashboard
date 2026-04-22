import { useQuery } from '@tanstack/react-query';
import { fetchAllStops } from '@/lib/calendar-stops';

export function useCalendarStops() {
  return useQuery({
    queryKey: ['calendarStops'],
    queryFn: fetchAllStops,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });
}
