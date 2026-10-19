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

/**
 * חיווי "יש טופס קריאה" (עידן, 19/10/2026: "שיהיה חיווי לקובץ").
 * קריאה שלא חזרה = אין טופס (או שהוא מבוטל). ההרשאה נאכפת במסד.
 */
export function useCallsWithDoc(callIds: (string | undefined)[]) {
  const ids = [...new Set(callIds.filter((id): id is string => !!id))].sort().slice(0, 300);
  return useQuery({
    queryKey: ['callsWithDoc', ids.join(',')],
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, { docno: string; status?: string }>> => {
      const { data, error } = await supabase.rpc('calls_with_doc', { p_call_ids: ids });
      if (error) throw new Error(error.message);
      const out: Record<string, { docno: string; status?: string }> = {};
      for (const r of Array.isArray(data) ? data : []) {
        const row = r as { call_id?: string; docno?: string; doc_status?: string };
        if (row.call_id && row.docno) out[row.call_id] = { docno: row.docno, status: row.doc_status ?? undefined };
      }
      return out;
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
  const urls: Record<string, string> = {};
  const sign = async (bucket: string, paths: string[]) => {
    if (!paths.length) return;
    const { data: signed, error: signErr } = await supabase.storage
      .from(bucket)
      .createSignedUrls(paths, SIGNED_SECONDS);
    if (signErr) throw new Error(signErr.message);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) urls[s.path] = s.signedUrl;
    }
  };
  await sign('wa-media', [...new Set(info.media.map((m) => m.path))]);
  // טופס הקריאה מפריוריטי יושב בדלי משלו; החתימה עוברת את אותה מדיניות אחסון.
  if (info.doc) await sign('service-call-docs', [...new Set([...info.doc.pagePaths, info.doc.pdfPath])]);
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
