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

export interface OrderItemInfo {
  part?: string;
  desc?: string;
  qty?: number;
  serial?: string;
}

export interface PickupLineInfo {
  part?: string;
  desc?: string;
  qty?: number;
  unit?: string;
  barcode?: string;
  sourceOrder?: string;
  returnReason?: string;
}

/** אספקה: מה לספק (עמי, 06/10/2026). */
export interface OrderInfo {
  id: string;
  docno?: string;
  orderType?: string;
  healthFund?: string;
  priorityStatus?: string;
  openedAt?: string;
  agent?: string;
  items: OrderItemInfo[];
}

/** איסוף: מה לאסוף ולאן. */
export interface PickupInfo {
  id: string;
  docno?: string;
  pickupStatus?: string;
  pickupDate?: string;
  sourceOrder?: string;
  deliveryNote?: string;
  reference?: string;
  toWarehouse?: string;
  agent?: string;
  totalQty?: number;
  lines: PickupLineInfo[];
}

export type StopInfoKind = 'service' | 'delivery' | 'pickup' | 'none';

export interface CallInfo {
  stopId: string;
  /** מה הכרטיס מציג: קריאה, אספקה, איסוף, או כלום (משימה חופשית). */
  kind: StopInfoKind;
  order: OrderInfo | null;
  pickup: PickupInfo | null;
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
  const o = r.order && typeof r.order === 'object' ? (r.order as Raw) : null;
  const pk = r.pickup && typeof r.pickup === 'object' ? (r.pickup as Raw) : null;
  const num = (v: unknown): number | undefined => (v == null || v === '' || Number.isNaN(Number(v)) ? undefined : Number(v));
  const order: OrderInfo | null = o
    ? {
        id: String(o.id ?? ''),
        docno: str(o.docno),
        orderType: str(o.order_type),
        healthFund: str(o.health_fund),
        priorityStatus: str(o.priority_status),
        openedAt: str(o.opened_at),
        agent: str(o.agent),
        items: (Array.isArray(o.items) ? (o.items as Raw[]) : [])
          .filter((i) => str(i.desc) || str(i.part))
          .map((i) => ({ part: str(i.part), desc: str(i.desc), qty: num(i.qty), serial: str(i.serial) })),
      }
    : null;
  const pickup: PickupInfo | null = pk
    ? {
        id: String(pk.id ?? ''),
        docno: str(pk.docno),
        pickupStatus: str(pk.pickup_status),
        pickupDate: str(pk.pickup_date),
        sourceOrder: str(pk.source_order),
        deliveryNote: str(pk.delivery_note),
        reference: str(pk.reference),
        toWarehouse: str(pk.to_warehouse),
        agent: str(pk.agent),
        totalQty: num(pk.total_qty),
        lines: (Array.isArray(pk.lines) ? (pk.lines as Raw[]) : [])
          .filter((l) => str(l.desc) || str(l.part))
          .map((l) => ({
            part: str(l.part), desc: str(l.desc), qty: num(l.qty), unit: str(l.unit), barcode: str(l.barcode),
            sourceOrder: str(l.source_order), returnReason: str(l.return_reason),
          })),
      }
    : null;
  return {
    stopId: String(r.stop_id ?? ''),
    kind: c ? 'service' : order ? 'delivery' : pickup ? 'pickup' : 'none',
    order,
    pickup,
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

/** "מנוף חשמלי G175 ×2": שורה אחת לפריט, בלי רעש של ריק. */
export function itemLine(i: { part?: string; desc?: string; qty?: number }): string {
  const name = i.desc ?? i.part ?? '';
  const qty = i.qty != null && i.qty !== 1 ? ` ×${i.qty}` : '';
  return `${name}${qty}`;
}

/** כותרת הכרטיס לפי הסוג: "קריאת שירות" · "אספקה" · "איסוף" · "משימה". */
export function infoKindLabel(kind: StopInfoKind): string {
  return kind === 'service' ? 'קריאת שירות' : kind === 'delivery' ? 'אספקה' : kind === 'pickup' ? 'איסוף' : 'משימה';
}

/** מספר המסמך של מה שהכרטיס מציג. */
export function infoDocno(info: CallInfo): string | undefined {
  return info.call?.docno ?? info.order?.docno ?? info.pickup?.docno;
}

/** כפתור הכרטיס על העצירה: "פרטי הקריאה" · "פרטי האספקה" · "פרטי האיסוף". ריק = אין כרטיס. */
export function infoButtonLabel(sourceType: string, hasSource: boolean): string {
  if (!hasSource) return '';
  return sourceType === 'service' ? 'פרטי הקריאה' : sourceType === 'delivery' ? 'פרטי האספקה' : sourceType === 'pickup' ? 'פרטי האיסוף' : '';
}
