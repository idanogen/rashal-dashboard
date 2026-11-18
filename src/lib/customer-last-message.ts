/**
 * ההודעה האחרונה של הלקוח על כרטיס הקריאה (עידן, 18/11/2026): ציטוט קצר, שעה, ונקודה
 * כחולה כשאף אחד במשרד עוד לא קרא. השליפה ב-`service_call_last_inbound()`
 * (20261118_call_last_inbound.sql). קובץ בלי ייבוא, לכן נבדק ביחידה.
 */

export interface LastInbound {
  serviceCallId: string;
  phoneLocal: string | null;
  body: string | null;
  hasMedia: boolean;
  at: string;
  unread: boolean;
}

export interface LastInboundRow {
  service_call_id: string;
  phone_local: string | null;
  body: string | null;
  has_media: boolean | null;
  at: string;
  unread: boolean | null;
}

export function rowToLastInbound(r: LastInboundRow): LastInbound {
  return {
    serviceCallId: r.service_call_id,
    phoneLocal: r.phone_local,
    body: r.body,
    hasMedia: r.has_media === true,
    at: r.at,
    unread: r.unread === true,
  };
}

/** הציטוט על הכרטיס: הטקסט עד 60 תווים, ותמונה בלי טקסט כ"📷 שלח תמונה". */
export function quoteLine(m: Pick<LastInbound, 'body' | 'hasMedia'>, max = 60): string {
  const text = (m.body ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return m.hasMedia ? '📷 שלח תמונה' : 'הודעה ריקה';
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/** "09:14" אם היום, אחרת "17/11". שעון ישראל. */
export function whenLabel(iso: string, now: Date = new Date()): string {
  const tz = 'Asia/Jerusalem';
  const d = new Date(iso);
  const day = (x: Date) => x.toLocaleDateString('en-CA', { timeZone: tz });
  if (day(d) === day(now)) return d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: tz });
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', timeZone: tz });
}

/** אירוע הדפדפן שפותח את תיבת השיחות הצפה ישר על לקוח (WaDock מאזין). */
export const WA_DOCK_OPEN_EVENT = 'wa-dock:open';
