/**
 * עריכת פרטי עצירה אחרי שיבוץ (עמי, 07/10/2026): "כתובת חדשה או נוספת,
 * לפעמים הטיפול במסגרת". הלוגיקה הטהורה: מה השתנה ומה זה גורר.
 *
 * ⭐ העצירה היא העותק שלנו. הכתובת בהזמנה או בקריאה בפריוריטי נשארת כמו
 * שהיא, והנהג נוסע למה שכתוב על העצירה. לכן עריכה כאן לא נוגעת בפריוריטי.
 *
 * 🔴 כתובת שהשתנתה מאפסת את המיקום על המפה. בלי זה הסיכה הייתה נשארת על
 * הכתובת הישנה והניווט היה לוקח את הנהג למקום הלא נכון, בלי שום סימן.
 */
export interface StopDetailsForm {
  address: string;
  city: string;
  phone: string;
}

export interface StopDetailsCurrent {
  address?: string | null;
  city?: string | null;
  phone?: string | null;
}

export interface StopDetailsPatch {
  /** השדות שבאמת השתנו, מוכנים ל-updateStop. */
  fields: { address?: string; city?: string; phone?: string };
  /** כתובת או עיר זזו: למחוק מיקום ישן ולמקם מחדש. */
  relocate: boolean;
  /** כלום לא השתנה: לא כותבים למסד. */
  empty: boolean;
}

const clean = (v: string | null | undefined) => (v ?? '').replace(/\s+/g, ' ').trim();

export function buildStopDetailsPatch(current: StopDetailsCurrent, form: StopDetailsForm): StopDetailsPatch {
  const fields: StopDetailsPatch['fields'] = {};
  const address = clean(form.address);
  const city = clean(form.city);
  const phone = clean(form.phone);
  if (address !== clean(current.address)) fields.address = address;
  if (city !== clean(current.city)) fields.city = city;
  if (phone !== clean(current.phone)) fields.phone = phone;
  const relocate = 'address' in fields || 'city' in fields;
  return { fields, relocate, empty: Object.keys(fields).length === 0 };
}

/** מה נכתב בהערת המערכת ובטוסט: "כתובת: א → ב · טלפון: ג → ד". */
export function describeStopDetailsChange(current: StopDetailsCurrent, patch: StopDetailsPatch): string {
  const parts: string[] = [];
  const show = (v: string | null | undefined) => (clean(v) ? clean(v) : 'ריק');
  if ('address' in patch.fields) parts.push(`כתובת: ${show(current.address)} ← ${show(patch.fields.address)}`);
  if ('city' in patch.fields) parts.push(`עיר: ${show(current.city)} ← ${show(patch.fields.city)}`);
  if ('phone' in patch.fields) parts.push(`טלפון: ${show(current.phone)} ← ${show(patch.fields.phone)}`);
  return parts.join(' · ');
}
