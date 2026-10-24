/**
 * 0523694547 → +972523694547
 * 972523694547 → +972523694547
 * +972523694547 → +972523694547
 */
export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0')) return '+972' + digits.slice(1);
  return '+' + digits;
}

/**
 * Any format → 0523694547 (10 digits, starts with 0)
 * Used to match against orders.phone which stores Israeli local format.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  // 🔴 E164 נייד הוא 12 ספרות (972523694547) וקווי הוא 11 (97236221100).
  // בדיקת 12 בלבד החזירה קווי בינלאומי כמות שהוא, בלי אפס מוביל.
  if (digits.startsWith('972') && (digits.length === 11 || digits.length === 12)) return '0' + digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits;
  // 🔴 תשע ספרות שמתחילות באפס הן **קו נייח שלם** (03-6221100), לא נייד
  // חסר. הגרסה הקודמת הוסיפה כאן אפס לכל מספר בן תשע ספרות והפכה
  // `036221100` ל-`0036221100`, כלומר **כל לקוח עם טלפון קווי לא הצטלב
  // לעולם**. תשע ספרות בלי אפס מוביל (523694547) כן חסרות אותו.
  if (digits.length === 9) return digits.startsWith('0') ? digits : '0' + digits;
  return digits;
}

/**
 * Visual format for display in UI: 052-369-4547
 */
export function formatPhoneForDisplay(phone: string | null | undefined): string {
  const local = normalizePhone(phone);
  if (!local || local.length !== 10) return phone ?? '';
  return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
}
