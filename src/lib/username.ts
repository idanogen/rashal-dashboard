import { USERNAME_EMAIL_DOMAIN } from '@/types/profile';

/**
 * Normalize a login handle to a canonical form.
 * MUST stay identical to `normalizeUsername` in api/admin-users.ts, otherwise a
 * Hebrew handle would hash to a different synthetic email at login than at
 * creation, and the user could not sign in.
 */
export function normalizeUsername(raw: string): string {
  return raw.trim().normalize('NFC').toLowerCase();
}

/** Pure-ASCII handles (the legacy form) keep their plain synthetic email. */
const ASCII_HANDLE = /^[a-zA-Z0-9._-]+$/;

/**
 * Derive the synthetic Supabase Auth email for a login handle.
 *
 * - ASCII handles → `{handle}@rashal.internal` (legacy form — keeps existing
 *   users working unchanged).
 * - Non-ASCII handles (e.g. Hebrew) → `u{sha256-hex[:40]}@rashal.internal`,
 *   because GoTrue rejects non-ASCII email local parts ("invalid format").
 *
 * MUST stay byte-for-byte identical to `usernameToEmail` in api/admin-users.ts.
 */
export async function usernameToEmail(rawUsername: string): Promise<string> {
  const username = normalizeUsername(rawUsername);
  if (ASCII_HANDLE.test(username)) return `${username}@${USERNAME_EMAIL_DOMAIN}`;
  const bytes = new TextEncoder().encode(username);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `u${hex.slice(0, 40)}@${USERNAME_EMAIL_DOMAIN}`;
}
