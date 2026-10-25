/**
 * נתוני מסך ההדגמה של הטפסים (`/forms-demo`, 25/10/2026).
 *
 * עידן, לפני פגישת המסירה עם עמי: "לראות דמו של כל האפשרויות הקיימות ...
 * ולראות את התהליך כולו". המסך מריץ את זרימת המילוי והחתימה האמיתית ואת
 * יצירת ה-PDF האמיתית, על לקוח דמה, ולא שומר כלום.
 *
 * ⭐ הרשימה נגזרת מ-`FORM_DEFINITIONS` ולא נכתבת ביד: טופס חדש שיתווסף
 * למערכת יופיע כאן מעצמו (הבדיקה `forms-demo.test.mjs` שומרת על זה).
 * הקובץ בלי ייבוא של דפדפן, כדי שייבדק ב-node.
 */
import type { FormDefinition, FormKind, FormLine } from './forms/types.ts';
import type { FormSource } from './forms/prefill.ts';

export const DEMO_DRIVER = 'נהג הדגמה';
export const DEMO_CUSTOMER = 'ישראלי ישראל';

const BASE = {
  customerName: DEMO_CUSTOMER,
  phone: '050-0000000',
  address: 'הרצל 12',
  city: 'ראשון לציון',
  customerNumber: 'DEMO-1',
};

/** מה הלקוח מקבל, מחזיר או מתקן, לפי סוג הפעולה. */
const LINES: Record<FormKind, FormLine[]> = {
  delivery: [{ name: 'כסא גלגלים מתקפל קל משקל', serial: 'DEMO-2604-118', catalog: 'WCH-18' }],
  return: [{ name: 'הליכון 4 גלגלים עם מושב', serial: 'DEMO-2511-042', catalog: 'RLT-04' }],
  repair: [{ name: 'כסא ממונע Q400 M תוצרת SUNRISE MEDICAL', serial: 'DEMO-2302-950', catalog: 'SRQ400M' }],
};

const DOC: Record<FormKind, string> = { delivery: 'SO-DEMO', return: 'PK-DEMO', repair: 'SC-DEMO' };

export function demoSource(def: FormDefinition): FormSource {
  const lines = LINES[def.kind];
  return {
    ...BASE,
    healthFund: def.fundLabel,
    docNumber: DOC[def.kind],
    lines,
    ...(def.kind === 'repair'
      ? {
          deviceName: lines[0].catalog,
          deviceDesc: lines[0].name,
          deviceSerial: lines[0].serial,
          installDate: '2024-05-02',
          faultDesc: 'הכסא לא נוסע אחורה (תקלת הדגמה)',
        }
      : {}),
  };
}

export interface DemoEntry {
  key: string;
  title: string;
  fund: string;
  kind: FormKind;
  /** כללית: צילום טופס הנייר ולא מילוי על המסך. */
  photoOnly: boolean;
}

export function demoEntries(defs: FormDefinition[]): DemoEntry[] {
  return defs.map((d) => ({ key: d.key, title: d.title, fund: d.fundLabel, kind: d.kind, photoOnly: !!d.photoOnly }));
}
