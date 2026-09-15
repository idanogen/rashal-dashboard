/**
 * כרטיס הקריאה לנהג ולטכנאי (עידן אישר את המוקאפ, 15/09/2026).
 *
 * המידע מגיע מפונקציות המסד `stop_call_info` ו-`stops_call_info_counts`,
 * שבודקות בעצמן שהנהג רואה רק עצירות שלו. כאן רק הצורה והתוויות.
 *
 * 🔴 קובץ טהור בלי ייבוא, כדי שייבדק (`test/call-info.test.mjs`).
 * אותו קובץ מועתק לאפליקציה (`rashal-driver/src/lib/call-info.ts`).
 */

export type CallMediaType = 'image' | 'video' | 'audio';

export interface StopInfoCounts {
  stopId: string;
  hasFault: boolean;
  images: number;
  videos: number;
  texts: number;
}

export interface CallMedia {
  messageId: string;
  index: number;
  at: string;
  type: CallMediaType;
  path: string;
  contentType?: string;
}

export interface CallText {
  messageId: string;
  at: string;
  body: string;
}

export interface CallInfo {
  stopId: string;
  call: {
    id: string;
    docno?: string;
    faultText?: string;
    openedAt?: string;
    deviceName?: string;
    deviceDesc?: string;
    deviceSerial?: string;
    warrantyUntil?: string;
    serviceType?: string;
  } | null;
  media: CallMedia[];
  texts: CallText[];
  officeNote: { userName: string; content: string; at: string } | null;
  mediaRequest: { state?: string; sentAt?: string; receivedAt?: string } | null;
}

type Raw = Record<string, unknown>;
const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

export function parseCounts(rows: unknown): Record<string, StopInfoCounts> {
  const out: Record<string, StopInfoCounts> = {};
  for (const r of Array.isArray(rows) ? (rows as Raw[]) : []) {
    const stopId = str(r.stop_id);
    if (!stopId) continue;
    out[stopId] = {
      stopId,
      hasFault: r.has_fault === true,
      images: Number(r.images) || 0,
      videos: Number(r.videos) || 0,
      texts: Number(r.texts) || 0,
    };
  }
  return out;
}

export function parseCallInfo(raw: unknown): CallInfo | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Raw;
  const c = r.call && typeof r.call === 'object' ? (r.call as Raw) : null;
  const note = r.office_note && typeof r.office_note === 'object' ? (r.office_note as Raw) : null;
  const req = r.media_request && typeof r.media_request === 'object' ? (r.media_request as Raw) : null;
  return {
    stopId: String(r.stop_id ?? ''),
    call: c
      ? {
          id: String(c.id ?? ''),
          docno: str(c.docno),
          faultText: str(c.fault_text),
          openedAt: str(c.opened_at),
          deviceName: str(c.device_name),
          deviceDesc: str(c.device_desc),
          deviceSerial: str(c.device_serial),
          warrantyUntil: str(c.warranty_until),
          serviceType: str(c.service_type),
        }
      : null,
    media: (Array.isArray(r.media) ? (r.media as Raw[]) : [])
      .filter((m) => str(m.path) && ['image', 'video', 'audio'].includes(String(m.type)))
      .map((m) => ({
        messageId: String(m.message_id ?? ''),
        index: Number(m.i) || 0,
        at: String(m.at ?? ''),
        type: m.type as CallMediaType,
        path: String(m.path),
        contentType: str(m.content_type),
      })),
    texts: (Array.isArray(r.texts) ? (r.texts as Raw[]) : [])
      .filter((t) => str(t.body))
      .map((t) => ({ messageId: String(t.message_id ?? ''), at: String(t.at ?? ''), body: String(t.body) })),
    officeNote: note && str(note.content)
      ? { userName: String(note.user_name ?? 'המשרד'), content: String(note.content), at: String(note.at ?? '') }
      : null,
    mediaRequest: req
      ? { state: str(req.state), sentAt: str(req.sent_at), receivedAt: str(req.received_at) }
      : null,
  };
}

/** יש מה לראות: תאור, קובץ או משהו שהלקוח כתב. */
export function hasCallInfo(c: StopInfoCounts | null | undefined): boolean {
  return !!c && (c.hasFault || c.images > 0 || c.videos > 0 || c.texts > 0);
}

/** "📋 תאור תקלה · 📷 5 תמונות · ▶ סרטון". ריק כשאין כלום. */
export function infoChipLabel(c: StopInfoCounts | null | undefined): string {
  if (!c) return '';
  const parts: string[] = [];
  if (c.hasFault) parts.push('📋 תאור תקלה');
  if (c.images > 0) parts.push(c.images === 1 ? '📷 תמונה' : `📷 ${c.images} תמונות`);
  if (c.videos > 0) parts.push(c.videos === 1 ? '▶ סרטון' : `▶ ${c.videos} סרטונים`);
  if (!parts.length && c.texts > 0) parts.push('💬 הודעות מהלקוח');
  return parts.join(' · ');
}

/**
 * טלפון בתוך תאור התקלה הופך ללחיץ. מספר ישראלי: נייד, קווי או 1-800,
 * עם או בלי מקפים ורווחים, וגם בקידומת 972+.
 */
const PHONE_RE = /(?:\+972[-\s]?|\b0)(?:5\d|7\d|[23489])[-\s]?\d{3}[-\s]?\d{4}\b/g;

export interface TextPart {
  text: string;
  tel?: string;
}

export function splitPhones(text: string): TextPart[] {
  const out: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(PHONE_RE)) {
    const start = m.index ?? 0;
    if (start > last) out.push({ text: text.slice(last, start) });
    const digits = m[0].replace(/[^\d+]/g, '');
    out.push({ text: m[0], tel: `tel:${digits}` });
    last = start + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** שורת ההסבר כשאין קבצים: למה ריק, ולא נראה כמו תקלה בטעינה. */
export function emptyMediaLine(req: CallInfo['mediaRequest'], timeLabel: (iso: string) => string): string {
  if (req?.sentAt && !req.receivedAt) {
    return `הלקוח עוד לא שלח תמונות. בקשת "תמונה לפני טכנאי" נשלחה ${timeLabel(req.sentAt)}.`;
  }
  return 'הלקוח לא שלח תמונות או סרטונים מאז שהקריאה נפתחה.';
}
