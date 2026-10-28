import type { FormDefinition, FormContext, FormLine, FormValues } from './types.ts';
import { EMPTY_CONTEXT } from './types.ts';

/**
 * מילוי מוקדם של הטופס מתוך מה שכבר ידוע לנו מפריוריטי.
 *
 * ⭐ **קובץ טהור, בלי גישה למסד**, כדי שייבדק ביחידה. המשיכה עצמה ב-`context.ts`.
 * המקור הוא הזמנה, קריאת שירות או איסוף, מנורמל לצורה אחת (`FormSource`).
 */

export interface FormSource {
  customerName: string;
  phone?: string | null;
  phoneAlt?: string | null;
  address?: string | null;
  city?: string | null;
  customerNumber?: string | null;
  healthFund?: string | null;
  docNumber?: string | null;
  deviceName?: string | null;
  deviceDesc?: string | null;
  deviceSerial?: string | null;
  installDate?: string | null;
  warrantyUntil?: string | null;
  faultDesc?: string | null;
  lines?: FormLine[];
}

/**
 * פיצול "שם משפחה שם פרטי". בפריוריטי השם מחרוזת אחת, ואין לו סדר קבוע
 * בין פרטי למשפחה (מלכודת מוכרת בפרויקט). זו הערכה, ולכן השדות נשארים
 * פתוחים לעריכה בטופס.
 */
export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { lastName: parts[0], firstName: parts.slice(1).join(' ') };
}

/** "הרצל 12" → רחוב "הרצל", בית "12". כתובת לא סטנדרטית נשארת שלמה ברחוב. */
export function splitAddress(address: string): { street: string; houseNumber: string } {
  const m = address.trim().match(/^(.*?)[\s,]+(\d+[א-ת]?)\s*$/);
  if (!m) return { street: address.trim(), houseNumber: '' };
  return { street: m[1].trim(), houseNumber: m[2] };
}

/** תאריך לשדה `<input type=date>`, לפי היום המקומי ולא לפי UTC. */
export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * אחריות מהמערכת (עמי, 28/10/2026: "הטכנאי לא אמור להתעסק עם אחריות, המידע צריך להימשך
 * מהמערכת"). יש תאריך אחריות מפריוריטי (WARRANTYDATE): כן אם הוא היום או אחרי, אחרת לא.
 * אין תאריך: ריק, הטכנאי יכול לסמן אם יודע. ב-60 יום רק 31% מהקריאות מגיעות עם תאריך.
 */
export function underWarrantyOf(warrantyUntil: string | Date | null | undefined, now: Date = new Date()): '' | 'yes' | 'no' {
  const until = toDateInput(warrantyUntil);
  if (!until) return '';
  return until >= toDateInput(now) ? 'yes' : 'no';
}

export function buildContext(src: FormSource, driverName: string, now: Date = new Date()): FormContext {
  const { firstName, lastName } = splitName(src.customerName ?? '');
  const { street, houseNumber } = splitAddress(src.address ?? '');
  const lines = (src.lines ?? []).filter((l) => l.name || l.serial);
  const items = lines.map((l) => l.name).filter(Boolean).join(', ');
  const fullAddress = [src.address?.trim(), src.city?.trim()].filter(Boolean).join(', ');

  return {
    ...EMPTY_CONTEXT,
    customerName: src.customerName ?? '',
    firstName,
    lastName,
    phone: src.phone ?? '',
    phoneAlt: src.phoneAlt ?? '',
    address: street,
    houseNumber,
    city: src.city ?? '',
    fullAddress,
    customerNumber: src.customerNumber ?? '',
    healthFund: src.healthFund ?? '',
    orderNumber: src.docNumber ?? '',
    callNumber: src.docNumber ?? '',
    deviceName: src.deviceName ?? lines[0]?.name ?? '',
    deviceDesc: src.deviceDesc ?? items,
    deviceSerial: src.deviceSerial ?? lines[0]?.serial ?? '',
    installDate: toDateInput(src.installDate),
    warrantyUntil: toDateInput(src.warrantyUntil),
    underWarranty: underWarrantyOf(src.warrantyUntil, now),
    faultDesc: src.faultDesc ?? '',
    items,
    driverName,
    today: toDateInput(now),
  };
}

/** ערכי הפתיחה: ההגדרה מוחלת על ההקשר ועל שורות המכשירים. */
export function buildInitialValues(def: FormDefinition, ctx: FormContext, lines: FormLine[] = []): FormValues {
  const values: FormValues = {};
  for (const section of def.sections) {
    for (const field of section.fields) {
      if (field.type === 'checkbox') {
        values[field.key] = false;
      } else if (field.fromLine) {
        values[field.key] = lines[field.fromLine.index]?.[field.fromLine.prop] ?? '';
      } else {
        values[field.key] = field.prefill ? (ctx[field.prefill] ?? '') : '';
      }
    }
  }
  return values;
}

function isEmpty(v: string | boolean | undefined): boolean {
  return typeof v === 'boolean' ? !v : !String(v ?? '').trim();
}

/** שדות חובה שנשארו ריקים, בתוויות שלהם. ריק = אפשר לעבור לחתימה. */
export function missingRequired(def: FormDefinition, values: FormValues): string[] {
  const missing: string[] = [];
  for (const section of def.sections) {
    for (const field of section.fields) {
      if (field.required && isEmpty(values[field.key])) missing.push(field.label);
    }
  }
  return missing;
}

/** ת"ז ישראלית: 9 ספרות עם ספרת ביקורת. ריק אינו שגוי (שדה החובה תופס אותו). */
export function isValidIsraeliId(raw: string): boolean {
  const id = raw.replace(/\D/g, '');
  if (!id) return true;
  if (id.length > 9) return false;
  const padded = id.padStart(9, '0');
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(padded[i]) * ((i % 2) + 1);
    if (d > 9) d -= 9;
    sum += d;
  }
  return sum % 10 === 0;
}

/** שדות ת"ז שמולאו בערך שגוי. */
export function invalidIds(def: FormDefinition, values: FormValues): string[] {
  const bad: string[] = [];
  for (const section of def.sections) {
    for (const field of section.fields) {
      if (field.type === 'id' && !isValidIsraeliId(String(values[field.key] ?? ''))) bad.push(field.label);
    }
  }
  return bad;
}

/** צילומי חובה שחסרים. */
export function missingPhotos(def: FormDefinition, photos: Record<string, unknown>): string[] {
  return (def.photos ?? []).filter((p) => p.required && !photos[p.key]).map((p) => p.label);
}
