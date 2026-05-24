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
  if (digits.length === 9) return '0' + digits;
  return digits;
}
