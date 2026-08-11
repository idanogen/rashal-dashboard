import type { Order } from '@/types/order';
import type { ServiceCall } from '@/types/service-call';
import type { FormDefinition, FormContext, FormValues } from './types';
import { EMPTY_CONTEXT } from './types';

/**
 * פיצול "שם משפחה שם פרטי" לשני שדות.
 *
 * בפריוריטי השם מגיע כמחרוזת אחת, וברשעל הסדר הוא משפחה ואז פרטי
 * ("אמנו רחמים", "קאופמן אמנון"). זו הערכה ולא ידיעה, ולכן שני השדות
 * נשארים ניתנים לעריכה בטופס ואינם readOnly.
 */
function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { lastName: parts[0], firstName: parts.slice(1).join(' ') };
}

/**
 * הפרדת מספר בית מהכתובת. "הרצל 12" → רחוב "הרצל", בית "12".
 * נכשל בשקט על כתובות לא סטנדרטיות, והנהג מתקן.
 */
function splitAddress(address: string): { street: string; houseNumber: string } {
  const m = address.trim().match(/^(.*?)[\s,]+(\d+[א-ת]?)\s*$/);
  if (!m) return { street: address.trim(), houseNumber: '' };
  return { street: m[1].trim(), houseNumber: m[2] };
}

function toDateInput(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayInput(): string {
  return toDateInput(new Date().toISOString());
}

export function buildContextFromOrder(order: Order, driverName: string): FormContext {
  const { firstName, lastName } = splitName(order.customerName);
  const { street, houseNumber } = splitAddress(order.address ?? '');
  // שורות ההזמנה מפריוריטי. הסריאלי לא מגיע בהן אף פעם (נבדק על 870 הזמנות
  // פעילות: 0 עם serial), ולכן הוא תמיד הקלדה בשטח.
  const items = (order.items ?? []).filter(Boolean);
  const itemsText = items
    .map((i) => [i.desc, i.qty && i.qty > 1 ? `× ${i.qty}` : null].filter(Boolean).join(' '))
    .filter(Boolean)
    .join(', ');

  return {
    ...EMPTY_CONTEXT,
    customerName: order.customerName,
    firstName,
    lastName,
    phone: order.phone ?? '',
    address: street,
    houseNumber,
    city: order.city ?? '',
    customerNumber: order.customerNumber ?? '',
    healthFund: order.healthFund ?? '',
    items: itemsText,
    deviceDesc: itemsText,
    deviceSerial: items[0]?.serial ?? '',
    driverName,
    today: todayInput(),
  };
}

export function buildContextFromServiceCall(call: ServiceCall, driverName: string): FormContext {
  const { firstName, lastName } = splitName(call.customerName);
  const { street, houseNumber } = splitAddress(call.address ?? '');

  return {
    ...EMPTY_CONTEXT,
    customerName: call.customerName,
    firstName,
    lastName,
    phone: call.phone ?? '',
    address: street,
    houseNumber,
    city: call.city ?? '',
    customerNumber: call.customerNumber ?? '',
    healthFund: call.healthFund ?? '',
    deviceName: call.deviceName ?? '',
    deviceDesc: call.deviceDesc ?? '',
    deviceSerial: call.deviceSerial ?? '',
    installDate: toDateInput(call.installDate),
    warrantyUntil: toDateInput(call.warrantyUntil),
    faultDesc: call.faultDesc ?? call.symptomDesc ?? '',
    driverName,
    today: todayInput(),
  };
}

/** ערכי הפתיחה של הטופס — ההגדרה מוחלת על ההקשר. */
export function buildInitialValues(def: FormDefinition, ctx: FormContext): FormValues {
  const values: FormValues = {};
  for (const section of def.sections) {
    for (const field of section.fields) {
      if (field.type === 'checkbox') {
        values[field.key] = false;
        continue;
      }
      values[field.key] = field.prefill ? (ctx[field.prefill] ?? '') : '';
    }
  }
  return values;
}

/** שדות חובה שנשארו ריקים. ריק = אפשר לחתום. */
export function missingRequired(def: FormDefinition, values: FormValues): string[] {
  const missing: string[] = [];
  for (const section of def.sections) {
    for (const field of section.fields) {
      if (!field.required) continue;
      const v = values[field.key];
      if (typeof v === 'boolean' ? !v : !String(v ?? '').trim()) missing.push(field.label);
    }
  }
  return missing;
}
