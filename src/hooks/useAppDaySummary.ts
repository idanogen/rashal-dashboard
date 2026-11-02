import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DaySummary } from '@/lib/app-day-summary';

/**
 * תמונת היום מ-`app_day_summary` (אדמין בלבד, ה-RLS במסד).
 * 🔴 המסך מתרענן לבד: כל דקה כשהוא גלוי ובחזרה לחלון, כי הנתונים מגיעים
 * מטלפונים בשטח ולא מפעולה במסך הזה (חוק המסך המשותף).
 */
export function useAppDaySummary(day: string) {
  return useQuery({
    queryKey: ['appDaySummary', day],
    queryFn: async (): Promise<DaySummary> => {
      const { data, error } = await supabase.rpc('app_day_summary', { p_day: day });
      if (error) throw new Error(`app_day_summary: ${error.message}`);
      return data as DaySummary;
    },
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
