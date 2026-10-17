import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import {
  BUILD_ID,
  FETCH_FAILED_EVENT,
  autoReloadReason,
  fetchLatestBuildId,
  guardAllows,
  isStaleBuild,
  parseGuard,
} from '@/lib/app-version'

/**
 * כל דקה, רק כשהמסך גלוי. הבדיקה היא קובץ של כמה עשרות בתים.
 * (13/10/2026: היה עשר דקות; עידן ביקש פס כמו בשחורי, שנבדק כל דקה.)
 */
const POLL_MS = 60 * 1000
/** כל כמה זמן בודקים אם הגיע רגע בטוח לרענון, כשכבר ידוע שיש גרסה חדשה. */
const SAFE_CHECK_MS = 10 * 1000
const GUARD_KEY = 'rashal:autoReload'

function readGuard() {
  try { return parseGuard(sessionStorage.getItem(GUARD_KEY)) } catch { return null }
}

/**
 * רענון לבד, עם רישום בשומר. מחזיר false כשהשומר חוסם (כבר רעננו לגרסה
 * הזאת לאחרונה), ואז נשאר רק הפס.
 */
function reloadFor(latest: string): boolean {
  if (!guardAllows(latest, readGuard(), Date.now())) return false
  try { sessionStorage.setItem(GUARD_KEY, JSON.stringify({ build: latest, at: Date.now() })) } catch { /* פרטי */ }
  window.location.reload()
  return true
}

/** חלון פתוח (Radix מסמן role=dialog) או טקסט בתיבת כתיבה. */
function pageBusy(): { openDialog: boolean; draftText: boolean } {
  const openDialog = !!document.querySelector('[role="dialog"], [role="alertdialog"]')
  const draftText = Array.from(document.querySelectorAll<HTMLElement>('textarea, [contenteditable="true"]'))
    .some((el) => ((el as HTMLTextAreaElement).value ?? el.textContent ?? '').trim() !== '')
  return { openDialog, draftText }
}

/**
 * "האם הלשונית הזאת מריצה קוד ישן", ואם כן, לרענן לבד ברגע בטוח.
 *
 * 🔴 **דרך אחת לכיוון אחד.** ברגע שנקבע שהקוד ישן הוא נשאר ישן עד רענון.
 * בדיקה שמחזירה `null` בפעם הבאה (רשת שגמגמה) לא מורידה את הפס, אחרת הוא
 * היה מהבהב בדיוק כשהרשת בעייתית.
 *
 * ⭐ נבדק בעלייה, כל דקה כשהמסך גלוי, בכל חזרה ללשונית ובכל שליפה שנכשלה.
 * ⭐ 13/10/2026: כשיש גרסה חדשה, מרעננים לבד כשהלשונית ברקע, במעבר מסך,
 * או אחרי שתי דקות בלי פעילות בלי חלון פתוח וטיוטה (`autoReloadReason`).
 */
export function useAppVersion(): { stale: boolean } {
  const [latest, setLatest] = useState<string | null>(null)
  const stale = latest !== null
  const lastActivity = useRef(Date.now())
  const { pathname } = useLocation()
  const firstPath = useRef(pathname)

  useEffect(() => {
    if (BUILD_ID === 'dev') return
    let alive = true
    const controller = new AbortController()

    const check = async () => {
      if (!alive || document.visibilityState !== 'visible') return
      const live = await fetchLatestBuildId(controller.signal)
      if (!alive) return
      if (live && isStaleBuild(BUILD_ID, live)) setLatest(live)
    }

    void check()
    const timer = setInterval(() => void check(), POLL_MS)
    const onFocus = () => void check()
    window.addEventListener('focus', onFocus)
    window.addEventListener('pageshow', onFocus)
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener(FETCH_FAILED_EVENT, onFocus)

    return () => {
      alive = false
      controller.abort()
      clearInterval(timer)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onFocus)
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener(FETCH_FAILED_EVENT, onFocus)
    }
  }, [])

  // פעילות = הקלדה, לחיצה, גלילה, מגע. גרירה ביומן היא לחיצה מתמשכת.
  useEffect(() => {
    const touch = () => { lastActivity.current = Date.now() }
    const events = ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart', 'input'] as const
    for (const e of events) window.addEventListener(e, touch, { passive: true, capture: true })
    return () => { for (const e of events) window.removeEventListener(e, touch, { capture: true }) }
  }, [])

  // רגע בטוח: ברקע מיד, או גלוי ולא בשימוש.
  useEffect(() => {
    if (!latest) return
    const evaluate = () => {
      const reason = autoReloadReason({
        hidden: document.visibilityState === 'hidden',
        idleMs: Date.now() - lastActivity.current,
        ...pageBusy(),
      })
      if (reason) reloadFor(latest)
    }
    evaluate()
    const timer = setInterval(evaluate, SAFE_CHECK_MS)
    document.addEventListener('visibilitychange', evaluate)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', evaluate)
    }
  }, [latest])

  // מעבר מסך כשיש גרסה חדשה: המסך הקודם כבר נעזב, אז טוענים את החדש במלואו.
  useEffect(() => {
    if (pathname === firstPath.current) return
    firstPath.current = pathname
    if (latest) reloadFor(latest)
  }, [pathname, latest])

  return { stale }
}
