/**
 * עריכת פרטי עצירה אחרי שיבוץ (עמי, 07/10/2026): "כתובת חדשה או נוספת,
 * לפעמים הטיפול במסגרת". הלוגיקה הטהורה: מה השתנה ומה זה גורר.
 *
 * ⭐ 28/10/2026 (עידן): גם הנהג והטכנאי עורכים מהאפליקציה, ובמעמד השמירה
 * בוחרים היקף: חד פעמי (רק הביקור הזה) או קבוע (הלקוח). הכתיבה עצמה עברה
 * למסד (`stop_details_change`), מקור אחד לדשבורד ולאפליקציה; כאן נשארת
 * ההכרעה "מה השתנה" לתצוגה (כפתור שמור, אזהרת מיקום, טוסט).
 *
 * 🔴 בפריוריטי לעולם לא מוחקים: קבוע = נייד חדש כאיש קשר נוסף ושורה בדו-שיח
 * הפנימי של הכרטיס. הכתובת בכרטיס עצמו לא נדרסת, המשרד מעדכן אחרי המייל.
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

/** חד פעמי = רק הביקור הזה. קבוע = הלקוח: גם הביקורים הפתוחים שלו וגם פריוריטי (הוספה בלבד). */
export type StopDetailsScope = 'once' | 'permanent';

export const SCOPE_OPTIONS: { value: StopDetailsScope; label: string; hint: string }[] = [
  { value: 'once', label: 'רק לביקור הזה', hint: 'חד פעמי. העצירה משתנה, הלקוח ופריוריטי לא.' },
  { value: 'permanent', label: 'קבוע ללקוח', hint: 'גם הביקורים הפתוחים שלו. בפריוריטי נוסף איש קשר ושורה בכרטיס, בלי למחוק כלום.' },
];

export function scopeLabel(scope: StopDetailsScope): string {
  return scope === 'permanent' ? 'קבוע ללקוח' : 'רק לביקור הזה';
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

/** התשובה של `stop_details_change` במסד. */
export interface StopDetailsChangeResult {
  changed: boolean;
  change_id?: string;
  scope?: StopDetailsScope;
  relocate?: boolean;
  description?: string;
  other_stops_updated?: number;
  priority_contact_added?: boolean;
}

/** שורת הסיכום אחרי שמירה, לטוסט בדשבורד ולהודעה באפליקציה. */
export function summarizeStopDetailsResult(r: StopDetailsChangeResult): string {
  if (!r.changed) return 'לא השתנה כלום.';
  const parts = [r.description ?? ''];
  if (r.scope === 'permanent') {
    if ((r.other_stops_updated ?? 0) > 0) parts.push(`עודכנו גם ${r.other_stops_updated} ביקורים פתוחים של הלקוח`);
    parts.push(r.priority_contact_added ? 'הנייד נוסף לפריוריטי כאיש קשר' : 'נרשם בכרטיס הלקוח בפריוריטי');
  }
  parts.push('המשרד קיבל מייל');
  return parts.filter(Boolean).join(' · ');
}
