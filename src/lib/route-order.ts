/**
 * סידור עצירות של נהג ליום, דרך מרכז המיקום (ogen-geo-service, `POST /api/v2/route`).
 *
 * 🔴 נולד 19/11/2026 מתלונה של אבירם: "סדר מחדש מהמחסן" הריץ שכן-קרוב בקו אוויר
 * לפי טבלת ערים ידנית, ואלקנה (שחסרה בטבלה) נזרקה לסוף. על שש העצירות של אבי
 * ל-22/11: הסדר הישן 224 ק"מ, הידני של אבירם 169, המרכז (גוגל, לפי כבישים) 168.
 * המוח במרכז ולא כאן, כדי שר.שעל, סעדה ובי ספורט יקבלו אותו סדר מאותו מקום.
 *
 * 🔴 הקובץ בלי שום ייבוא בכוונה, כדי שייבדק ביחידה.
 */

export interface RouteStopInput {
  id: string;
  /** נקודה מדויקת או מרכז העיר; בלי נקודה העצירה לא נשלחת ונכנסת בסוף. */
  coordinates?: { lat: number; lng: number };
}

export interface RouteRequestBody {
  start: [number, number];
  end: [number, number] | null;
  stops: { id: string; lat: number; lng: number }[];
}

/** בונה את גוף הבקשה למרכז, ואת מי שלא נשלח כי אין לו נקודה. */
export function buildRouteRequest(
  stops: RouteStopInput[],
  warehouse: { lat: number; lng: number },
): { body: RouteRequestBody; withoutCoords: string[] } {
  const located = stops.filter((s) => s.coordinates);
  return {
    body: {
      start: [warehouse.lat, warehouse.lng],
      // היום והלאה: המסלול חוזר למחסן, כמו האלגוריתם הקודם וכמו בבי ספורט.
      end: [warehouse.lat, warehouse.lng],
      stops: located.map((s) => ({ id: s.id, lat: s.coordinates!.lat, lng: s.coordinates!.lng })),
    },
    withoutCoords: stops.filter((s) => !s.coordinates).map((s) => s.id),
  };
}

/**
 * הסדר הסופי: מה שהמרכז החזיר, ואחריו מי שלא נשלח.
 * מחזיר null אם התשובה לא מכסה בדיוק את מה שנשלח, כדי שלא נאבד עצירה בשקט.
 */
export function mergeRouteOrder(
  sent: string[],
  returned: unknown,
  withoutCoords: string[],
): string[] | null {
  if (!Array.isArray(returned) || returned.length !== sent.length) return null;
  const want = new Set(sent);
  const seen = new Set<string>();
  for (const id of returned) {
    if (typeof id !== 'string' || !want.has(id) || seen.has(id)) return null;
    seen.add(id);
  }
  return [...(returned as string[]), ...withoutCoords];
}
