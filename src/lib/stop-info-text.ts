/** שעה ותאריך בשעון ישראל ונוסחי שגיאה לחלונית העצירה. בלי ייבוא. */
const TZ = 'Asia/Jerusalem';

export const hhmm = (iso: string) =>
  iso ? new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ }) : '';

export const ddmm = (iso: string) =>
  iso ? new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', timeZone: TZ }) : '';

export function friendlyError(message: string): string {
  return /not authorized/i.test(message)
    ? 'הפרטים של העצירה הזאת פתוחים רק למי שהיא משובצת אצלו.'
    : 'לא הצלחנו לטעון את הפרטים. נסו שוב בעוד רגע.';
}
