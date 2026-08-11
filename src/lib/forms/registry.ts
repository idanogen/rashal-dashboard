import type { FormDefinition, FormKind } from './types';
import { clalitDelivery } from './definitions/clalit-delivery';
import { mohRepair } from './definitions/moh-repair';

/** טפסים שמומשו ואפשר לחתום עליהם. */
export const FORM_DEFINITIONS: FormDefinition[] = [clalitDelivery, mohRepair];

/**
 * הטפסים שקיבלנו כ-PDF אך טרם מומשו, וטופס אחד שכלל לא נמסר לנו.
 * הרשימה מוצגת לנהג כדי שהמסך יגיד את האמת על מה שעוד לא קיים, במקום
 * להיראות שלם ולהיתקע מול לקוח.
 */
export interface PlannedForm {
  key: string;
  kind: FormKind;
  fundLabel: string;
  title: string;
  /** false = הטופס עצמו עוד לא בידינו. */
  sourceAvailable: boolean;
}

export const PLANNED_FORMS: PlannedForm[] = [
  { key: 'maccabi-delivery',  kind: 'delivery', fundLabel: 'מכבי',            title: 'אישור קבלת מכשיר שיקום וניידות', sourceAvailable: true },
  { key: 'leumit-delivery',   kind: 'delivery', fundLabel: 'לאומית',          title: 'אישור קבלת פריט שיקום וניידות',  sourceAvailable: true },
  { key: 'meuhedet-delivery', kind: 'delivery', fundLabel: 'מאוחדת',          title: 'אישור קבלת ציוד שיקום / ניידות', sourceAvailable: true },
  { key: 'moh-delivery',      kind: 'delivery', fundLabel: 'משרד הבריאות',    title: 'אישור קבלת מכשיר',               sourceAvailable: false },
  { key: 'maccabi-return',    kind: 'return',   fundLabel: 'מכבי',            title: 'אישור החזרת מכשיר',              sourceAvailable: true },
  { key: 'leumit-return',     kind: 'return',   fundLabel: 'לאומית',          title: 'אישור החזרת מכשירים',            sourceAvailable: true },
  { key: 'moh-return',        kind: 'return',   fundLabel: 'כללית ומאוחדת',   title: 'אישור החזרת מכשירי ניידות',      sourceAvailable: true },
];

function normalize(v: string): string {
  return v.replace(/["'`]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * בחירת טופס לפי קופה וסוג פעולה.
 *
 * ההתאמה היא לפי הכלה ולא שוויון, כי הערכים במסד לא נקיים:
 * "כללית הנדסה רפואית בעמ" · "קופת חולים לאומית" · "" ועוד.
 */
export function findForm(healthFund: string | undefined, kind: FormKind): FormDefinition | null {
  const fund = normalize(healthFund ?? '');
  if (!fund) return null;
  return (
    FORM_DEFINITIONS.find(
      (def) => def.kind === kind && def.healthFundMatches.some((m) => fund.includes(normalize(m))),
    ) ?? null
  );
}

/** הטופס המתוכנן שהיה אמור להתאים, כדי להסביר לנהג למה אין טופס. */
export function findPlannedForm(healthFund: string | undefined, kind: FormKind): PlannedForm | null {
  const fund = normalize(healthFund ?? '');
  if (!fund) return null;
  return PLANNED_FORMS.find((p) => p.kind === kind && fund.includes(normalize(p.fundLabel))) ?? null;
}

export function getFormByKey(key: string): FormDefinition | null {
  return FORM_DEFINITIONS.find((d) => d.key === key) ?? null;
}

export const FORM_KIND_LABEL: Record<FormKind, string> = {
  delivery: 'אספקה',
  return: 'החזרה',
  repair: 'תיקון',
};
