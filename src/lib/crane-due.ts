/**
 * ממתי סופרים שלוש שנים לבדיקה התקופתית של מנוף (עידן 25/11/2026).
 *
 * הבסיס הוא המאוחר מבין: הבדיקה האחרונה שבוצעה, והמשלוח ללקוח האחרון (`ship_date`, מלוג
 * התנועות של כרטיס המכשיר בפריוריטי). מנוף שחזר מלקוח ונשלח ללקוח חדש מתחיל שעון חדש.
 * "ת. התקנה" מהאקסל (INSTDATE) נשאר רק כגיבוי כשאין משלוח בלוג: הוא לא מתעדכן במשלוח חוזר.
 * קובץ טהור בלי ייבוא, נבדק ב-test/crane-due.test.mjs.
 */
export type DueBasis = 'inspection' | 'ship' | 'install';

export interface DueInput {
  installDate?: string;
  shipDate?: string;
  lastInspection?: { inspectionDate: string; nextDueDate?: string };
}

export function craneStartDate(c: { installDate?: string; shipDate?: string }): string | undefined {
  return c.shipDate ?? c.installDate;
}

export function craneDue(input: DueInput): { nextDue?: string; basis?: DueBasis } {
  const insp = input.lastInspection;
  const start = input.shipDate ?? input.installDate;
  const startBasis: DueBasis = input.shipDate ? 'ship' : 'install';
  if (insp && (!start || insp.inspectionDate >= start)) {
    return { nextDue: insp.nextDueDate ?? addYears(insp.inspectionDate, 3), basis: 'inspection' };
  }
  if (start) return { nextDue: addYears(start, 3), basis: startBasis };
  return {};
}

export function addYears(isoDate: string, years: number): string {
  const [y, m, d] = isoDate.slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));
  return dt.toISOString().slice(0, 10);
}
