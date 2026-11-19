// ─────────────────────────────────────────────────────────────────
// מסלול לפי כבישים דרך שירות המפות המרכזי (ogen-geo-service).
// נקודות בסדר המסלול → path אמיתי לאורך הכבישים + מרחק/זמן.
// אותו VITE_GEO_SERVICE_URL של ה-geocoding.
//
// GET /api/directions?points=lat,lng;lat,lng;...
//   → 200 {result:{path:[[lat,lng],...],distanceKm,durationMin,legs}}  מסלול אמיתי
//   → 200 {result:null}   לא זמין → הקורא יצייר קו ישר (לא לשבור את המפה)
// ─────────────────────────────────────────────────────────────────

import { buildRouteRequest, mergeRouteOrder, type RouteStopInput } from './route-order';

const BASE = (import.meta.env.VITE_GEO_SERVICE_URL as string | undefined)?.replace(/\/$/, '') || '';

export interface RoadRoute {
  /** נקודות הקו לאורך הכבישים. */
  path: [number, number][];
  distanceKm: number;
  durationMin: number;
  legs?: unknown[];
}

export interface RoadRouteOptions {
  /** אם true — השירות רשאי לסדר מחדש את העצירות. ברירת מחדל: שומר על הסדר. */
  optimize?: boolean;
}

const cache = new Map<string, RoadRoute | null>();

/**
 * מחזיר מסלול לפי כבישים עבור רשימת נקודות [lat,lng] בסדר הנסיעה.
 * @returns RoadRoute, או null כשהשירות לא זמין/לא מצא (הקורא ייפול לקו ישר).
 */
export async function getRoadRoute(
  points: [number, number][],
  opts: RoadRouteOptions = {}
): Promise<RoadRoute | null> {
  if (!Array.isArray(points) || points.length < 2) return null;
  if (!BASE) return null;

  const pointsStr = points.map((p) => `${p[0]},${p[1]}`).join(';');
  const key = `${pointsStr}|${opts.optimize ? 1 : 0}`;
  if (cache.has(key)) return cache.get(key)!;

  try {
    const u = new URL(`${BASE}/api/directions`);
    u.searchParams.set('points', pointsStr);
    if (opts.optimize) u.searchParams.set('optimize', '1');
    const res = await fetch(u.toString());
    if (!res.ok) return null; // כשל זמני — לא לשמור ב-cache, ננסה שוב
    const data = await res.json();
    const r = data?.result;
    if (!r || !Array.isArray(r.path) || r.path.length < 2) {
      cache.set(key, null);
      return null;
    }
    const result: RoadRoute = {
      path: r.path as [number, number][],
      distanceKm: Number(r.distanceKm),
      durationMin: Number(r.durationMin),
      legs: r.legs,
    };
    cache.set(key, result);
    return result;
  } catch {
    return null; // כשל רשת — לא לשמור, ננסה שוב בפעם הבאה
  }
}

export interface OptimizedOrder {
  /** הסדר הסופי: מה שהמרכז סידר, ואחריו עצירות בלי נקודה. */
  orderedIds: string[];
  distanceKm: number;
  durationMin: number;
  unresolvableCount: number;
}

/**
 * סידור עצירות לפי כבישים דרך מרכז המיקום (`POST /api/v2/route`).
 * 🔴 אין נפילה שקטה לאלגוריתם מקומי: כשל מוחזר כשגיאה והמסך אומר את זה.
 */
export async function optimizeRouteOrder(
  stops: RouteStopInput[],
  warehouse: { lat: number; lng: number },
): Promise<OptimizedOrder> {
  if (!BASE) throw new Error('שירות המפות לא מוגדר');
  const { body, withoutCoords } = buildRouteRequest(stops, warehouse);
  if (body.stops.length < 2) throw new Error('אין מספיק עצירות עם מיקום כדי לסדר');
  const res = await fetch(`${BASE}/api/v2/route`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-geo-client': 'rashal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`שירות המפות לא זמין כרגע (${res.status}), נסו שוב בעוד רגע`);
  const r = (await res.json())?.result;
  const orderedIds = mergeRouteOrder(body.stops.map((s) => s.id), r?.order, withoutCoords);
  if (!orderedIds) throw new Error('שירות המפות החזיר סדר חלקי, הסדר לא שונה');
  return {
    orderedIds,
    distanceKm: Math.round(Number(r.distanceKm) || 0),
    durationMin: Math.round(Number(r.durationMin) || 0),
    unresolvableCount: withoutCoords.length,
  };
}
