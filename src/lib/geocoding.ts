import type { Order } from '@/types/order';
import { geocodeQuery } from './geocode-query';
import { getCityCenter } from './city-centers';

/**
 * קואורדינטות גיאוגרפיות (latitude, longitude)
 */
export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * הזמנה עם קואורדינטות גיאוגרפיות
 */
export interface GeocodedOrder extends Order {
  coordinates?: Coordinates;
}

/**
 * מרכז היישוב לפי שם העיר, ממרכז המיקום (`src/lib/city-centers.ts`).
 * 🔴 19/11/2026: עד היום טבלה ידנית של כמאה ערים; מה שלא היה בה לא קיבל מיקום.
 */
export function getCityCoordinates(city: string | undefined | null): Coordinates | undefined {
  return getCityCenter(city);
}

export function geocodeOrderByCity(order: Order): GeocodedOrder {
  return {
    ...order,
    coordinates: getCityCoordinates(order.city),
  };
}

/**
 * מחזיר רשימת הזמנות שלא נמצאו להן קואורדינטות
 */
export function getUnmappedOrders(orders: Order[]): Order[] {
  return orders.filter((o) => !geocodeOrderByCity(o).coordinates);
}

/**
 * חישוב מרחק בין שתי נקודות גיאוגרפיות בק"מ
 * משתמש בנוסחת Haversine
 * @param coord1 - קואורדינטות נקודה 1
 * @param coord2 - קואורדינטות נקודה 2
 * @returns מרחק בק"מ
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371; // רדיוס כדור הארץ בק"מ

  const dLat = toRadians(coord2.lat - coord1.lat);
  const dLng = toRadians(coord2.lng - coord1.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(coord1.lat)) *
      Math.cos(toRadians(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * המרת מעלות לרדיאנים
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// ─────────────────────────────────────────────────────────────────
// מנוע geocoding דרך שירות המפות המרכזי (ogen-geo-service)
// כתובת → נקודה מדויקת (Google + אימות עיר מול מסד הדואר).
// השירות מחזיר פין מדויק או null (משוער); הקורא נופל אז למרכז העיר.
// תור סדרתי קל (~350ms) + session cache. תשובת 503/502 לא נשמרת — ננסה שוב.
//
// החתימה וצורת הערך המוחזר זהות לגרסת Nominatim הקודמת —
// אף קורא של geocodeAddress לא צריך להשתנות.
// ─────────────────────────────────────────────────────────────────

export interface GeocodeResult {
  lat: number;
  lng: number;
  displayName: string;
  /** מקור הפין מהשירות המרכזי. אופציונלי — לא נדרש ע"י הקוראים. */
  source?: string; // מה המרכז השתמש בו (google · nominatim · llm+google ...)
}

export interface GeocodeOptions {
  /** עיר העצירה — מועברת לשירות לאימות שהתוצאה לא "ברחה" לעיר אחרת. */
  city?: string;
}

/** כתובת השירות המרכזי. נקראת מ-import.meta.env (לא סוד — רק URL). */
const BASE = (import.meta.env.VITE_GEO_SERVICE_URL as string | undefined)?.replace(/\/$/, '') || '';
const REQUEST_GAP_MS = 350;

const sessionCache = new Map<string, GeocodeResult | null>();
let queueTail: Promise<void> = Promise.resolve();
let lastRequestAt = 0;
let warnedNoBase = false;

/** מריץ jobs בטור עם מרווח מינימלי ביניהם (תור סדרתי קל מול השירות). */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const wait = lastRequestAt + REQUEST_GAP_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    try {
      return await job();
    } finally {
      lastRequestAt = Date.now();
    }
  });
  queueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/**
 * פונה למרכז המיקום (`/api/v2/locate`), שמנקה את הכתובת לפני החיפוש
 * ("דירה 5", "16/39", מיקוד בשם העיר, קיצורים, הערות בשדה הכתובת). מחזיר:
 *  - GeocodeResult  → נקודה ברמת בית או רחוב (`precision` address/street)
 *  - null           → תשובה ודאית בלי נקודה כזאת (city/none: הקורא ייפול למרכז העיר)
 *  - 'transient'    → כשל זמני (5xx/רשת): לא לשמור במטמון ולא לרשום כישלון
 */
async function fetchGeocode(
  address: string,
  city?: string
): Promise<GeocodeResult | null | 'transient'> {
  try {
    const u = new URL(`${BASE}/api/v2/locate`);
    u.searchParams.set('address', geocodeQuery(address, city));
    if (city) u.searchParams.set('city', city);
    const res = await fetch(u.toString(), { headers: { 'x-geo-client': 'rashal' } });
    if (!res.ok) return 'transient';
    const data = await res.json();
    const r = data?.result;
    if (!r || (r.precision !== 'address' && r.precision !== 'street')) return null;
    // נקודה בלי יישוב מוכרע לא נשמרת: בלי עיר המרכז עלול למקם רחוב בעיר אחרת
    // ("פורת 206" נחת בבאר שבע, סעדה 19/11).
    if (!r.city) return null;
    const lat = Number(r.lat);
    const lng = Number(r.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      lat,
      lng,
      displayName: r.displayName || address,
      source: r.source,
    };
  } catch {
    return 'transient'; // כשל רשת — ננסה שוב
  }
}

/**
 * geocoding מלא לכתובת דרך שירות המפות המרכזי.
 * תמיד מעביר את העיר לשירות (geocodeAddress(address, { city })).
 * @returns נקודה מדויקת, null (תשובה ודאית: לא נמצא / משוער), או 'transient'.
 * 🔴 19/11/2026: עד היום כשל זמני חזר כ-null, והקורא רשם אותו ככישלון עם צינון
 * של 30 יום. 18 מתוך 28 כתובות "שנכשלו" נמצאו כשנוסו שוב בלי לשנות אות.
 */
export async function geocodeAddress(
  address: string,
  opts: GeocodeOptions = {}
): Promise<GeocodeResult | null | 'transient'> {
  const trimmed = address.trim();
  if (!trimmed) return null;
  const { city } = opts;

  if (!BASE) {
    if (!warnedNoBase) {
      console.warn('[geocode] VITE_GEO_SERVICE_URL לא מוגדר — נופלים למרכז העיר');
      warnedNoBase = true;
    }
    return null;
  }

  const cacheKey = city ? `${trimmed}|${city.trim()}` : trimmed;
  if (sessionCache.has(cacheKey)) return sessionCache.get(cacheKey)!;

  return enqueue(async () => {
    if (sessionCache.has(cacheKey)) return sessionCache.get(cacheKey)!;
    const result = await fetchGeocode(trimmed, city);
    if (result === 'transient') return 'transient'; // לא שומרים במטמון, והקורא לא רושם כישלון
    sessionCache.set(cacheKey, result); // result מדויק או null (משוער) — שניהם נשמרים
    return result;
  });
}
