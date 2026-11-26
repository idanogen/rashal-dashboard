/**
 * קריאות שחוזרות מהקו: ההכרעה של המשרד ורכש חלקים (15/11/2026).
 * הלוגיקה הטהורה, בלי ייבוא, נבדקת ב-test/call-followups.test.mjs.
 *
 * עמי (וואטסאפ 15/11 12:07) נתן ארבעה סטטוסים להמשכי טיפול, והנוסח כאן הוא
 * הנוסח שלו. "לא בבית" ו"קריאה חוזרת" נשארים ברשימה לשיבוץ עם תג; שני סוגי
 * הרכש יוצאים מהרשימה לעמוד של האלכס המתאים, וחוזרים לראש המסך כשהחלק הגיע.
 * 🔴 אין כתיבה לפריוריטי (הכרעת עידן 15/11).
 */

export type FollowupKind = 'not_home' | 'revisit' | 'buy_warehouse' | 'buy_workshop';
export type FollowupStatus = 'open' | 'ordered' | 'arrived' | 'unavailable' | 'closed';
export type FollowupDesk = 'warehouse' | 'workshop';
export type FollowupUrgency = 'normal' | 'urgent';

export const FOLLOWUP_KINDS: FollowupKind[] = ['not_home', 'revisit', 'buy_warehouse', 'buy_workshop'];

/** הנוסח של עמי, כפי שהוא. */
export const KIND_LABEL: Record<FollowupKind, string> = {
  not_home: 'לקוח לא בבית',
  revisit: 'המשך טיפול · קריאה חוזרת',
  buy_warehouse: 'המשך טיפול · רכש אלכס מחסן',
  buy_workshop: 'המשך טיפול · רכש אלכס בית מלאכה',
};

/** מה קורה אחרי הבחירה, לשורה הקטנה בחלון. */
export const KIND_HINT: Record<FollowupKind, string> = {
  not_home: 'נשאר ברשימה עם תג, לתיאום ושיבוץ מחדש',
  revisit: 'חוסר ציוד, ציוד לא מתאים וכד\'. נשאר ברשימה עם תג',
  buy_warehouse: 'עובר לעמוד של אלכס מחסן',
  buy_workshop: 'עובר לעמוד של אלכס בית מלאכה',
};

/** תג קצר על הכרטיס. */
export const KIND_TAG: Record<FollowupKind, string> = {
  not_home: 'לקוח לא בבית',
  revisit: 'קריאה חוזרת',
  buy_warehouse: 'רכש · מחסן',
  buy_workshop: 'רכש · בית מלאכה',
};

export const DESK_LABEL: Record<FollowupDesk, string> = { warehouse: 'מחסן', workshop: 'בית מלאכה' };

export function isBuy(kind: FollowupKind): boolean {
  return kind === 'buy_warehouse' || kind === 'buy_workshop';
}

export function deskOf(kind: FollowupKind): FollowupDesk | null {
  if (kind === 'buy_warehouse') return 'warehouse';
  if (kind === 'buy_workshop') return 'workshop';
  return null;
}

export function kindForDesk(desk: FollowupDesk): FollowupKind {
  return desk === 'warehouse' ? 'buy_warehouse' : 'buy_workshop';
}

export interface CallFollowup {
  id: string;
  stopId: string;
  serviceCallId: string | null;
  kind: FollowupKind;
  item: string | null;
  urgency: FollowupUrgency;
  note: string | null;
  status: FollowupStatus;
  eta: string | null;
  poNumber: string | null;
  unavailableNote: string | null;
  closedReason: string | null;
  decidedByName: string | null;
  decidedAt: string;
  orderedByName: string | null;
  orderedAt: string | null;
  arrivedByName: string | null;
  arrivedAt: string | null;
  unavailableByName: string | null;
  unavailableAt: string | null;
  closedAt: string | null;
  customerName: string | null;
  customerNumber: string | null;
  city: string | null;
  callDocno: string | null;
  device: string | null;
  techName: string | null;
  techNote: string | null;
  visitDate: string | null;
  updatedAt: string;
}

export interface CallFollowupRow {
  id: string;
  stop_id: string;
  service_call_id: string | null;
  kind: string;
  item: string | null;
  urgency: string;
  note: string | null;
  status: string;
  eta: string | null;
  po_number: string | null;
  unavailable_note: string | null;
  closed_reason: string | null;
  decided_by_name: string | null;
  decided_at: string;
  ordered_by_name: string | null;
  ordered_at: string | null;
  arrived_by_name: string | null;
  arrived_at: string | null;
  unavailable_by_name: string | null;
  unavailable_at: string | null;
  closed_at: string | null;
  customer_name: string | null;
  customer_number: string | null;
  city: string | null;
  call_docno: string | null;
  device: string | null;
  tech_name: string | null;
  tech_note: string | null;
  visit_date: string | null;
  updated_at: string;
}

const KINDS = new Set<string>(FOLLOWUP_KINDS);
const STATUSES = new Set<string>(['open', 'ordered', 'arrived', 'unavailable', 'closed']);

export function rowToFollowup(r: CallFollowupRow): CallFollowup {
  return {
    id: r.id,
    stopId: r.stop_id,
    serviceCallId: r.service_call_id ?? null,
    kind: (KINDS.has(r.kind) ? r.kind : 'revisit') as FollowupKind,
    item: r.item ?? null,
    urgency: r.urgency === 'urgent' ? 'urgent' : 'normal',
    note: r.note ?? null,
    status: (STATUSES.has(r.status) ? r.status : 'open') as FollowupStatus,
    eta: r.eta ?? null,
    poNumber: r.po_number ?? null,
    unavailableNote: r.unavailable_note ?? null,
    closedReason: r.closed_reason ?? null,
    decidedByName: r.decided_by_name ?? null,
    decidedAt: r.decided_at,
    orderedByName: r.ordered_by_name ?? null,
    orderedAt: r.ordered_at ?? null,
    arrivedByName: r.arrived_by_name ?? null,
    arrivedAt: r.arrived_at ?? null,
    unavailableByName: r.unavailable_by_name ?? null,
    unavailableAt: r.unavailable_at ?? null,
    closedAt: r.closed_at ?? null,
    customerName: r.customer_name ?? null,
    customerNumber: r.customer_number ?? null,
    city: r.city ?? null,
    callDocno: r.call_docno ?? null,
    device: r.device ?? null,
    techName: r.tech_name ?? null,
    techNote: r.tech_note ?? null,
    visitDate: r.visit_date ?? null,
    updatedAt: r.updated_at,
  };
}

/**
 * ההכרעה הפעילה לכל קריאה (לא סגורה). כשיש יותר מאחת (לא אמור לקרות, כי
 * שיבוץ סוגר את הקודמת) מנצחת האחרונה שהוכרעה.
 */
export function activeByCall(list: CallFollowup[]): Map<string, CallFollowup> {
  const out = new Map<string, CallFollowup>();
  for (const f of list) {
    if (f.status === 'closed' || !f.serviceCallId) continue;
    const prev = out.get(f.serviceCallId);
    if (!prev || f.decidedAt > prev.decidedAt) out.set(f.serviceCallId, f);
  }
  return out;
}

/** איפה הקריאה יושבת במסך השיבוץ לפי ההכרעה. */
export type DispatchPlace = 'list' | 'buying' | 'arrived';

export function dispatchPlace(f: CallFollowup | undefined): DispatchPlace {
  if (!f || !isBuy(f.kind)) return 'list';
  if (f.status === 'arrived') return 'arrived';
  if (f.status === 'open' || f.status === 'ordered') return 'buying';
  // "לא ניתן להשיג" חוזר לרשימה עם תג, כדי שעמי יכריע מחדש.
  return 'list';
}

/** ההכרעה צריכה החלטה מחדש (כפתור "מה עושים?" מוצג שוב). */
export function needsDecision(f: CallFollowup | undefined): boolean {
  return !f || f.status === 'unavailable';
}

export type EtaState = 'none' | 'overdue' | 'today' | 'later';

export function etaState(f: Pick<CallFollowup, 'eta' | 'status'>, today: string): EtaState {
  if (!f.eta || f.status !== 'ordered') return 'none';
  if (f.eta < today) return 'overdue';
  if (f.eta === today) return 'today';
  return 'later';
}

/** "17/11" מתאריך YYYY-MM-DD. */
export function shortDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const [, m, d] = iso.slice(0, 10).split('-');
  return d && m ? `${d}/${m}` : '';
}

/** "15/11 11:40" משעה מלאה, בשעון ישראל. */
export function shortDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '';
  const parts = new Intl.DateTimeFormat('he-IL', {
    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Jerusalem',
  }).formatToParts(t);
  const get = (k: string) => parts.find((p) => p.type === k)?.value ?? '';
  return `${get('day')}/${get('month')} ${get('hour')}:${get('minute')}`;
}

/** בית מלאכה שתיקן בלי להזמין (כפתור "תוקן, חוזר לשיבוץ", 26/11) = "תוקן"; אחרת "הגיע". */
export function arrivedWord(f: Pick<CallFollowup, 'kind' | 'orderedAt'>): string {
  return deskOf(f.kind) === 'workshop' && !f.orderedAt ? 'תוקן' : 'הגיע';
}

/** תג המצב של בקשת רכש: מה עמי ואלכס רואים בשורה. */
export function buyStatusLabel(f: CallFollowup, today: string): { text: string; tone: 'amber' | 'violet' | 'red' | 'green' | 'slate' } {
  if (f.status === 'open') return { text: 'לא הוזמן עדיין', tone: 'amber' };
  if (f.status === 'arrived') return { text: `${arrivedWord(f)} ${shortDate(f.arrivedAt)}`, tone: 'green' };
  if (f.status === 'unavailable') return { text: 'לא ניתן להשיג', tone: 'red' };
  if (f.status === 'closed') return { text: 'נסגר', tone: 'slate' };
  const st = etaState(f, today);
  if (st === 'overdue') return { text: `צפי עבר · ${shortDate(f.eta)}`, tone: 'red' };
  if (st === 'today') return { text: 'צפי היום', tone: 'violet' };
  return { text: f.eta ? `הוזמן · צפי ${shortDate(f.eta)}` : 'הוזמן', tone: 'violet' };
}

/**
 * "מה צריך" ממולא מההערה של הטכנאי: שורה אחת, בלי רווחים כפולים, עד 160
 * תווים. עמי מתקן לפני השליחה; אנחנו לא מנחשים חלקים.
 */
export function prefillItem(techNote: string | null | undefined): string {
  return (techNote ?? '').replace(/\s*\n+\s*/g, ' / ').replace(/\s+/g, ' ').trim().slice(0, 160);
}

export interface TimelineEntry { at: string; text: string }

/** ציר ההיסטוריה של בקשה, חדש למעלה. */
export function followupTimeline(f: CallFollowup): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  const desk = deskOf(f.kind);
  if (f.closedAt && f.closedReason === 'scheduled') out.push({ at: f.closedAt, text: 'שובץ מחדש, נסגר' });
  if (f.arrivedAt) out.push({ at: f.arrivedAt, text: `${arrivedWord(f)}${f.arrivedByName ? ` · ${f.arrivedByName}` : ''}` });
  if (f.unavailableAt) out.push({ at: f.unavailableAt, text: `לא ניתן להשיג${f.unavailableNote ? `: ${f.unavailableNote}` : ''}` });
  if (f.orderedAt) {
    const eta = f.eta ? `, צפי ${shortDate(f.eta)}` : '';
    out.push({ at: f.orderedAt, text: `הוזמן${eta}${f.orderedByName ? ` · ${f.orderedByName}` : ''}` });
  }
  const to = desk ? `נשלח לרכש ${DESK_LABEL[desk]}` : KIND_TAG[f.kind];
  out.push({ at: f.decidedAt, text: `${to}${f.decidedByName ? ` · ${f.decidedByName}` : ''}` });
  return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

/** שורת הביקור שחזר: "דוד גוזלן, 10/11: ...". */
export function techLine(f: Pick<CallFollowup, 'techName' | 'visitDate' | 'techNote'>): string {
  const who = [f.techName, shortDate(f.visitDate)].filter(Boolean).join(', ');
  const note = (f.techNote ?? '').replace(/\s*\n+\s*/g, ' / ').trim();
  return who ? `${who}: ${note}` : note;
}

export type PartsTab = 'open' | 'arrived' | 'all';

/**
 * הרשימה של שולחן רכש אחד. פתוחות = לא הוזמן + הוזמן; "הגיעו" = שבעה ימים
 * אחרונים. סדר: לא הוזמן קודם (דחוף לפני רגיל), אחר כך לפי הצפי הקרוב.
 */
export function partsList(list: CallFollowup[], desk: FollowupDesk, tab: PartsTab, todayIso: string): CallFollowup[] {
  const kind = kindForDesk(desk);
  const weekAgo = new Date(Date.parse(`${todayIso}T00:00:00Z`) - 7 * 86_400_000).toISOString();
  const mine = list.filter((f) => f.kind === kind);
  const picked = mine.filter((f) => {
    if (tab === 'open') return f.status === 'open' || f.status === 'ordered';
    if (tab === 'arrived') return f.status === 'arrived' || (f.status === 'closed' && !!f.arrivedAt && f.arrivedAt >= weekAgo);
    return true;
  });
  const rank = (f: CallFollowup) => (f.status === 'open' ? 0 : f.status === 'ordered' ? 1 : 2);
  return picked.sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r) return r;
    if (a.status === 'open') {
      const u = (a.urgency === 'urgent' ? 0 : 1) - (b.urgency === 'urgent' ? 0 : 1);
      return u || (a.decidedAt < b.decidedAt ? 1 : -1);
    }
    if (a.status === 'ordered') return (a.eta ?? '9999') < (b.eta ?? '9999') ? -1 : (a.eta ?? '9999') > (b.eta ?? '9999') ? 1 : 0;
    return (a.arrivedAt ?? a.updatedAt) < (b.arrivedAt ?? b.updatedAt) ? 1 : -1;
  });
}

/** כמה בקשות עוד לא נגעו בהן, לתג בתפריט. */
export function openCountForDesks(list: CallFollowup[], desks: FollowupDesk[]): number {
  const kinds = new Set(desks.map(kindForDesk));
  return list.filter((f) => kinds.has(f.kind) && f.status === 'open').length;
}

/** בדיקת קלט לפני שמירה: רכש חייב "מה צריך". מחזיר שגיאה בעברית או null. */
export function validateDecision(kind: FollowupKind | null, item: string): string | null {
  if (!kind) return 'צריך לבחור מה עושים עם הקריאה';
  if (isBuy(kind) && !item.trim()) return 'צריך לכתוב מה להזמין';
  return null;
}
