/**
 * ארכיון קריאות השירות (18/11/2026): מה שירד מרשימת הסדרן כי הסטטוס שלו בפריוריטי
 * אינו "לביצוע" או "להמשך טיפול". הכלל עצמו חי במסד (`service_call_archive_by_status`,
 * 20261118_calls_archive_rule.sql); כאן רק התצוגה. קובץ בלי ייבוא, לכן נבדק ביחידה.
 *
 * ⭐ הארכיון של המסך הזה הוא רק מה שהכלל והניקוי של 18/11 העבירו. כ-10,000 קריאות
 * שאורכבו באוגוסט (Make הישן, משיכת ההיסטוריה) לא מוצגות כאן ולא מוחזרות מכאן.
 */

export interface ArchivedCall {
  id: string;
  docno: string | null;
  customerName: string;
  customerNumber: string | null;
  phone: string | null;
  city: string | null;
  priorityStatus: string | null;
  created: string;
  archivedAt: string;
  reason: string;
}

export interface ArchivedCallRow {
  id: string;
  priority_call_id: string | null;
  customer_name: string | null;
  customer_number: string | null;
  phone: string | null;
  city: string | null;
  priority_status: string | null;
  created_at: string;
  archived_at: string;
  archived_reason: string | null;
}

/** המסנן של השליפה (PostgREST `or`): רק הכלל והניקוי של 18/11. */
export const ARCHIVE_SCREEN_FILTER = 'archived_reason.like.rule:*,archived_reason.like.cleanup-20261118*';

export function rowToArchivedCall(r: ArchivedCallRow): ArchivedCall {
  return {
    id: r.id,
    docno: r.priority_call_id,
    customerName: r.customer_name ?? '',
    customerNumber: r.customer_number,
    phone: r.phone,
    city: r.city,
    priorityStatus: r.priority_status,
    created: r.created_at,
    archivedAt: r.archived_at,
    reason: r.archived_reason ?? '',
  };
}

/** למה הקריאה בארכיון, במילים של המשרד. */
export function archiveReasonLabel(reason: string, priorityStatus: string | null): string {
  if (reason === 'cleanup-20261118:no-sc') return 'בלי מספר קריאה (מערכת קודמת)';
  if (reason === 'cleanup-20261118:legacy') return 'קריאה ישנה שלא שובצה אצלנו';
  if (reason === 'cleanup-20261118:dup') return 'כפיל';
  if (reason === 'cleanup-20261118:status' || reason.startsWith('rule:')) {
    return `סטטוס בפריוריטי: ${priorityStatus ?? reason.slice('rule:'.length)}`;
  }
  return reason;
}

/** חיפוש: שם בכל סדר מילים, מספר קריאה, מספר לקוח, טלפון בלי מקפים, עיר. */
export function matchesArchiveSearch(c: ArchivedCall, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const digits = (s: string | null) => (s ?? '').replace(/\D/g, '');
  const hay = [c.customerName, c.docno, c.customerNumber, c.city, c.priorityStatus].join(' ').toLowerCase();
  const phone = digits(c.phone);
  return words.every((w) => hay.includes(w) || (digits(w) !== '' && phone.includes(digits(w))));
}
