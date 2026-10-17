import { RefreshCw } from 'lucide-react'
import { useAppVersion } from '@/hooks/useAppVersion'

/**
 * פס "יצאה גרסה חדשה, רענן".
 *
 * ⭐ **מדבר על התוצאה ולא על המנגנון.** לסדרנית לא אכפת מגרסאות; אכפת לה
 * שהמסך עלול להראות פחות ממה שיש. לכן המשפט מדבר על נתונים חלקיים,
 * והכפתור עושה את הפעולה במקומה במקום להסביר צירוף מקשים.
 *
 * 🔴 מרווחים לוגיים (`ms`) ולא פיזיים, המסך כולו מימין לשמאל.
 */
export function NewVersionBar() {
  const { stale } = useAppVersion()
  if (!stale) return null
  return <NewVersionBanner />
}

/** הפס עצמו, בלי הבדיקה. מיוצא לעמוד התצוגה. */
export function NewVersionBanner() {

  // ⭐ 13/10/2026, עידן: "שורה בראש המערכת של יש גרסה חדשה, בבקשה לרענן, כמו
  // שעשינו אצל שחורי". הפס הקודם ישב בתוך הזרימה בצבע עדין ונבלע. עכשיו הוא
  // צמוד לראש החלון מעל הכל, בולט, וכפתור גדול שעושה את הרענון.
  return (
    <div
      role="alert"
      dir="rtl"
      className="fixed inset-x-0 top-0 z-[200] bg-amber-500 text-amber-950 shadow-[0_6px_24px_rgba(0,0,0,0.25)]"
      style={{ paddingTop: 'env(safe-area-inset-top)' }}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
        <RefreshCw className="h-5 w-5 shrink-0 motion-safe:animate-spin [animation-duration:3s]" aria-hidden />
        <div className="min-w-0 flex-1 leading-snug">
          <p className="text-[15px] font-extrabold">יש גרסה חדשה של המערכת</p>
          <p className="text-[12.5px] font-medium">בבקשה לרענן את המסך. עד הרענון המסך עלול להציג נתונים חלקיים.</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="h-10 shrink-0 rounded-xl bg-amber-950 px-4 text-[14px] font-bold text-white transition-colors hover:bg-black"
        >
          רענן עכשיו
        </button>
      </div>
    </div>
  )
}
