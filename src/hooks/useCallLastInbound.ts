import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { rowToLastInbound, type LastInbound, type LastInboundRow } from '@/lib/customer-last-message';

/** ההודעה האחרונה של הלקוח לכל קריאה פתוחה. מתרענן כל דקה ובחזרה לחלון. */
export function useCallLastInbound() {
  return useQuery({
    queryKey: ['call-last-inbound'],
    queryFn: async (): Promise<Map<string, LastInbound>> => {
      const { data, error } = await supabase.rpc('service_call_last_inbound');
      if (error) throw new Error(`הודעות לקוחות: ${error.message}`);
      const map = new Map<string, LastInbound>();
      for (const r of (data as LastInboundRow[]) ?? []) map.set(r.service_call_id, rowToLastInbound(r));
      return map;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}
