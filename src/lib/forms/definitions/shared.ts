import type { FormField } from '../types.ts';

/**
 * אבני בניין שחוזרות בטפסי הקופות. ⭐ כל טופס עדיין מחזיק את התוויות שלו
 * כפי שהן מודפסות אצלו ("מספר סודר" מול "מספר סידורי"), ולכן העזרים כאן
 * מקבלים את התוויות ולא מנסחים אותן מחדש.
 */

export type ConditionLabels = [ok: string, missing: string, broken: string];

/**
 * טבלת המכשירים המוחזרים: שורה לכל מכשיר, עם מצב ופירוט.
 * השורה הראשונה חובה, השאר רשות. שם וסריאלי נמשכים משורות האיסוף.
 */
export function returnDeviceRows(opts: {
  rows: number;
  nameLabel: string;
  serialLabel: string;
  conditionLabels: ConditionLabels;
  detailLabel: (n: number) => string;
  purchaseDate?: boolean;
  requestNumber?: boolean;
}): FormField[] {
  const out: FormField[] = [];
  for (let i = 0; i < opts.rows; i++) {
    const n = i + 1;
    const first = i === 0;
    out.push(
      { key: `dev${n}Name`, label: `${n}. ${opts.nameLabel}`, type: 'text', required: first, fromLine: { index: i, prop: 'name' } },
      { key: `dev${n}Serial`, label: opts.serialLabel, type: 'text', required: first, fromLine: { index: i, prop: 'serial' } },
    );
    if (opts.requestNumber) out.push({ key: `dev${n}Request`, label: 'מספר בקשה', type: 'text' });
    if (opts.purchaseDate) out.push({ key: `dev${n}Purchase`, label: 'תאריך רכישה', type: 'date' });
    out.push(
      {
        key: `dev${n}Condition`, label: 'מצב המכשיר', type: 'radio', required: first,
        options: [
          { value: 'ok', label: opts.conditionLabels[0] },
          { value: 'missing', label: opts.conditionLabels[1] },
          { value: 'broken', label: opts.conditionLabels[2] },
        ],
      },
      { key: `dev${n}Detail`, label: opts.detailLabel(n), type: 'text', span: 3 },
    );
  }
  return out;
}

/** סיבת ההחזרה: בחירה אחת ופירוט. האפשרויות לפי הטופס. */
export function returnReason(options: string[]): FormField[] {
  return [
    {
      key: 'returnReason', label: 'סיבת ההחזרה', type: 'radio', required: true, span: 3,
      options: options.map((o) => ({ value: o, label: o })),
    },
    { key: 'returnReasonDetail', label: 'פרט', type: 'text', span: 3 },
  ];
}
