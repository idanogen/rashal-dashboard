/**
 * Helpers for building navigation + contact links for delivery stops.
 *
 * - Waze: public URL scheme `https://waze.com/ul?...&navigate=yes`.
 *   Prefer lat/lng when available (most accurate), fall back to address text.
 * - Phone: `tel:` URI with Israeli number normalization.
 */

export interface StopLocation {
  address?: string | null;
  coordinates?: { lat: number; lng: number } | null;
}

export function buildWazeUrl(loc: StopLocation): string | null {
  if (
    loc.coordinates &&
    Number.isFinite(loc.coordinates.lat) &&
    Number.isFinite(loc.coordinates.lng)
  ) {
    return `https://waze.com/ul?ll=${loc.coordinates.lat},${loc.coordinates.lng}&navigate=yes`;
  }
  if (loc.address && loc.address.trim()) {
    return `https://waze.com/ul?q=${encodeURIComponent(loc.address.trim())}&navigate=yes`;
  }
  return null;
}

export function buildTelUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  if (!digits) return null;
  return `tel:${digits}`;
}
