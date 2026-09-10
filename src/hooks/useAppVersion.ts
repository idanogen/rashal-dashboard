import { useEffect, useState } from 'react'
import {
  BUILD_ID,
  FETCH_FAILED_EVENT,
  fetchLatestBuildId,
  isStaleBuild,
} from '@/lib/app-version'

/** כל עשר דקות. הבדיקה היא קובץ של כמה עשרות בתים. */
const POLL_MS = 10 * 60 * 1000

/**
 * "האם הלשונית הזאת מריצה קוד ישן".
 *
 * 🔴 **דרך אחת לכיוון אחד.** ברגע שנקבע שהקוד ישן הוא נשאר ישן עד רענון.
 * בדיקה שמחזירה `null` בפעם הבאה (רשת שגמגמה) לא מורידה את הפס, אחרת הוא
 * היה מהבהב בדיוק כשהרשת בעייתית.
 *
 * ⭐ נבדק בשלושה רגעים: בעלייה, בכל חזרה ללשונית, ובכל שליפה שנכשלה.
 * החזרה ללשונית היא הרגע הכי סביר שבו הפריסה קרתה בינתיים.
 */
export function useAppVersion(): { stale: boolean } {
  const [stale, setStale] = useState(false)

  useEffect(() => {
    if (BUILD_ID === 'dev') return
    let alive = true
    const controller = new AbortController()

    const check = async () => {
      if (!alive) return
      const latest = await fetchLatestBuildId(controller.signal)
      if (!alive) return
      if (isStaleBuild(BUILD_ID, latest)) setStale(true)
    }

    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    window.addEventListener(FETCH_FAILED_EVENT, onFocus)

    return () => {
      alive = false
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener(FETCH_FAILED_EVENT, onFocus)
    }
  }, [])

  return { stale }
}
