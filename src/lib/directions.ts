// ─────────────────────────────────────────────────────────────────
// מסלול לפי כבישים דרך שירות המפות המרכזי (ogen-geo-service).
// נקודות בסדר המסלול → path אמיתי לאורך הכבישים + מרחק/זמן.
// אותו VITE_GEO_SERVICE_URL של ה-geocoding.
//
// GET /api/directions?points=lat,lng;lat,lng;...
//   → 200 {result:{path:[[lat,lng],...],distanceKm,durationMin,legs}}  מסלול אמיתי
//   → 200 {result:null}   לא זמין → הקורא יצייר קו ישר (לא לשבור את המפה)
// ─────────────────────────────────────────────────────────────────

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
