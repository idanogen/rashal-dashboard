/**
 * לאן אפשר לשלוח העתק של טופס חתום, ואיך הוא נקרא. קובץ טהור בלי ייבוא, נבדק
 * ב-`test/form-copy.test.mjs`.
 *
 * 🔴 עידן, 27/10/2026: המיילים בר.שעל יושבים בעיקר במסך הבן "אנשי קשר ללקוח"
 * ולא בכרטיס עצמו, ואיש הקשר הוא לא תמיד הלקוח (בדוגמה: פיזיותרפיסטית של
 * כללית). לכן לא בוחרים נמען לבד: כל אפשרות מוצגת עם שם ותפקיד, והנהג מסמן
 * את מי שהלקוח ביקש. שדה ההקלדה פתוח תמיד.
 * ⭐ נרמול הטלפון לא משוכפל כאן: הוא מוזרק מבחוץ (`wa_normalize_phone` במסד).
 */

export type RecipientSource = 'stop' | 'form' | 'customer' | 'contact' | 'typed';

export interface RecipientOption {
  value: string;
  label: string;
  source: RecipientSource;
}

export interface PriorityContact {
  NAME?: string | null;
  POSITIONDES?: string | null;
  EMAIL?: string | null;
  CELLPHONE?: string | null;
  STATDES?: string | null;
}

/** תקרות נגד לחיצה כפולה או שימוש לרעה: נמענים בשליחה אחת, ושליחות לטופס. */
export const MAX_RECIPIENTS_PER_SEND = 3;
export const MAX_SENDS_PER_FORM = 10;

const EMAIL_RE = /^[^\s@,;<>"']+@[^\s@,;<>"']+\.[^\s@,;<>"'.]{2,}$/;

export function cleanEmail(raw: unknown): string | null {
  const e = String(raw ?? '').trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

/** ניידים בלבד: וואטסאפ לא מגיע לקווי. הקלט כבר מנורמל (`0501234567`). */
export function isMobileLocal(local: string | null | undefined): local is string {
  return !!local && /^05\d{8}$/.test(local);
}

function contactLabel(c: PriorityContact): string {
  const name = String(c.NAME ?? '').trim();
  const role = String(c.POSITIONDES ?? '').trim();
  return [name || 'איש קשר', role].filter(Boolean).join(' · ');
}

function activeContacts(contacts: PriorityContact[]): PriorityContact[] {
  return contacts.filter((c) => !c.STATDES || String(c.STATDES).trim() === 'פעיל');
}

export function emailOptions(customerEmail: unknown, contacts: PriorityContact[]): RecipientOption[] {
  const out: RecipientOption[] = [];
  const seen = new Set<string>();
  const add = (value: string | null, label: string, source: RecipientSource) => {
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push({ value, label, source });
  };
  add(cleanEmail(customerEmail), 'כרטיס הלקוח', 'customer');
  for (const c of activeContacts(contacts)) add(cleanEmail(c.EMAIL), contactLabel(c), 'contact');
  return out;
}

/**
 * הטלפון של העצירה ראשון (זה המספר שהמשרד תיאם איתו), אחריו מה שנרשם בטופס,
 * ואחריו אנשי הקשר. קווי וכפול יורדים.
 */
export function phoneOptions(
  stopPhone: string | null,
  formPhones: string[],
  contacts: PriorityContact[],
  normalize: (raw: string) => string | null,
): RecipientOption[] {
  const out: RecipientOption[] = [];
  const seen = new Set<string>();
  const add = (raw: string | null | undefined, label: string, source: RecipientSource) => {
    const local = raw ? normalize(raw) : null;
    if (!isMobileLocal(local) || seen.has(local)) return;
    seen.add(local);
    out.push({ value: local, label, source });
  };
  add(stopPhone, 'הטלפון בהזמנה', 'stop');
  for (const p of formPhones) add(p, 'נרשם בטופס', 'form');
  for (const c of activeContacts(contacts)) add(c.CELLPHONE, contactLabel(c), 'contact');
  return out;
}

/**
 * הערך של `doc_type` בתבנית `ogen_send_document`, שנפתחת ב"מצורפת {doc_type}
 * מספר {doc_number}". לכן צורת נקבה.
 */
export function docTypeLabel(formKey: string, formKind: string): string {
  if (formKey === 'delivery_note') return 'תעודת המשלוח החתומה';
  if (formKind === 'return') return 'תעודת החזרת הציוד החתומה';
  return 'תעודת קבלת הציוד החתומה';
}

/** שם הקובץ באנגלית: שמות בעברית נשברים אצל חלק מהספקים ובחלק מתיבות הדואר. */
export function copyFileName(docNumber: string | null, signedAt: string | null): string {
  const id = (docNumber ?? '').replace(/[^A-Za-z0-9-]/g, '');
  const day = (signedAt ?? '').slice(0, 10);
  return `R-Shaal-signed-${id || day || 'form'}.pdf`;
}

/** טקסט מוקלד: רק ערוץ, ערך ומקור מוכרים עוברים, ולא יותר מהתקרה. */
export interface RequestedRecipient {
  channel: 'whatsapp' | 'email';
  value: string;
  source: RecipientSource;
  label: string | null;
}

const SOURCES: RecipientSource[] = ['stop', 'form', 'customer', 'contact', 'typed'];

export function parseRecipients(raw: unknown): RequestedRecipient[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_RECIPIENTS_PER_SEND) return null;
  const out: RequestedRecipient[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const channel = r?.channel;
    if (channel !== 'whatsapp' && channel !== 'email') return null;
    const source = SOURCES.includes(r.source as RecipientSource) ? (r.source as RecipientSource) : 'typed';
    const value = channel === 'email' ? cleanEmail(r.value) : String(r.value ?? '').trim().slice(0, 30);
    if (!value) return null;
    const label = r.label ? String(r.label).slice(0, 80) : null;
    out.push({ channel, value, source, label });
  }
  return out;
}
