/**
 * סקרי שביעות רצון, מסך משלהם.
 *
 * 🔴🔴 **למה מסך נפרד ולא פתיחה של דשבורד ההנהלה.** עמי ביקש
 * (<bdi>26/08/2026</bdi>) הרשאה לראות סקרים. הסקרים אמנם יושבים בדשבורד
 * ההנהלה, **אבל שם יושב גם כסף**, ועידן הגדיר באותו יום שכסף ומחזורי
 * מכירות חשופים להנהלה בלבד. פתיחת המסך כולו הייתה סותרת את זה.
 * ⭐ ושביעות רצון אינה כסף: היא נתון תפעולי שכל מי שמנהל שטח צריך.
 *
 * ⭐ **החישוב משותף ואינו משוכפל:** `computeSurveyMetrics` הוא המקור
 * היחיד למספרים, וגם דשבורד ההנהלה קורא לו. שתי הצגות שונות של אותו
 * חישוב זה בסדר; שני חישובים של אותו מספר זה מה שגורם למסכים לשקר.
 * [[label_and_math_from_two_mechanisms]]
 *
 * 🔴 **ועמי ביקש דבר שני שאינו כאן במכוון:** לשלוח את התוצאות לקבוצת
 * הנהגים. הוא צודק שהם לא יודעים שיש עליהם סקר, אבל שליחה לקבוצה היא
 * הודעה יוצאת ולא מסך, והיא ממתינה לאישור של עידן.
 */
import { useMemo, useState } from 'react';
import { Smile, Frown, Users, Star, MessageSquareQuote, Search } from 'lucide-react';
import { useAllAnsweredSurveys, useSurveys } from '@/hooks/useSurveys';
import { computeSurveyMetrics, formatScore, type NamedScore, type Survey } from '@/lib/surveys';
import { matchesSearch } from '@/lib/search-match';
import { CustomerCommentsList } from '@/components/surveys/CustomerCommentsList';
import { LowRatedList } from '@/components/surveys/LowRatedList';
import { SurveySearch } from '@/components/surveys/SurveySearch';

const NAVY = '#14223a';
const GREEN = '#15803d';

function Panel({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
      <div className="mb-3 flex items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-sm font-bold" style={{ color: NAVY }}>
          {title}
        </h3>
        {hint && <span className="text-[11px] text-slate-400">· {hint}</span>}
      </div>
      {children}
    </div>
  );
}

/**
 * 🔴 הסולם קבוע 1 עד 5 ולא נמתח לפי המקסימום שנצפה. סולם שנמתח הופך
 * הפרש של עשירית בין שני נהגים לפער ויזואלי עצום, ומשקר בדיוק במקום
 * שבו אנשים מסיקים מסקנות על אנשים.
 */
function ScoreList({ rows }: { rows: NamedScore[] }) {
  if (rows.length === 0) {
    return <p className="py-8 text-center text-xs text-slate-400">אין עדיין מספיק תשובות</p>;
  }
  return (
    <div className="space-y-2.5 py-1">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-xs">{r.name}</span>
          <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{ width: `${(r.avg / 5) * 100}%`, background: r.avg < 3.5 ? '#dc2626' : '#16a34a' }}
            />
          </div>
          <span className="w-14 shrink-0 text-start text-xs font-bold" style={{ color: NAVY }}>
            {r.avg.toFixed(1)}
            <span className="ms-1 font-normal text-slate-400">({r.count})</span>
          </span>
        </div>
      ))}
    </div>
  );
}

function Stat({ n, t, color }: { n: React.ReactNode; t: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-extrabold leading-none" style={{ color: color ?? NAVY }}>
        {n}
      </div>
      <div className="mt-1 text-[11px] text-slate-400">{t}</div>
    </div>
  );
}

export function SurveysPage() {
  const { data: surveys = [], isLoading } = useSurveys(90);
  const sv = useMemo(() => computeSurveyMetrics(surveys), [surveys]);

  const [query, setQuery] = useState('');
  const term = query.trim();
  const searching = term.length >= 2;

  /** התאמות בתוך החלון שהמסך כבר טען. מיידי, בלי סבב רשת. */
  const inWindow = useMemo(() => {
    if (!searching) return [];
    return surveys
      .filter((s) => s.answeredAt !== null)
      .filter((s) => matchesSearch(`${s.customerName ?? ''} ${s.customerNumber ?? ''}`, term));
  }, [surveys, searching, term]);

  /**
   * 🔴 **ורק כשאין אף התאמה בחלון, מחפשים בכל ההיסטוריה.** מסך שמציג
   * <bdi>90</bdi> יום ועונה "לא נמצא" על לקוח שענה לפני ארבעה חודשים
   * נשמע כמו עובדה ולא כמו גבול של חלון, וזו התשובה שמלמדת לא לסמוך על
   * החיפוש. היום אין עדיין אף תשובה מעבר לחלון, ולכן זה שקט לגמרי.
   */
  const wantsHistory = searching && inWindow.length === 0;
  const {
    data: allAnswered,
    isFetching: historyLoading,
    isError: historyFailed,
  } = useAllAnsweredSurveys(wantsHistory);
  const inHistory = useMemo(() => {
    if (!wantsHistory || !allAnswered) return [];
    return allAnswered.filter((s) =>
      matchesSearch(`${s.customerName ?? ''} ${s.customerNumber ?? ''}`, term),
    );
  }, [wantsHistory, allAnswered, term]);

  const results: Survey[] = inWindow.length > 0 ? inWindow : inHistory;

  return (
    <div style={{ background: '#f5f7fb' }} className="-mx-4 -my-6 min-h-screen px-4 py-5 sm:-mx-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <div className="text-xl font-extrabold" style={{ color: NAVY }}>
            סקרי שביעות רצון
          </div>
          <div className="text-[11px] text-slate-400">
            <bdi>90</bdi> הימים האחרונים{isLoading ? ' · טוען…' : ''}
          </div>
        </div>
        <div className="w-full sm:w-72">
          <SurveySearch value={query} onChange={setQuery} />
        </div>
      </div>

      {/* ⭐ המצב הריק אומר מה קורה ולא נשאר ריק. מנוע הסקרים שולח שעה
          אחרי סגירת עצירה, ולכן "אין תשובות" הוא מצב לגיטימי לגמרי ביום
          שקט, ולא סימן לתקלה. [[empty_state_must_speak]] */}
      {sv.sent === 0 ? (
        <Panel icon={<Star className="h-4 w-4" />} title="טרם נשלחו סקרים">
          <p className="py-8 text-center text-xs text-slate-400">
            הסקר יוצא שעה אחרי שהנהג סוגר עצירה, ורק בשעות היום.
            <br />
            כשתצא ההודעה הראשונה, התוצאות יופיעו כאן.
          </p>
        </Panel>
      ) : (
        <>
          <div className="mb-4 rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat n={formatScore(sv.satisfaction) || '·'} t="שביעות רצון" />
              <Stat n={formatScore(sv.recommend) || '·'} t="ממליצים" />
              <Stat
                n={sv.responseRate === null ? '·' : `${sv.responseRate}%`}
                t="מענה לסקר"
                color={GREEN}
              />
              {/* ⭐ המספר הוא **הפתוחים** ולא כל הנמוכים, וזה אותו מספר
                  שמופיע בחריגים של דשבורד ההנהלה. תווית אחת ושני חישובים
                  שונים היא הדרך שבה שני מסכים מתחילים לסתור זה את זה. */}
              <Stat
                n={sv.lowOpen.length}
                t="בדירוג נמוך לטיפול"
                color={sv.lowOpen.length > 0 ? '#c2410c' : undefined}
              />
            </div>
            <div className="mt-3 text-center text-[11px] text-slate-400">
              <bdi>{sv.answered}</bdi> תשובות מתוך <bdi>{sv.sent}</bdi> סקרים שיצאו
              {sv.lowRated.length > sv.lowOpen.length && (
                <>
                  {' · '}
                  {sv.lowRated.length - sv.lowOpen.length === 1 ? (
                    'דירוג נמוך אחד כבר טופל'
                  ) : (
                    <>
                      <bdi>{sv.lowRated.length - sv.lowOpen.length}</bdi> דירוגים נמוכים כבר טופלו
                    </>
                  )}
                </>
              )}
            </div>
          </div>

          {searching ? (
            /* ⭐ **חיפוש מחליף את התצוגה ולא מסתנן בתוך פאנל אחד.** מי
               שמקליד שם רוצה לראות את כל מה שאותו אדם כתב, ולא לנחש
               באיזה משלושת הפאנלים הוא נמצא. הממוצעים למעלה נשארים כמו
               שהם, כי הם מדידה של התקופה ולא של החיפוש. */
            <Panel
              icon={<Search className="h-4 w-4" />}
              title="תוצאות חיפוש"
              hint={
                results.length === 0
                  ? undefined
                  : `${results.length} חוות דעת${inWindow.length === 0 ? ' · מחוץ ל-90 הימים' : ''}`
              }
            >
              {results.length > 0 ? (
                <CustomerCommentsList rows={results} />
              ) : historyLoading ? (
                <p className="py-8 text-center text-xs text-slate-400">מחפש בכל ההיסטוריה…</p>
              ) : (
                /* 🔴 המצב הריק אומר **על מה** חיפשנו. "לא נמצא" בלי גבול
                   נשמע כמו עובדה, וכאן הגבול הוא כל הסקרים שנענו.
                   🔴🔴 **וכשהשליפה מההיסטוריה נכשלה, אסור לומר "עברנו על
                   הכל".** זו בדיוק הצורה שבה תקלה נראית כמו תשובה. */
                <p className="py-8 text-center text-xs text-slate-400">
                  לא נמצאה חוות דעת של לקוח בשם <bdi className="font-semibold">{term}</bdi>.
                  <br />
                  {historyFailed
                    ? 'החיפוש בכל ההיסטוריה נכשל, ולכן נבדקה רק התקופה שמוצגת למעלה.'
                    : 'החיפוש עבר על כל הסקרים שנענו, גם מחוץ לתקופה שמוצגת למעלה.'}
                </p>
              )}
            </Panel>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Panel icon={<Smile className="h-4 w-4" />} title="לפי נהג" hint="הנמוך קודם">
                  <ScoreList rows={sv.byDriver} />
                </Panel>
                <Panel icon={<Users className="h-4 w-4" />} title="לפי קופה" hint="הנמוך קודם">
                  <ScoreList rows={sv.byFund} />
                </Panel>
                <Panel
                  icon={<Frown className="h-4 w-4" />}
                  title="לקוחות בדירוג נמוך"
                  hint={`${sv.lowOpen.length} לטיפול`}
                >
                  <LowRatedList rows={sv.lowRated} />
                </Panel>
              </div>

              <div className="mt-4">
                <Panel
                  icon={<MessageSquareQuote className="h-4 w-4" />}
                  title="מה הלקוחות כתבו"
                  hint={`${sv.withComments.length} הערות`}
                >
                  <CustomerCommentsList rows={sv.withComments} />
                </Panel>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
