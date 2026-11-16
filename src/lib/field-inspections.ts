/**
 * בדיקות שהטכנאים ממלאים בשטח (`crane_forms`), כפי שהן מוצגות במסך "בדיקות מנופים".
 *
 * 🔴 16/11/2026, עמי: "כמנהל אני לא רואה שמישהו בכלל מילא בדיקת מנופים". המסך קרא
 * רק את `crane_inspections` (רישום ידני, אפס שורות), והטפסים מהאפליקציה ישבו בטבלה
 * אחרת. הטופס של המנוף גם לא מפיק PDF, ולכן לא הופיע אפילו כשבב ביומן.
 *
 * ⭐ ההתאמה למנוף לפי המספר הסידורי מול `cranes.device_number`. טופס שהמספר שלו
 * לא במאגר המנופים לא נעלם: הוא מסומן ברשימה, כי זו בדיקה שנעשתה בפועל.
 * קובץ בלי ייבוא, לכן נבדק ביחידה (`test/field-inspections.test.mjs`).
 */

export type FieldFormType = 'inspection' | 'chair_inspection';

export interface FieldInspection {
  id: string;
  formType: FieldFormType;
  craneSerial: string | null;
  customerName: string | null;
  technician: string | null;
  verdict: string | null;
  notes: string | null;
  submittedAt: string;
  stopId: string | null;
}

export interface FieldInspectionRow {
  id: string;
  form_type: string;
  crane_serial: string | null;
  customer_name: string | null;
  technician_name: string | null;
  verdict: string | null;
  notes: string | null;
  submitted_at: string | null;
  created_at: string;
  stop_id: string | null;
}

export function rowToFieldInspection(r: FieldInspectionRow): FieldInspection {
  return {
    id: r.id,
    formType: r.form_type === 'chair_inspection' ? 'chair_inspection' : 'inspection',
    craneSerial: r.crane_serial,
    customerName: r.customer_name,
    technician: r.technician_name,
    verdict: r.verdict,
    notes: r.notes,
    submittedAt: r.submitted_at ?? r.created_at,
    stopId: r.stop_id,
  };
}

/** מספר סידורי להשוואה: בלי רווחים ומקפים, כי הטכנאי מקליד אותו ביד. */
export function serialKey(serial: string | null | undefined): string {
  return (serial ?? '').replace(/[\s-]/g, '').trim();
}

/** בדיקות מנוף לפי מספר סידורי, החדשה ראשונה. כיסא ממונע אינו מנוף ולא נכנס. */
export function craneInspectionsBySerial(list: FieldInspection[]): Map<string, FieldInspection[]> {
  const out = new Map<string, FieldInspection[]>();
  for (const f of list) {
    const key = serialKey(f.craneSerial);
    if (f.formType !== 'inspection' || !key) continue;
    const arr = out.get(key) ?? [];
    arr.push(f);
    out.set(key, arr);
  }
  for (const arr of out.values()) arr.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return out;
}

/** בדיקת מנוף שהמספר שלה לא קיים במאגר המנופים (או שלא הוקלד מספר). */
export function isUnmatchedCrane(f: FieldInspection, knownSerials: Set<string>): boolean {
  return f.formType === 'inspection' && !knownSerials.has(serialKey(f.craneSerial));
}

/** כמה בדיקות מאז רגע נתון (ISO). */
export function countSince(list: FieldInspection[], sinceIso: string): number {
  const since = new Date(sinceIso).getTime();
  return list.filter((f) => new Date(f.submittedAt).getTime() >= since).length;
}
