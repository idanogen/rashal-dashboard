import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { parseCallInfo, parseCounts, type CallInfo, type StopInfoCounts } from '@/lib/call-info';

/** כמה זמן חיה כתובת חתומה לקובץ מהדלי הפרטי. */
const SIGNED_SECONDS = 600;

/**
 * "יש מה לראות" לכל עצירות השירות שבמסך, בקריאה אחת.
 * המסד בודק שהנהג רואה רק עצירות שלו; עצירה זרה פשוט לא חוזרת.
 */
export function useStopsCallInfoCounts(stopIds: string[]) {
  const ids = [...new Set(stopIds)].sort().slice(0, 300);
  return useQuery({
    queryKey: ['stopCallInfoCounts', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, StopInfoCounts>> => {
      const { data, error } = await supabase.rpc('stops_call_info_counts', { p_stop_ids: ids });
      if (error) throw new Error(error.message);
      return parseCounts(data);
    },
  });
}

export type SignedCallInfo = CallInfo & { urls: Record<string, string> };

/**
 * 🔴 החתימה עוברת את מדיניות האחסון של `wa-media`, כך שנהג לא יכול לחתום
 * קובץ של לקוח שאינו בסידור שלו גם אם ינחש נתיב. משרד חותם הכל.
 */
async function withSignedUrls(raw: unknown): Promise<SignedCallInfo | null> {
  const info = parseCallInfo(raw);
  if (!info) return null;
  const paths = [...new Set(info.media.map((m) => m.path))];
  const urls: Record<string, string> = {};
  if (paths.length) {
    const { data: signed, error: signErr } = await supabase.storage
      .from('wa-media')
      .createSignedUrls(paths, SIGNED_SECONDS);
    if (signErr) throw new Error(signErr.message);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
    }
  }
  return { ...info, urls };
}

/** הכרטיס של הנהג, לפי עצירה. */
export function useStopCallInfo(stopId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['stopCallInfo', stopId],
    enabled: enabled && !!stopId,
    // הכתובות חיות 10 דקות: רענון אחרי 5 כדי שלא ייפתח קובץ שפג.
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SignedCallInfo | null> => {
      const { data, error } = await supabase.rpc('stop_call_info', { p_stop_id: stopId });
      if (error) throw new Error(error.message);
      return withSignedUrls(data);
    },
  });
}

/**
 * אותו כרטיס במסך הסדרן, לפי קריאה שעוד לא שובצה (עידן, 15/09/2026:
 * "אין לי במסך פה גישה לתמונות ולסרטונים"). משרד בלבד, נאכף במסד.
 */
export function useServiceCallInfo(callId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['serviceCallInfo', callId],
    enabled: enabled && !!callId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SignedCallInfo | null> => {
      const { data, error } = await supabase.rpc('service_call_info', { p_call_id: callId });
      if (error) throw new Error(error.message);
      return withSignedUrls(data);
    },
  });
}
