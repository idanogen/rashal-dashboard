/**
 * דוח איסופים חודשי לקופה (שלומי 17/11/2026: "טבלה מרכזת לספק - איסופים מכבי",
 * עובר לקופה ב-10 לכל חודש). עידן 18/11: מהחודש כל האיסופים דרך המערכת, ולכמה
 * חודשים מפיקים את הדוח משני המקורות ומשווים. קובץ טהור; המסד: `pickups_fund_report`.
 */

export interface PriorityPickupRow {
  rt: string | null;
  name: string;
  tz: string;
  picked: string;
  part: string | null;
  item: string | null;
  reason: string | null;
  warehouse: string | null;
  purchased: string | null;
}

export interface AppPickupRow {
  rt: string | null;
  name: string;
  tz: string;
  picked: string;
  driver: string | null;
  item: string | null;
  part: string | null;
  serial: string | null;
  reason: string | null;
  condition: string | null;
  hasForm: boolean;
  purchased: string | null;
}

export interface PickupsReport {
  fund: string;
  from: string;
  to: string;
  priority: PriorityPickupRow[];
  app: AppPickupRow[];
}

/** הקופות כפי שהן כתובות בסוג הלקוח בפריוריטי. */
export const REPORT_FUNDS = ['מכבי', 'כללית הנדסה', 'לאומית', 'מאוחדת', 'משרד הבריאות', 'משרד הבטחון'] as const;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function parsePickupsReport(raw: unknown): PickupsReport {
  const r = (raw ?? {}) as Record<string, unknown>;
  const arr = (v: unknown) => (Array.isArray(v) ? v : []).map((x) => (x ?? {}) as Record<string, unknown>);
  return {
    fund: str(r.fund) ?? '',
    from: str(r.from) ?? '',
    to: str(r.to) ?? '',
    priority: arr(r.priority).map((x) => ({
      rt: str(x.rt), name: str(x.name) ?? '', tz: str(x.tz) ?? '', picked: str(x.picked) ?? '',
      part: str(x.part), item: str(x.item), reason: str(x.reason), warehouse: str(x.warehouse), purchased: str(x.purchased),
    })),
    app: arr(r.app).map((x) => ({
      rt: str(x.rt), name: str(x.name) ?? '', tz: str(x.tz) ?? '', picked: str(x.picked) ?? '', driver: str(x.driver),
      item: str(x.item), part: str(x.part), serial: str(x.serial), reason: str(x.reason), condition: str(x.condition),
      hasForm: x.has_form === true, purchased: str(x.purchased),
    })),
  };
}

/**
 * ברירת המחדל לתקופה: הדוח יוצא ב-10 לחודש, ולכן מה-10 בחודש הקודם עד ה-9 בחודש
 * הזה (בקובץ של מכבי, "חודש 10" = איסופים מ-08/09 עד 08/10). אחרי ה-10 מציעים את
 * התקופה שנסגרה עכשיו; לפני כן את זו שלפניה.
 */
export function defaultReportPeriod(today: Date): { from: string; to: string } {
  const y = today.getFullYear();
  const m = today.getMonth() - (today.getDate() >= 10 ? 0 : 1);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { from: iso(new Date(y, m - 1, 10)), to: iso(new Date(y, m, 9)) };
}

/** שם האביזר, סוג ודגם בשפה של הקובץ של הקופה ("כג רמה 3 / כג / גרדיאן"). */
export function classifyItem(item: string | null, part: string | null): { name: string; kind: string; model: string } {
  const t = `${item ?? ''} ${part ?? ''}`;
  const tilt = /הטיה/.test(t) ? ' גב הטיה' : '';
  if (/מנוף|^G1\d\d|\bG\d{3}E?\b/i.test(t)) {
    const kg = t.match(/\b(1[0-9]{2}|2[0-9]{2})\b/)?.[1];
    return { name: 'מנוף', kind: 'מנוף', model: kg ? `מנוף ${kg}` : 'מנוף' };
  }
  if (/גרדיאן|guardian/i.test(t)) return { name: 'כג רמה 3', kind: 'כג', model: `גרדיאן${tilt}` };
  if (/rubix|רוביקס/i.test(t)) return { name: 'כג רמה 2', kind: 'כג', model: 'רוביקס' };
  if (/רחצה|שירותים|bath/i.test(t)) return { name: 'כיסא רחצה', kind: 'כיסא רחצה', model: 'כיסא רחצה' };
  if (/ממונע|Q6|Q400|Q700|quickie/i.test(t)) return { name: 'כיסא ממונע', kind: 'כג', model: (part ?? '').trim() || 'ממונע' };
  return { name: (item ?? '').trim(), kind: '', model: (part ?? '').trim() };
}

/** מצב המכשיר בטופס של הנהג (לא החלטת מלאי/גריטה, שהיא של המחסן). */
export function conditionLabel(c: string | null): string {
  return c === 'ok' ? 'תקין' : c === 'broken' ? 'פגום' : c === 'missing' ? 'חסרים חלקים' : '';
}

export interface ReportComparison {
  both: string[];
  priorityOnly: PriorityPickupRow[];
  appOnly: AppPickupRow[];
}

/** לפי מספר תעודת האיסוף: מה נסגר בשני המקורות, ומה רק באחד. */
export function compareSources(r: PickupsReport): ReportComparison {
  const pri = new Set(r.priority.map((x) => x.rt).filter(Boolean) as string[]);
  const app = new Set(r.app.map((x) => x.rt).filter(Boolean) as string[]);
  const firstBy = <T extends { rt: string | null }>(rows: T[], keep: (rt: string) => boolean) => {
    const seen = new Set<string>();
    return rows.filter((x) => x.rt && keep(x.rt) && !seen.has(x.rt) && seen.add(x.rt));
  };
  return {
    both: [...pri].filter((x) => app.has(x)),
    priorityOnly: firstBy(r.priority, (rt) => !app.has(rt)),
    appOnly: firstBy(r.app, (rt) => !pri.has(rt)),
  };
}

/** כותרות העמודות כמו בקובץ שעובר לקופה, ובסוף עמודות עזר שלנו. */
export const FUND_SHEET_HEADER = [
  'שם המבוטח', 'ת"ז', 'איסוף/אספקה', 'רכישה', 'תאריך איסוף', 'שם האביזר', 'סוג האביזר', 'דגם', "מס' סריאלי",
  'סיבת החזרה', 'מלאי\\גריטה', 'גריטה:סיבה', 'מצב (מהטופס)', 'תעודה', 'חסר להשלמה',
];

const ddmmyyyy = (iso: string | null) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '');

/** שורה לקובץ הקופה. "חסר להשלמה" אומר למשרד מה להשלים ביד לפני שליחה. */
export function fundSheetRow(x: PriorityPickupRow | AppPickupRow): (string | number)[] {
  const c = classifyItem(x.item, x.part);
  const serial = 'serial' in x ? x.serial : null;
  const cond = 'condition' in x ? conditionLabel(x.condition) : '';
  const missing = [!serial && 'סריאלי', !x.reason && 'סיבה', !x.purchased && 'תאריך רכישה'].filter(Boolean).join(', ');
  return [
    x.name, x.tz, 'איסוף', ddmmyyyy(x.purchased), ddmmyyyy(x.picked), c.name, c.kind, c.model, serial ?? '',
    x.reason ?? '', '', '', cond, x.rt ?? '', missing,
  ];
}
