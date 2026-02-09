import type { Order } from '@/types/order';

/** Build a Google Maps search URL for a single address */
export function buildSingleMapUrl(order: Order): string | null {
  if (!order.address) return null;
  const query = `${order.address}${order.city ? ', ' + order.city : ''}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Build a Google Maps directions URL with multiple waypoints.
 * Format: https://www.google.com/maps/dir/?api=1&origin=A&destination=Z&waypoints=B|C|D
 * Google Maps supports origin + destination + up to ~9 waypoints in the URL.
 */
export function buildRouteUrl(orders: Order[], originAddress?: string): string {
  const addresses = orders
    .map((o) => `${o.address}, ${o.city}`)
    .filter(Boolean);

  if (addresses.length === 0) return '';

  if (addresses.length === 1) {
    const dest = originAddress ? addresses[0] : addresses[0];
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${
      originAddress ? `&origin=${encodeURIComponent(originAddress)}` : ''
    }&travelmode=driving`;
  }

  const origin = originAddress || addresses[0];
  const destination = addresses[addresses.length - 1];
  const waypoints = originAddress ? addresses.slice(0, -1) : addresses.slice(1, -1);

  const params = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
  });

  if (waypoints.length > 0) {
    params.set('waypoints', waypoints.join('|'));
  }

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/** Maximum stops Google Maps URL supports (origin + destination + ~9 waypoints) */
export const MAX_GOOGLE_MAPS_STOPS = 11;
