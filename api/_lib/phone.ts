// Duplicated here (not imported from src/) because /api functions run in Node
// and src/ uses Vite-specific import.meta.env. Keep these two files in sync if
// you change either: src/lib/heyy/phone.ts ↔ api/_lib/phone.ts

export function toE164(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972')) return '+' + digits;
  if (digits.startsWith('0')) return '+972' + digits.slice(1);
  return '+' + digits;
}

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('972') && digits.length === 12) return '0' + digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits;
  // 🔴 תשע ספרות שמתחילות באפס הן **קו נייח שלם** (03-6221100), לא נייד
  // חסר. הגרסה הקודמת הוסיפה כאן אפס לכל מספר בן תשע ספרות והפכה
  // `036221100` ל-`0036221100`, כלומר **כל לקוח עם טלפון קווי לא הצטלב
  // לעולם**. תשע ספרות בלי אפס מוביל (523694547) כן חסרות אותו.
  if (digits.length === 9) return digits.startsWith('0') ? digits : '0' + digits;
  return digits;
}
