/**
 * 🔴 11/11/2026 (עמי ושלומי): ההערה שהמשרד כותב בתיאום ("לא בבית, הטיפול בבית
 * הספר") משנה לטכנאי לאן לנסוע, ולכן היא מוצגת באדום בכרטיס ובפרטי הקריאה,
 * בווב ובאפליקציה. במשימה ובביקור לקוח `notes` הוא תיאור העבודה עצמה, ושם הוא
 * נשאר רגיל. קובץ טהור: מסונכרן לאפליקציה ב-`npm run sync-forms`.
 */
export const OFFICE_NOTE_SOURCES = ['service', 'delivery', 'pickup'] as const;

export function officeAlertNote(stop: { sourceType?: string | null; notes?: string | null }): string | null {
  const note = stop.notes?.trim();
  if (!note) return null;
  return (OFFICE_NOTE_SOURCES as readonly string[]).includes(stop.sourceType ?? '') ? note : null;
}
