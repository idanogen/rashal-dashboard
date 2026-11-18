import { wazeUrlFor } from './nav-address';

/**
 * Helpers for building navigation + contact links for delivery stops.
 *
 * - Waze: the rule lives in `nav-address.ts` (shared with the app): an address with a
 *   house number goes as clean text, otherwise our lat/lng (Avi, 18/11/2026).
 * - Phone: `tel:` URI with Israeli number normalization.
 */

export interface StopLocation {
  address?: string | null;
  city?: string | null;
  coordinates?: { lat: number; lng: number } | null;
}

export function buildWazeUrl(loc: StopLocation): string | null {
  return wazeUrlFor(loc);
}

export function buildTelUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  return `tel:${digits}`;
}
