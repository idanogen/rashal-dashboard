import {
  CRANE_CHECKLIST, CRANE_CHECKLIST_SUBTITLE, CRANE_CHECKLIST_TITLE, VERDICT_LABELS, itemTextForVersion,
  type ChecklistSection, type CraneVerdict,
} from './crane-checklist.ts';
import { CHAIR_CHECKLIST, CHAIR_CHECKLIST_SUBTITLE, CHAIR_CHECKLIST_TITLE } from './chair-checklist.ts';
import type { ChecklistPdfInput } from './forms/layouts/checklist.ts';

/**
 * המסמך החתום של בדיקת טכנאי, נבנה בדשבורד מהנתונים השמורים (עמי, 16/11/2026).
 *
 * 🔴 טופס המנוף באפליקציה לא מפיק PDF (רק הכיסא הממונע, מ-10/11), אבל כל מה
 * שנחתם שמור ב-`crane_forms`: הסימונים, התוצאה, השם והחתימה. לכן המסמך נבנה
 * באותה תבנית שהאפליקציה משתמשת בה לכיסא (`checklistLayout`), ולא בתבנית חדשה.
 * ⭐ טופס מגרסה 1 מוצג בנוסח שבו נחתם (`itemTextForVersion`), לא בנוסח של היום.
 */
export interface FieldInspectionDocRow {
  form_type: string;
  checklist_version: number | null;
  crane_serial: string | null;
  customer_name: string | null;
  customer_number: string | null;
  answers: Record<string, boolean> | null;
  verdict: string | null;
  notes: string | null;
  technician_name: string | null;
  recipient_name: string | null;
  recipient_signature: string | null;
  submitted_at: string | null;
  created_at: string;
}

/** הפרקים בנוסח של הגרסה שבה נחתם הטופס. */
export function sectionsForForm(formType: string, version: number | null): ChecklistSection[] {
  if (formType === 'chair_inspection') return CHAIR_CHECKLIST;
  const v = version ?? 2;
  return CRANE_CHECKLIST.map((s) => ({
    ...s,
    items: s.items.map((i) => ({ ...i, text: itemTextForVersion(i.id, v) ?? i.text })),
  }));
}

export function fieldInspectionDocInput(
  r: FieldInspectionDocRow,
  extra: { deviceModel?: string | null; docNumber?: string | null },
): ChecklistPdfInput {
  const chair = r.form_type === 'chair_inspection';
  return {
    title: chair ? CHAIR_CHECKLIST_TITLE : CRANE_CHECKLIST_TITLE,
    subtitle: chair ? CHAIR_CHECKLIST_SUBTITLE : CRANE_CHECKLIST_SUBTITLE,
    sections: sectionsForForm(r.form_type, r.checklist_version),
    answers: r.answers ?? {},
    verdicts: (Object.keys(VERDICT_LABELS) as CraneVerdict[]).map((key) => ({ key, label: VERDICT_LABELS[key] })),
    verdict: r.verdict,
    notes: r.notes ?? '',
    customerName: r.customer_name ?? '',
    customerNumber: r.customer_number,
    deviceModel: extra.deviceModel ?? null,
    deviceSerial: r.crane_serial,
    docNumber: extra.docNumber ?? null,
    recipientName: r.recipient_name ?? '',
    signature: r.recipient_signature,
    meta: { signedAt: new Date(r.submitted_at ?? r.created_at), driverName: r.technician_name ?? '' },
  };
}
