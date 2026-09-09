import { supabase } from './supabase';

/**
 * דוח בוקר טוב למנהלים (החלטות עידן, 09/09/2026).
 *
 * ⭐ קריאה אחת ל-`morning_report`, שמחשבת הכל במסד מהעצירות שביומן.
 * אותה פונקציה בדיוק מזינה את הודעת הוואטסאפ של שבע בבוקר, ולכן המסך
 * וההודעה לא יכולים להראות מספרים שונים על אותו יום.
 *
 * 🔴 "סופק" = עצירה שנסגרה "בוצע" בלבד. עצירה שנשארה פתוחה אינה כישלון,
 * היא לא דווחה, ולכן היא עמודה משלה ומחוץ לאחוז האספקה (הכלל שנקבע
 * במסך ביצועי הצוות ב-02/09).
 */
export interface MorningDriver {
  name: string;
  kind: string | null;
  planned: number;
  delivered: number;
  not_delivered: number;
  open: number;
}

export interface MorningNotDelivered {
  id: string;
  customer: string | null;
  city: string | null;
  driver: string | null;
  source: string | null;
  kind: string | null;
  reason: string | null;
  note: string | null;
}

export interface MorningOpen {
  id: string;
  customer: string | null;
  city: string | null;
  driver: string | null;
  source: string | null;
  status: string;
  arrived: boolean;
}

export interface MorningTrendDay {
  date: string;
  planned: number;
  delivered: number;
  not_delivered: number;
  open: number;
}

export interface MorningMonth {
  month: string;
  workdays: number;
  planned: number;
  delivered: number;
  not_delivered: number;
  open: number;
}

export interface MorningReport {
  date: string;
  dow: number;
  totals: { planned: number; delivered: number; not_delivered: number; open: number; drivers: number };
  byDriver: MorningDriver[];
  notDelivered: MorningNotDelivered[];
  open: MorningOpen[];
  trend: MorningTrendDay[];
  months: MorningMonth[];
}

export async function fetchMorningReport(date: string | null): Promise<MorningReport> {
  const { data, error } = await supabase.rpc('morning_report', { p_date: date });
  if (error) throw error;
  const d = (data ?? {}) as Record<string, unknown>;
  return {
    date: String(d.date ?? ''),
    dow: Number(d.dow ?? 0),
    totals: (d.totals ?? { planned: 0, delivered: 0, not_delivered: 0, open: 0, drivers: 0 }) as MorningReport['totals'],
    byDriver: (d.by_driver ?? []) as MorningDriver[],
    notDelivered: (d.not_delivered ?? []) as MorningNotDelivered[],
    open: (d.open ?? []) as MorningOpen[],
    trend: (d.trend ?? []) as MorningTrendDay[],
    months: (d.months ?? []) as MorningMonth[],
  };
}

/** אחוז אספקה: סופקו מתוך מה שדווח (סופק + לא סופק). פתוחות בחוץ. */
export function deliveryRate(delivered: number, notDelivered: number): number | null {
  const reported = delivered + notDelivered;
  return reported > 0 ? Math.round((delivered / reported) * 100) : null;
}

/** שובצו לו אבל לא דיווח על אף אחת: לא מדרגים, מסמנים. */
export function driverReported(d: { planned: number; delivered: number; not_delivered: number }): boolean {
  return d.planned === 0 || d.delivered + d.not_delivered > 0;
}

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export function morningDayLabel(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return `יום ${DAY_NAMES[d.getDay()]}, ${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

export function morningShortDay(yyyyMmDd: string): { dow: string; date: string } {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return { dow: '', date: yyyyMmDd };
  return { dow: DAY_NAMES[d.getDay()].slice(0, 1) + "'", date: `${d.getDate()}/${d.getMonth() + 1}` };
}

export function morningMonthLabel(yyyyMmDd: string): string {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  if (Number.isNaN(d.getTime())) return yyyyMmDd;
  return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
}

/** YYYY-MM-DD בשעון מקומי, פלוס/מינוס ימים. */
export function shiftDate(yyyyMmDd: string, days: number): string {
  const d = new Date(yyyyMmDd + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayLocal(): string {
  return shiftDate(new Date().toISOString().slice(0, 10), 0);
}
