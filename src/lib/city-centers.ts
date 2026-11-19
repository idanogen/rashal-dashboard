/**
 * מרכז היישוב לכל שם עיר כפי שהגיע מפריוריטי, ממרכז המיקום
 * (ogen-geo-service, `POST /api/v2/cities/match`).
 *
 * 🔴 החליף ב-19/11/2026 טבלת ערים ידנית של כמאה ערים. אלקנה, יפיע, ריינה,
 * כפר הנשיא ועשרות אחרים לא היו בה, ולכן לא קיבלו מיקום בכלל, ו"סדר מחדש
 * מהמחסן" זרק אותם לסוף המסלול. ההתאמה (כתיב כפול, קיצורים, מיקוד שנדבק
 * לשם) חיה רק במרכז, כאן רק מטמון: שם גולמי → נקודה או null.
 *
 * `getCityCenter` סינכרוני כי המיפוי של שורות העצירות סינכרוני. לכן
 * `primeCityCenters` נקרא לפני המיפוי, עם תקרת זמן, ולא זורק לעולם.
 */

export interface CityCenter {
  lat: number;
  lng: number;
}

const BASE = (import.meta.env.VITE_GEO_SERVICE_URL as string | undefined)?.replace(/\/$/, '') || '';
const STORAGE_KEY = 'geo:cityCenters:v2';
const PRIME_TIMEOUT_MS = 4000;

/** null = המרכז ענה בוודאות שאין יישוב כזה. חסר = עוד לא נשאל. */
const cache = new Map<string, CityCenter | null>();

try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as Record<string, CityCenter | null>;
  for (const [k, v] of Object.entries(saved)) cache.set(k, v);
} catch {
  // אחסון חסום או פגום: מתחילים ריק, המרכז ימלא.
}

function persist() {
  try {
    // רק התאמות נשמרות בדפדפן. "אין יישוב כזה" נשאר בזיכרון בלבד, כדי ששיפור
    // במרכז (שכונה → עיר, כתיב חדש) יגיע גם למי שכבר שאל פעם.
    const found = [...cache].filter(([, v]) => v !== null);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(found)));
  } catch {
    // אחסון מלא או חסום: המטמון בזיכרון עדיין עובד בסשן הזה.
  }
}

const keyOf = (city: string) => city.trim().replace(/\s+/g, ' ');

/** מרכז היישוב מהמטמון, או undefined אם לא ידוע. */
export function getCityCenter(city: string | undefined | null): CityCenter | undefined {
  if (!city || !city.trim()) return undefined;
  return cache.get(keyOf(city)) ?? undefined;
}

/**
 * שואל את המרכז על שמות שעוד לא במטמון. כשל זמני לא נשמר (ננסה בטעינה הבאה).
 * @returns האם נוסף משהו למטמון
 */
export async function primeCityCenters(cities: (string | null | undefined)[]): Promise<boolean> {
  if (!BASE) return false;
  const missing = [...new Set(cities.filter((c): c is string => !!c && !!c.trim()).map(keyOf))]
    .filter((c) => !cache.has(c))
    .slice(0, 500);
  if (missing.length === 0) return false;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PRIME_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}/api/v2/cities/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-geo-client': 'rashal' },
      body: JSON.stringify({ names: missing }),
      signal: ctrl.signal,
    });
    if (!res.ok) return false;
    const result = (await res.json())?.result as Record<string, { lat: number; lng: number } | null> | undefined;
    if (!result) return false;
    for (const name of missing) {
      if (!(name in result)) continue;
      const m = result[name];
      const lat = Number(m?.lat);
      const lng = Number(m?.lng);
      cache.set(name, m && Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null);
    }
    persist();
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
