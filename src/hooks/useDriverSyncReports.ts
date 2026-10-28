import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { DriverSyncReport } from '@/lib/driver-sync';
export { describeSyncReport } from '@/lib/driver-sync';

/**
 * דיווחי המכשירים (אפליקציה בלי קליטה, 28/10/2026): לכל נהג מתי הטלפון סנכרן
 * לאחרונה, כמה פעולות ממתינות בתור וכמה נדחו. נהג שלא דיווח שעתיים הוא
 * בלי קליטה ולא נעלם; פעולה שממתינה אצל מכשיר שסנכרן היא תקלה (הוואצ'דוג).
 */

export function useDriverSyncReports() {
  return useQuery({
    queryKey: ['driverSyncReports'],
    queryFn: async () => {
      const { data, error } = await supabase.from('driver_sync_reports').select('*');
      if (error) throw new Error(error.message);
      const byDriver: Record<string, DriverSyncReport> = {};
      for (const r of (data ?? []) as DriverSyncReport[]) {
        if (!r.driver_name) continue;
        const cur = byDriver[r.driver_name];
        if (!cur || r.last_sync_at > cur.last_sync_at) byDriver[r.driver_name] = r;
      }
      return byDriver;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}
