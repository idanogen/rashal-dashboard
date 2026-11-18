import { supabase } from './supabase';
import { ARCHIVE_SCREEN_FILTER, rowToArchivedCall, type ArchivedCall, type ArchivedCallRow } from './calls-archive-rules';

const COLS =
  'id, priority_call_id, customer_name, customer_number, phone, city, priority_status, created_at, archived_at, archived_reason';

/** כל מה שבארכיון של המסך, החדש שעבר למעלה. מעומד, כי PostgREST חותך ב-1,000. */
export async function fetchArchivedCalls(): Promise<ArchivedCall[]> {
  const PAGE = 1000;
  const all: ArchivedCall[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('service_calls')
      .select(COLS)
      .not('archived_at', 'is', null)
      .or(ARCHIVE_SCREEN_FILTER)
      .order('archived_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`ארכיון הקריאות: ${error.message}`);
    const rows = (data as ArchivedCallRow[]) ?? [];
    all.push(...rows.map(rowToArchivedCall));
    if (rows.length < PAGE) return all;
  }
}

/**
 * מחזיר קריאה לרשימת הסדרן. הכלל במסד לא יעביר אותה שוב לארכיון כל עוד הסטטוס
 * בפריוריטי לא משתנה (הוא רץ רק על שינוי סטטוס).
 * 🔴 עדכון שתפס אפס שורות אינו שגיאה ב-PostgREST (למשל משתמש בצפייה בלבד), לכן סופרים.
 */
export async function restoreArchivedCall(id: string): Promise<void> {
  const { data, error } = await supabase
    .from('service_calls')
    .update({ archived_at: null, archived_reason: null })
    .eq('id', id)
    .select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('אין הרשאה להחזיר קריאה, או שהיא כבר הוחזרה');
}
