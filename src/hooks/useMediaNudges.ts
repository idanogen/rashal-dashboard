import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { latestNudgeByCall, type MediaNudge, type MediaNudgeRow } from '@/lib/media-nudge';

const KEY = ['media-nudges'];

/** רצפי "שלח תזכורת לתמונה" מהחודש האחרון, האחרון לכל קריאה. RLS: משרד בלבד. */
export function useMediaNudges() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<Map<string, MediaNudge>> => {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const { data, error } = await supabase
        .from('media_nudges')
        .select('service_call_id, state, sent_count, sent_1_at, sent_2_at, sent_3_at, next_due_at, stop_reason, started_by_name, created_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false });
      if (error) throw new Error(`תזכורות לתמונה: ${error.message}`);
      return latestNudgeByCall((data as MediaNudgeRow[]) ?? []);
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });
}

/** הכפתור. ההודעה הראשונה יוצאת מהמנוע תוך כ-2 דקות (בשעות העבודה). */
export function useStartMediaNudge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (serviceCallId: string) => {
      const { error } = await supabase.rpc('media_nudge_start', { p_call: serviceCallId });
      if (error) throw new Error(error.message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
