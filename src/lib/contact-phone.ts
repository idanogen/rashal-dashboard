/**
 * ספר הטלפונים של הלקוח: הלוגיקה הטהורה (בלי ייבוא, נבדקת ב-test/).
 *
 * ⭐ הרקע (עמי, 06-07/10/2026): "לעדכן נייד נוסף או חדש" ו"לשלוח את
 * תבנית התמונות למספר נוסף שהלקוח מוסר לי". המספר נכנס ל-`customer_contacts`
 * דרך `customer_add_contact`, ומשם הוא יעד להודעות האוטומטיות ונכתב
 * לפריוריטי כאיש קשר. כאן רק מה שהמסך צריך כדי לא לשלוח זבל למסד.
 */

export type PhoneBookKind = 'main' | 'linked' | 'priority';

export interface PhoneBookEntry {
  kind: PhoneBookKind;
  /** 05XXXXXXXX */
  phone: string;
  /** "הבת, מיכל" · "פיזיותרפיסט" · ריק */
  label: string | null;
  createdBy?: string | null;
  createdAt?: string | null;
  /** רק ל-linked: מתי נכתב לפריוריטי. null = עדיין ממתין. */
  priorityPushedAt?: string | null;
}

/**
 * כל צורה שבן אדם מקליד → 05XXXXXXXX, או null כשזה לא נייד ישראלי.
 * מקבל +972, 972, רווחים, מקפים וסוגריים. קווי (03, 04, 08...) מוחזר null
 * בכוונה: הודעות וואטסאפ לא יוצאות אליו, ומספר שלא יקבל כלום היה נראה כמו תקלה.
 */
export function normalizeMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) digits = '0' + digits.slice(3);
  else if (digits.length === 9 && digits.startsWith('5')) digits = '0' + digits;
  if (!/^05\d{8}$/.test(digits)) return null;
  return digits;
}

/** 0523694547 → 052-369-4547, כדי שהעין תתפוס טעות הקלדה. */
export function formatMobile(local: string): string {
  if (!/^05\d{8}$/.test(local)) return local;
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}

/** שורה גולמית מ-`customer_phone_book`. */
export interface PhoneBookRow {
  kind: string;
  phone_local: string | null;
  label: string | null;
  created_by: string | null;
  created_at: string | null;
  priority_pushed_at: string | null;
}

/**
 * מרכיב את הרשימה למסך: הראשי קודם, אחריו מה שקישרנו, ובסוף מה שבפריוריטי.
 * 🔴 מספר שמופיע פעמיים (ראשי וגם מקושר, או שני אנשי קשר עם אותו נייד) מוצג
 * פעם אחת, במקום הגבוה יותר. שתי שורות עם אותו מספר נראות כמו באג.
 */
export function buildPhoneBook(mainPhone: string | null | undefined, rows: PhoneBookRow[]): PhoneBookEntry[] {
  const out: PhoneBookEntry[] = [];
  const seen = new Set<string>();
  const main = normalizeMobile(mainPhone) ?? (mainPhone ? String(mainPhone).replace(/\D/g, '') : '');
  if (main) {
    out.push({ kind: 'main', phone: main, label: null });
    seen.add(main);
  }
  const order: Record<string, number> = { linked: 0, priority: 1 };
  const sorted = [...rows]
    .filter((r) => r.phone_local && (r.kind === 'linked' || r.kind === 'priority'))
    .sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9));
  for (const r of sorted) {
    const phone = String(r.phone_local).replace(/\D/g, '');
    if (!phone || seen.has(phone)) continue;
    seen.add(phone);
    out.push({
      kind: r.kind as PhoneBookKind,
      phone,
      label: r.label && r.label.trim() ? r.label.trim() : null,
      createdBy: r.created_by,
      createdAt: r.created_at,
      priorityPushedAt: r.priority_pushed_at,
    });
  }
  return out;
}

/** מה המסך אומר על תוצאת ההוספה. */
export function addResultLine(result: string, phone: string): string {
  const p = formatMobile(phone);
  switch (result) {
    case 'added': return `${p} נוסף. ההודעות האוטומטיות יישלחו גם אליו, והוא ייכתב לפריוריטי כאיש קשר.`;
    case 'already_linked': return `${p} כבר מקושר ללקוח הזה.`;
    case 'is_main_phone': return `${p} הוא הטלפון הראשי של הלקוח, אין צורך להוסיף.`;
    default: return `${p}: ${result}`;
  }
}

/** שגיאת מסד → משפט לנציג. */
export function addErrorLine(message: string): string {
  if (/not a mobile number/i.test(message)) return 'זה לא מספר נייד ישראלי (05X). הודעות וואטסאפ יוצאות רק לנייד.';
  if (/not authorized/i.test(message)) return 'אין לך הרשאה להוסיף טלפון ללקוח הזה.';
  return 'לא הצלחנו להוסיף את המספר. נסו שוב בעוד רגע.';
}
