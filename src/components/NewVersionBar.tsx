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

  return (
    <div className="border-b border-amber-300 bg-amber-100 text-amber-950">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-start gap-x-3 gap-y-1.5 px-4 py-2 text-[13px] sm:px-6">
        <RefreshCw className="h-4 w-4 shrink-0" />
        <span className="font-medium">
          יצאה גרסה חדשה של המערכת. עד רענון המסך עלול להציג נתונים חלקיים.
        </span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-md bg-amber-700 px-3 py-1 text-[12px] font-semibold text-white transition-colors hover:bg-amber-800"
        >
          רענן עכשיו
        </button>
      </div>
    </div>
  )
}
