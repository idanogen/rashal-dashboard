import type { FormDefinition, FormKind } from './types.ts';
import { clalitDelivery } from './definitions/clalit-delivery.ts';
import { maccabiDelivery, maccabiReturn } from './definitions/maccabi.ts';
import { leumitDelivery, leumitReturn } from './definitions/leumit.ts';
import { meuhedetDelivery } from './definitions/meuhedet.ts';
import { mohReturn } from './definitions/moh-return.ts';
import { mohRepair } from './definitions/moh-repair.ts';

/**
 * כל טפסי הקופות, לפי מה שעמי שלח ב-04/08 ואילונה אישרה ב-15/10/2026:
 *
 * | | כללית | מכבי | מאוחדת | לאומית |
 * |---|---|---|---|---|
 * | אספקה | צילום טופס הפורטל | מכבי | מאוחדת | לאומית |
 * | החזרה | משרד הבריאות | מכבי | משרד הבריאות | לאומית |
 * | תיקון | משרד הבריאות (אחיד לכל הקופות) ||||
 *
 * 🔴 **הסדר במערך הוא סדר ההתאמה**: טופס של קופה מסוימת לפני טופס
 * משרד הבריאות, שתופס גם את מי שהקופה שלו בפריוריטי היא "משרד הבריאות".
 */
export const FORM_DEFINITIONS: FormDefinition[] = [
  clalitDelivery, maccabiDelivery, leumitDelivery, meuhedetDelivery,
  maccabiReturn, leumitReturn, mohReturn,
  mohRepair,
];

function normalize(v: string): string {
  return v.replace(/["'`]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * בחירת טופס לפי הקופה וסוג הפעולה.
 *
 * הקופה היא `health_fund` של ההזמנה, הקריאה או כרטיס הלקוח, כלומר
 * `CTYPENAME` בפריוריטי ("כללית הנדסה", "מכבי", "משרד הבריאות"...).
 * ההתאמה לפי הכלה ולא שוויון, כי בכרטיס הלקוח הערכים ארוכים יותר
 * ("קופת חולים לאומית", "כללית הנדסה רפואית בעמ").
 *
 * ⭐ טופס התיקון אחיד לכל הקופות, ולכן נבחר גם כשהקופה לא ידועה.
 */
export function findForm(healthFund: string | null | undefined, kind: FormKind): FormDefinition | null {
  if (kind === 'repair') return mohRepair;
  const fund = normalize(healthFund ?? '');
  if (!fund) return null;
  return (
    FORM_DEFINITIONS.find(
      (def) => def.kind === kind && def.healthFundMatches.some((m) => fund.includes(normalize(m))),
    ) ?? null
  );
}

/** למה אין טופס, במילים שהטכנאי מבין. null = יש טופס. */
export function noFormReason(healthFund: string | null | undefined, kind: FormKind): string | null {
  if (findForm(healthFund, kind)) return null;
  const fund = normalize(healthFund ?? '');
  if (!fund) return 'הקופה של הלקוח לא רשומה בפריוריטי, ולכן אין טופס לבחור';
  return `אין טופס ${FORM_KIND_LABEL[kind]} ל"${fund}"`;
}

export function getFormByKey(key: string): FormDefinition | null {
  return FORM_DEFINITIONS.find((d) => d.key === key) ?? null;
}

export const FORM_KIND_LABEL: Record<FormKind, string> = {
  delivery: 'אספקה',
  return: 'החזרה',
  repair: 'תיקון',
};

/** סוג הטופס שהעצירה דורשת, לפי סוג המקור. null = אין טופס (משימה, בדיקה). */
export function formKindForStop(sourceType: string): FormKind | null {
  if (sourceType === 'delivery' || sourceType === 'customer') return 'delivery';
  if (sourceType === 'service') return 'repair';
  if (sourceType === 'pickup') return 'return';
  return null;
}
