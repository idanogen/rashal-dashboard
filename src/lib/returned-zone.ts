/**
 * "חזרו מהקו" במסך הסדרן עובר את אותו סינון אזור כמו הרשימה הממתינה.
 * 🔴 24/11/2026, מיכאל יאצקו (מנהל סניף צפון): אחרי סינון לצפון "אספקות שחזרו מהקו"
 * ו"איסופים שחזרו מהקו" הציגו את כל הארץ. אין אזורים נבחרים = הכל.
 * קובץ טהור בלי ייבוא, כדי שייבדק ב-node --test.
 */
export function inSelectedZones<T extends { zoneId: string }>(items: T[], zones: string[]): T[] {
  return zones.length > 0 ? items.filter((i) => zones.includes(i.zoneId)) : items;
}
