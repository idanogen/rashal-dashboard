/**
 * הכתובת שנשלחת לוויז (אבי, 18/11/2026: "הוויז לא מדייק"). קובץ טהור, מסונכרן
 * לאפליקציה ב-`npm run sync-forms` (שם: lib/forms/shared/nav-address.ts).
 *
 * 🔴 עד היום הכפתור שלח לוויז את הנקודה מהמיפוי שלנו כשהייתה. אצל "העמל 6, רמת גן"
 * הנקודה לא הייתה מדויקת, ואבי חיפש בוויז בעצמו. המיפוי של וויז מדויק יותר משלנו
 * בכתובת עם מספר בית, ולכן: כתובת עם מספר = טקסט נקי לוויז; בלי מספר (מוסד,
 * יישוב קטן) = הנקודה שלנו, אם יש.
 *
 * ⭐ ניקוי: "(דירה 17)", "קומה 3", "כניסה ב" מבלבלים את החיפוש של וויז. כ-20%
 * מהכתובות בשבוע 11-18/11 כללו אותם.
 */

export function cleanNavAddress(address: string | null | undefined): string {
  return (address ?? '')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(?:^|[\s,])(?:דירה|דיר['׳]|קומה|כניסה)\s*[:.]?\s*[^\s,]*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .trim();
}

/** יש בכתובת מספר בית. בלי מספר וויז מנווט לנקודה כללית ברחוב. */
export function addressHasNumber(address: string | null | undefined): boolean {
  return /\d/.test(cleanNavAddress(address));
}

export interface NavTarget {
  address?: string | null;
  city?: string | null;
  coordinates?: { lat: number; lng: number } | null;
}

export function wazeUrlFor(t: NavTarget): string | null {
  const street = cleanNavAddress(t.address);
  const city = (t.city ?? '').trim();
  const text = [street, city].filter(Boolean).join(', ');
  const c = t.coordinates;
  const hasCoords = !!c && Number.isFinite(c.lat) && Number.isFinite(c.lng);
  if (street && addressHasNumber(street)) return `https://waze.com/ul?q=${encodeURIComponent(text)}&navigate=yes`;
  if (hasCoords) return `https://waze.com/ul?ll=${c!.lat},${c!.lng}&navigate=yes`;
  if (text) return `https://waze.com/ul?q=${encodeURIComponent(text)}&navigate=yes`;
  return null;
}
