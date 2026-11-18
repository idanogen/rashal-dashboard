/**
 * "שלח תזכורת לתמונה" על כרטיס קריאה אדום (עידן, 18/11/2026): עד 3 הודעות, יום אחרי יום
 * ב-10:00, עד שהלקוח שולח תמונה. הכלל והשליחה במסד ובמנוע (20261118_media_nudges.sql,
 * rashal-media-request); כאן רק מה שהכרטיס מציג. קובץ בלי ייבוא, לכן נבדק ביחידה.
 */

export const NUDGE_TOTAL = 3;

export interface MediaNudge {
  serviceCallId: string;
  state: 'active' | 'done' | 'stopped' | 'failed';
  sentCount: number;
  lastSentAt: string | null;
  nextDueAt: string | null;
  stopReason: string | null;
  startedByName: string | null;
}

export interface MediaNudgeRow {
  service_call_id: string;
  state: string;
  sent_count: number;
  sent_1_at: string | null;
  sent_2_at: string | null;
  sent_3_at: string | null;
  next_due_at: string | null;
  stop_reason: string | null;
  started_by_name: string | null;
  created_at: string;
}

export function rowToNudge(r: MediaNudgeRow): MediaNudge {
  return {
    serviceCallId: r.service_call_id,
    state: (['active', 'done', 'stopped', 'failed'].includes(r.state) ? r.state : 'stopped') as MediaNudge['state'],
    sentCount: r.sent_count,
    lastSentAt: r.sent_3_at ?? r.sent_2_at ?? r.sent_1_at,
    nextDueAt: r.next_due_at,
    stopReason: r.stop_reason,
    startedByName: r.started_by_name,
  };
}

/** הרצף האחרון לכל קריאה. השורות מגיעות מהחדשה לישנה, הראשונה קובעת. */
export function latestNudgeByCall(rows: MediaNudgeRow[]): Map<string, MediaNudge> {
  const map = new Map<string, MediaNudge>();
  for (const r of rows) if (!map.has(r.service_call_id)) map.set(r.service_call_id, rowToNudge(r));
  return map;
}

/**
 * מצבי מנוע הבקשות שבהם אין למי לשלוח: הכפתור אפור עם הסבר, כי צריך להתקשר.
 * (failed = מטא החזירה שהמספר לא בוואטסאפ, no_phone = אין נייד בקריאה.)
 */
export function nudgeBlockedReason(mediaState: string | undefined): string | null {
  if (mediaState === 'no_phone') return 'אין נייד בקריאה, צריך להתקשר';
  if (mediaState === 'failed') return 'הלקוח לא בוואטסאפ, צריך להתקשר';
  return null;
}

/** אפשר ללחוץ: אין רצף פעיל ואין סיבה לחסום. רצף שהסתיים או נעצר אפשר להתחיל מחדש. */
export function canStartNudge(nudge: MediaNudge | undefined, mediaState: string | undefined): boolean {
  return nudge?.state !== 'active' && nudgeBlockedReason(mediaState) === null;
}

/** השורה על הכרטיס, למשל "תזכורת 1 מתוך 3 נשלחה 18/11". */
export function nudgeLine(n: MediaNudge, fmtDay: (iso: string) => string): string {
  if (n.state === 'active' && n.sentCount === 0) return 'תזכורת לתמונה יוצאת עכשיו';
  if (n.state === 'failed') return 'התזכורת לא נמסרה, צריך להתקשר';
  const sent = n.lastSentAt ? ` נשלחה ${fmtDay(n.lastSentAt)}` : '';
  if (n.state === 'stopped') return `תזכורות נעצרו: ${n.stopReason ?? 'הקריאה השתנתה'}`;
  if (n.state === 'done') return `נשלחו ${NUDGE_TOTAL} תזכורות, אחרונה${sent}`;
  return `תזכורת ${n.sentCount} מתוך ${NUDGE_TOTAL}${sent}`;
}
