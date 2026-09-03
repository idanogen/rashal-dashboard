/**
 * "נגבה": קבלות מהספר הכספי, החודש מול חודש קודם, לפי לקוח.
 *
 * שלומי (03/09/2026) שאל מאיפה נתוני הגבייה, ומסך החובות ידע לענות רק
 * "כמה פתוח". הקבלות עונות "כמה נכנס", וזה הצד השני של אותו כסף: קבלה
 * שנקלטת בפריוריטי סוגרת חשבוניות (תאריך התאמה), והן כבר יורדות מהחוב.
 *
 * קובץ בלי ייבוא, ולכן נבדק ביחידה.
 */

/** שורה מ-`receipts_by_month`: חודש (YYYY-MM-DD, היום הראשון) × לקוח. */
export interface ReceiptMonthRow {
  month: string;
  customerNumber: string;
  customerName: string;
  n: number;
  total: number;
}

export interface CustomerReceipts {
  customerNumber: string;
  customerName: string;
  thisMonth: number;
  prevMonth: number;
}

export interface ReceiptsSummary {
  thisMonth: number;
  prevMonth: number;
  thisMonthCount: number;
  /** לפי לקוח, ממוין לפי החודש הנוכחי ואז הקודם. לקוח בלי כלום בשניהם לא מופיע. */
  byCustomer: CustomerReceipts[];
}

/** מפתח חודש מקומי, YYYY-MM. */
export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** היום הראשון של החודש הקודם, כדי ששתי העמודות ייטענו בשליפה אחת. */
export function receiptsFrom(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

export function summarizeReceipts(rows: ReceiptMonthRow[], now: Date = new Date()): ReceiptsSummary {
  const cur = monthKeyOf(now);
  const prev = monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 1, 1));
  const by = new Map<string, CustomerReceipts>();
  let thisMonth = 0, prevMonth = 0, thisMonthCount = 0;
  for (const r of rows) {
    // `month` מגיע כתאריך; שבעת התווים הראשונים הם המפתח, בלי לעבור דרך Date.
    const k = String(r.month).slice(0, 7);
    const isCur = k === cur, isPrev = k === prev;
    if (!isCur && !isPrev) continue;
    const total = Number(r.total) || 0;
    if (isCur) { thisMonth += total; thisMonthCount += Number(r.n) || 0; } else prevMonth += total;
    const c = by.get(r.customerNumber) ?? {
      customerNumber: r.customerNumber, customerName: r.customerName, thisMonth: 0, prevMonth: 0,
    };
    if (isCur) c.thisMonth += total; else c.prevMonth += total;
    by.set(r.customerNumber, c);
  }
  const byCustomer = [...by.values()].sort(
    (a, b) => b.thisMonth - a.thisMonth || b.prevMonth - a.prevMonth,
  );
  return { thisMonth, prevMonth, thisMonthCount, byCustomer };
}

/** תווית לסוג הקבלה לפי קידומת המסמך. הקידומות אצל ר.שעל, נמדדו 03/09/2026. */
export function receiptKindLabel(docNo: string | null | undefined, docType?: string | null): string {
  const p = (docNo ?? '').replace(/[0-9].*$/, '');
  if (p === 'RC') return 'קבלה';
  if (p === 'OV') return 'חשבונית מס קבלה';
  if (p === 'ON') return 'זיכוי חשבונית מס קבלה';
  if (docType === 'T') return 'קבלה';
  if (docType === 'E') return 'חשבונית מס קבלה';
  return 'קבלה';
}
