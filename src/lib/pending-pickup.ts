/**
 * איסוף שממתין לתיאום. ⭐ מקור אחד למסך הסדרן ולמסך "הבוקר שלי" (25/11/2026).
 * רשת ביטחון: איסוף שכבר נאסף או בוטל בפריוריטי לא נחשב ממתין גם אם הסטטוס אצלנו לא זז.
 * קובץ טהור בלי ייבוא, נבדק ב-test/pending-pickup.test.mjs.
 */
export function isPendingPickup(p: {
  duplicateOf?: string | null;
  pickupStatus?: string | null;
  priorityStatus?: string | null;
}): boolean {
  return (
    !p.duplicateOf &&
    (p.pickupStatus ?? 'ממתין לתאום') === 'ממתין לתאום' &&
    p.priorityStatus !== 'סופית' &&
    p.priorityStatus !== 'מבוטלת'
  );
}
