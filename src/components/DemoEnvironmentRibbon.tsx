/**
 * סרט "סביבת דמו".
 *
 * הסביבה הזו מדברת אל אותו מסד נתונים של הפרודקשן, ולכן חייב להיות ברור
 * במבט אחד היכן נמצאים. בלי סימון, מישהו מצלם מסך בפגישה ובעוד שבוע יש
 * בלבול על מה כבר קיים במערכת האמיתית.
 *
 * נדלק רק כשהמשתנה מוגדר, כדי שהרכיב יוכל לחיות בקוד גם אחרי מיזוג
 * לפרודקשן בלי להופיע שם.
 */
export function DemoEnvironmentRibbon() {
  if (import.meta.env.VITE_DEMO_ENV !== 'true') return null;

  return (
    <div
      dir="rtl"
      className="sticky top-0 z-[60] flex items-center justify-center gap-2 bg-amber-400 px-3 py-1.5 text-center text-xs font-bold text-amber-950 shadow-sm"
    >
      <span className="inline-block h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-900" />
      סביבת דמו · תהליכים בבדיקה שטרם אושרו · אינה המערכת החיה
    </div>
  );
}
