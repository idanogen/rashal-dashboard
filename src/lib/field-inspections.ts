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
  serviceCallId: string | null;
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
  service_call_id: string | null;
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
    serviceCallId: r.service_call_id,
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

/**
 * האם בדיקת השטח נחשבת כבדיקה התקופתית של 3 השנים.
 *
 * 🔴 עמי, 16/11/2026: "כן, אם הגיע לתקלה או יזום. לא אספקה". כלומר רק בדיקת מנוף
 * שנעשתה בקריאת שירות (`service_call_id`), לא בביקור אספקה. ⭐ ורק כשהמנוף נמצא
 * תקין: מנוף שהוצא משימוש לא מקבל "בדיקה הבאה בעוד 3 שנים".
 */
export function countsAsPeriodic(f: FieldInspection): boolean {
  return f.formType === 'inspection' && !!f.serviceCallId && f.verdict === 'ok';
}

/** תאריך מקומי (YYYY-MM-DD) של רגע ISO, לחישוב "בדיקה הבאה". */
export function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** בדיקות השטח של מנוף בצורה שחישוב הסטטוס מקבל, רק אלה שנחשבות תקופתיות. */
export function periodicFromField(list: FieldInspection[] = []): Array<{ inspectionDate: string; status: 'completed' }> {
  return list.filter(countsAsPeriodic).map((f) => ({ inspectionDate: localDay(f.submittedAt), status: 'completed' as const }));
}

/**
 * החיפוש העליון במסך "בדיקות מנופים" (עידן בפגישה, 17/11/2026): אותה מחרוזת מסננת גם
 * את בדיקות הטכנאים. לקוח, טכנאי והערות לפי מילים בכל סדר (לשם לקוח אין סדר קבוע),
 * מספר סידורי בלי רווחים ומקפים.
 */
export function matchesFieldSearch(f: FieldInspection, query: string): boolean {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const hay = [f.customerName, f.technician, f.notes, f.craneSerial].join(' ').toLowerCase();
  const serial = serialKey(f.craneSerial).toLowerCase();
  return words.every((w) => hay.includes(w) || (serialKey(w) !== '' && serial.includes(serialKey(w))));
}
