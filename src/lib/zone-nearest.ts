/**
 * אזור ליישוב שלא ברשימת הערים הידנית (`CITY_TO_ZONE`), לפי הנקודה שלו ממרכז המיקום.
 *
 * 🔴 23/11/2026: שלומי סינן "צפון" ולא מצא את ח'טיב ח'אלד מדיר חנא. 40 מ-145
 * הקריאות הפתוחות היו ביישוב שלא ברשימה (דיר חנא, עראבה, שפרעם, עתלית, פ"ת),
 * ולכן בלי אזור, וכל סינון אזור הסתיר אותן. האזור נקבע עכשיו לפי העיר הקרובה
 * ביותר מהרשימה. כינוי (פ"ת, ת"א) נופל על אותה נקודה, מרחק 0.
 *
 * קובץ טהור בלי ייבוא, כדי שייבדק ב-node --test.
 */

export interface ZonePoint {
  lat: number;
  lng: number;
}

/** מעבר למרחק הזה מכל עיר ברשימה היישוב נשאר בלי אזור, כדי לא לנחש. */
export const MAX_ZONE_DISTANCE_KM = 40;

export function distanceKm(a: ZonePoint, b: ZonePoint): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

/**
 * @param point נקודת היישוב
 * @param anchors ערים ידועות: נקודה ואזור
 * @returns האזור של העיר הקרובה, או undefined אם אין עיר בטווח
 */
export function nearestZone(
  point: ZonePoint | undefined,
  anchors: { point: ZonePoint; zoneId: string }[],
): string | undefined {
  if (!point) return undefined;
  let best: string | undefined;
  let bestKm = MAX_ZONE_DISTANCE_KM;
  for (const a of anchors) {
    const km = distanceKm(point, a.point);
    if (km <= bestKm) {
      bestKm = km;
      best = a.zoneId;
    }
  }
  return best;
}
