import { useEffect, useState } from 'react';
import { AlertTriangle, ChevronDown, Timer } from 'lucide-react';
import { reportScreenLoad } from '@/lib/perf-collect';
import { useIsManagement } from '@/hooks/useProfile';
import type { LoadReport } from '@/lib/perf';

/**
 * שורת "כמה זמן לקח למסך לעלות, ומה שרף את הזמן".
 *
 * ⭐ **נולדה מהתלונה של עמי** (<bdi>27/08/2026</bdi>): מסך הסדרן הראה
 * "אין הזמנות ממתינות לתיאום" בזמן ש-829 הזמנות ישבו במסד, **ולא הייתה
 * שום דרך לדעת מה קרה בדפדפן שלו.**
 *
 * 🔴 **השורה קטנה ואפורה בכוונה.** זה כלי אבחון, לא מדד שהסדרן צריך
 * לעקוב אחריו. היא נפתחת בלחיצה, ונצבעת רק כשיש מה לספר.
 *
 * 🔴 **והדיווח יוצא רק אחרי שכל השליפות נגמרו**, מ-`useEffect` ולא
 * מהרינדור. מדידה שמתחילה עבודה בזמן ציור היא בדיוק סוג התקלה שהיא
 * אמורה למצוא. [[render_must_not_start_work]]
 */
export function LoadReportLine({ screen, ready }: { screen: string; ready: boolean }) {
  const [report, setReport] = useState<LoadReport | null>(null);
  const [open, setOpen] = useState(false);
  const isManagement = useIsManagement();

  /**
   * 🔴🔴 **לא לתלות את הדיווח ברגע יחיד של "הכל נגמר".**
   *
   * `isLoading` של שאילתה הוא `false` גם **לפני** שהיא התחילה, ולכן
   * ברינדור הראשון "הכל נגמר" הוא אמת בזמן שאין ולו מדידה אחת. אפקט
   * שרץ בדיוק שם היה מדווח על כלום ולא חוזר לעולם, וזה מה שקרה בפועל
   * במצב הכישלון: הדוח פשוט לא הופיע.
   * [[guard_must_exercise_the_state_it_guards]]
   *
   * ⭐ לכן בדיקה חוזרת קצרה עד שיש מדידות, עם תקרה. `reportScreenLoad`
   * עצמו שומר שהדיווח יוצא פעם אחת בלבד.
   */
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;

    const attempt = () => {
      if (!alive) return;
      void reportScreenLoad(screen).then((r) => {
        if (!alive) return;
        if (r) {
          setReport(r);
          return;
        }
        // עדיין אין מדידות. ננסה שוב, עד כ-10 שניות.
        if (tries++ < 20) timer = setTimeout(attempt, 500);
      });
    };
    attempt();

    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [ready, screen]);

  if (!report) return null;
  return (
    <LoadReportPanel
      report={report}
      open={open}
      onToggle={() => setOpen((o) => !o)}
      technical={isManagement}
    />
  );
}

/**
 * התצוגה בלבד, בלי שעון ובלי אפקט.
 * ⭐ **מופרדת כדי שאפשר יהיה לצלם אותה עם דוח מוזרק**, ובעיקר את מצב
 * הכישלון, שהוא בדיוק המצב שאי אפשר לייצר לפי דרישה בדפדפן.
 * [[screenshot_behind_a_login]]
 */
export function LoadReportPanel({
  report,
  open,
  onToggle,
  technical = false,
}: {
  report: LoadReport;
  open: boolean;
  onToggle: () => void;
  /**
   * 🔴 **מי מקבל את נוסח השגיאה הגולמי.** ההנהלה ואנחנו, לא הסדרנית.
   * עידן, <bdi>10/09/2026</bdi>: היא ראתה
   * `permission denied for table pickups` באנגלית ובשפה של מסד נתונים,
   * וזה לא אמר לה כלום מלבד שמשהו נשבר. לסדרנית נשארת פעולה אחת שהיא
   * כן יכולה לעשות, לרענן.
   */
  technical?: boolean;
}) {
  const failed = report.failures.length > 0;
  const slow = report.totalMs >= 4000;
  const tone = failed
    ? 'text-destructive'
    : slow
      ? 'text-amber-700'
      : 'text-muted-foreground';

  return (
    <div className="mt-4 text-[11px]">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors hover:bg-muted/50 ${tone}`}
      >
        {failed ? <AlertTriangle className="h-3.5 w-3.5" /> : <Timer className="h-3.5 w-3.5" />}
        <span>
          המסך עלה ב-<bdi>{(report.totalMs / 1000).toFixed(1)}</bdi> שניות
          {report.critical && !failed && (
            <>
              {' · הכי איטי: '}
              <bdi>{report.critical.name}</bdi>
            </>
          )}
        </span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-1.5 rounded-lg border bg-white p-3">
          <p className={`mb-2 font-semibold ${tone}`}>{report.verdict}</p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px]">
              <thead>
                <tr className="text-[10px] text-muted-foreground">
                  <th className="p-1 text-start font-medium">שליפה</th>
                  <th className="p-1 text-start font-medium">זמן</th>
                  <th className="p-1 text-start font-medium">שורות</th>
                  <th className="p-1 text-start font-medium">סבבים</th>
                </tr>
              </thead>
              <tbody>
                {report.marks.map((m) => {
                  const span = m.endedAt - m.startedAt;
                  const isCritical = m.name === report.critical?.name;
                  return (
                    <tr key={m.name} className="border-t" style={{ borderColor: '#f1f4f9' }}>
                      <td className={`p-1 ${isCritical ? 'font-bold' : ''}`}>
                        {m.name}
                        {isCritical && <span className="ms-1 text-[9px] text-amber-700">הנתיב הקריטי</span>}
                      </td>
                      <td className={`p-1 ${m.failed ? 'text-destructive' : ''}`}>
                        {m.failed ? 'נכשלה' : <bdi>{(span / 1000).toFixed(2)}s</bdi>}
                      </td>
                      <td className="p-1">
                        <bdi>{m.rows.toLocaleString('he-IL')}</bdi>
                      </td>
                      <td className="p-1">
                        <bdi>{m.pages}</bdi>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ⭐ המספר שמסביר למה סכום הזמנים גדול מזמן הטעינה. */}
          <p className="mt-2 text-[10px] text-muted-foreground">
            <bdi>{report.totalRows.toLocaleString('he-IL')}</bdi> שורות ב-
            <bdi>{report.totalPages}</bdi> סבבי רשת · מקביליות{' '}
            <bdi>×{report.parallelism}</bdi> (סכום הזמנים{' '}
            <bdi>{(report.sumMs / 1000).toFixed(1)}s</bdi> מול{' '}
            <bdi>{(report.totalMs / 1000).toFixed(1)}s</bdi> בפועל)
          </p>

          {failed && (
            <div className="mt-2 rounded-md bg-destructive/5 p-2 text-destructive">
              <p className="font-semibold">
                חלק מהנתונים לא נטענו, ולכן המסך מציג פחות ממה שיש במערכת.
                רענון הדף פותר את זה ברוב המקרים.
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-1.5 rounded-md bg-destructive px-2.5 py-1 text-[11px] font-semibold text-white"
              >
                רענן את הדף
              </button>
              {technical && (
                <ul className="mt-2 space-y-0.5 border-t border-destructive/20 pt-2 text-[10px]">
                  {report.failures.map((f) => (
                    <li key={f.name} dir="ltr" className="text-start">
                      <b>{f.name}</b>: {f.failed}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
