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
  if (digits.startsWith('972') && digits.length === 12) return '0' + digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits;
  if (digits.length === 9) return '0' + digits;
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
