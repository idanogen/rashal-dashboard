import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { execSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, statSync } from 'node:fs'

/**
 * 🔴🔴 **מזהה הבנייה, ולמה הוא קיים.**
 *
 * לשונית שנשארת פתוחה לא מורידה שוב את קובץ האפליקציה, גם כשעוברים בין
 * מסכים, כי זהו יישום עמוד יחיד. כלומר משתמש יכול להריץ קוד מלפני הפריסה
 * במשך ימים בלי שום סימן.
 *
 * ⭐ **המקרה שהוליד את זה (<bdi>09/09/2026</bdi>):** נעילת הכסף במסד הורידה
 * את ההרשאה הטבלאית מ-`pickups` והשאירה הרשאת עמודה. הקוד החדש שולף עמודות
 * מפורשות ועובד, אבל הקוד הישן שלף `*` ומאותו רגע חטף דחייה. בלשונית
 * שהייתה פתוחה מלפני הפריסה **פאנל האיסופים פשוט נשאר ריק**, כלומר המסך
 * הראה "אין איסופים" בזמן שבמסד יש. תקלה שנראית כמו נתון.
 *
 * לכן: הבנייה חותמת מזהה גם בתוך החבילה וגם בקובץ `version.json` לצידה,
 * והלשונית משווה ביניהם. שונה = הקוד שרץ אינו הקוד שבאוויר.
 * [[open_tab_runs_stale_code]]
 *
 * 🔴 מזהה לפי הקומיט ולא לפי שעת הבנייה, כדי שפריסה חוזרת של אותו קוד לא
 * תבקש מכולם לרענן לחינם.
 */
/**
 * 🔴 13/10/2026: פריסה מעץ שלא קומט (`vercel --prod` מהמחשב) קיבלה את המזהה
 * של הקומיט הקודם, ולכן הפס "יש גרסה חדשה" לא עלה אצל אף אחד. הבנייה רצה
 * בשרתי Vercel בלי `.git`, ולכן אי אפשר לשאול את git מה השתנה. במקום זה:
 * טביעה של קבצי המקור עצמם, אחרי הקומיט. אותו תוכן = אותו מזהה (בלי רענון
 * לחינם), כל שינוי בקוד = מזהה חדש.
 */
function sourceFingerprint(): string {
  const h = createHash('sha1')
  const walk = (dir: string) => {
    let entries: string[] = []
    try { entries = readdirSync(dir).sort() } catch { return }
    for (const name of entries) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) walk(full)
      else h.update(path.relative(__dirname, full)).update(readFileSync(full))
    }
  }
  for (const d of ['src', 'public']) walk(path.resolve(__dirname, d))
  for (const f of ['index.html', 'preview.html', 'package.json']) {
    try { h.update(f).update(readFileSync(path.resolve(__dirname, f))) } catch { /* אין קובץ */ }
  }
  return h.digest('hex').slice(0, 6)
}

function buildId(): string {
  let head = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ?? ''
  if (!head) {
    try {
      head = execSync('git rev-parse --short=12 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
        .toString()
        .trim()
    } catch {
      head = 'nogit'
    }
  }
  return `${head}-${sourceFingerprint()}`
}

/**
 * ⭐ הקובץ נכתב מתוך הבנייה ולא ידנית, כדי ששני המספרים לא יוכלו להיפרד.
 * `version.json` הוא קובץ סטטי, ולכן Vercel מגיש אותו לפני ה-rewrite של
 * יישום העמוד היחיד.
 */
function versionManifest(id: string): Plugin {
  return {
    name: 'rashal-version-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ build: id }),
      })
    },
  }
}

const BUILD = buildId()

export default defineConfig({
  plugins: [react(), tailwindcss(), versionManifest(BUILD)],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD),
  },
  server: {
    port: 3000,
    host: '::',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
