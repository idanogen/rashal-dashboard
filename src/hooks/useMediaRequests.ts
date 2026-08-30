import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface MediaRequestState {
  serviceCallId: string;
  state: string;
  mediaReceivedAt: string | null;
}

/**
 * מצבי מנוע "תמונה לפני טכנאי" לפי קריאה, לחיווי על הכרטיסים.
 * מצבים חסרי פעולה (בוטל, דולג) לא נשלפים בכלל. הטבלה קטנה (עשרות
 * שורות חיות), וה-RLS מגביל לצוות המשרד.
 */
export function useMediaRequests() {
  return useQuery({
    queryKey: ['media-requests'],
    queryFn: async (): Promise<Map<string, MediaRequestState>> => {
      const { data, error } = await supabase
        .from('media_requests')
        .select('service_call_id, state, media_received_at')
        .not('state', 'in', '("cancelled","skipped")');
      if (error) throw new Error(`Supabase media_requests: ${error.message}`);
      const map = new Map<string, MediaRequestState>();
      for (const row of data ?? []) {
        map.set(row.service_call_id, {
          serviceCallId: row.service_call_id,
          state: row.state,
          mediaReceivedAt: row.media_received_at,
        });
      }
      return map;
    },
    staleTime: 60 * 1000,
  });
}
