/**
 * היסטוריית מכשיר לפי מספר סידורי (עידן, 23/11/2026: "למוצר יש אורך חיים משלו,
 * הוא יכול להיות אצל כמה לקוחות"). המסד בונה את הרשימה (`device_history`).
 * קובץ טהור בלי ייבוא, כדי שייבדק ב-node --test ויסונכרן לאפליקציה.
 */

export interface DeviceVisit {
  date: string | null;
  driver: string | null;
  status: string | null;
  kind: string | null;
  note: string | null;
}

export interface DeviceNote {
  at: string;
  by: string | null;
  text: string;
}

export interface DeviceMedia {
  src: 'tech';
  bucket: string;
  path: string;
  type: 'image' | 'video';
  at: string;
  by: string | null;
  ref: string | null;
}

export interface DeviceCall {
  id: string;
  docno: string | null;
  created: string;
  /** הקריאה שממנה פתחו את ההיסטוריה. */
  current: boolean;
  customerName: string;
  customerNumber: string | null;
  city: string | null;
  fault: string | null;
  status: string | null;
  visits: DeviceVisit[];
  notes: DeviceNote[];
  media: DeviceMedia[];
}

export interface DeviceHistory {
  serial: string | null;
  deviceDesc: string | null;
  calls: DeviceCall[];
  total: number;
  customers: number;
}

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v : null);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

export function parseDeviceHistory(raw: unknown): DeviceHistory {
  const r = (raw ?? {}) as Record<string, unknown>;
  const calls = arr(r.calls)
    .filter((c) => typeof c.id === 'string' && typeof c.created === 'string')
    .map((c) => ({
      id: c.id as string,
      docno: str(c.docno),
      created: c.created as string,
      current: c.current === true,
      customerName: str(c.customer_name) ?? 'לקוח לא ידוע',
      customerNumber: str(c.customer_number),
      city: str(c.city),
      fault: str(c.fault),
      status: str(c.status),
      visits: arr(c.visits).map((v) => ({
        date: str(v.date), driver: str(v.driver), status: str(v.status), kind: str(v.kind), note: str(v.note),
      })),
      notes: arr(c.notes)
        .filter((n) => str(n.text) && typeof n.at === 'string')
        .map((n) => ({ at: n.at as string, by: str(n.by), text: n.text as string })),
      media: arr(c.media)
        .filter((m) => str(m.path) && str(m.bucket) && typeof m.at === 'string')
        .map((m) => ({
          src: 'tech' as const,
          bucket: m.bucket as string,
          path: m.path as string,
          type: m.type === 'video' ? ('video' as const) : ('image' as const),
          at: m.at as string,
          by: str(m.by),
          ref: str(m.ref),
        })),
    }));
  return {
    serial: str(r.serial),
    deviceDesc: str(r.device_desc),
    calls,
    total: Number(r.total) || 0,
    customers: Number(r.customers) || 0,
  };
}

/** מפתח הלקוח של קריאה: מספר לקוח, ואם אין אז השם. */
const ownerKey = (c: DeviceCall) => c.customerNumber ?? c.customerName;

/**
 * קבוצות רצופות לפי לקוח, מהחדש לישן: כל קבוצה היא תקופה שבה המכשיר היה אצל לקוח אחד.
 * לקוח שחזר אחרי לקוח אחר מקבל קבוצה חדשה, כי זו תקופה אחרת בחיי המכשיר.
 */
export function groupByOwner(calls: DeviceCall[]): { owner: string; customerName: string; calls: DeviceCall[] }[] {
  const out: { owner: string; customerName: string; calls: DeviceCall[] }[] = [];
  for (const c of calls) {
    const last = out[out.length - 1];
    if (last && last.owner === ownerKey(c)) last.calls.push(c);
    else out.push({ owner: ownerKey(c), customerName: c.customerName, calls: [c] });
  }
  return out;
}

/** תווית לביקור: "בוצע", "לא בוצע", "המשך טיפול", או ריק לביקור שעוד לא נסגר. */
export function visitLabel(v: Pick<DeviceVisit, 'status' | 'kind'>): string {
  if (v.kind === 'follow_up') return 'המשך טיפול';
  if (v.status === 'completed') return 'בוצע';
  if (v.status === 'not_completed') return 'לא בוצע';
  return '';
}

/** "21 קריאות · 3 לקוחות" (או "קריאה אחת"). */
export function deviceSummary(h: Pick<DeviceHistory, 'total' | 'customers'>): string {
  const calls = h.total === 1 ? 'קריאה אחת' : `${h.total} קריאות`;
  const owners = h.customers > 1 ? ` · ${h.customers} לקוחות` : '';
  return calls + owners;
}
