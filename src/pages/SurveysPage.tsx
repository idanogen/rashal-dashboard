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
import { useMemo } from 'react';
import { Smile, Frown, Users, Star, MessageSquareQuote } from 'lucide-react';
import { useSurveys } from '@/hooks/useSurveys';
import { computeSurveyMetrics, formatScore, type NamedScore } from '@/lib/surveys';
import { surveyMark, SURVEY_TONE } from '@/lib/survey-badge';

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

function commentDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const time = d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `היום ${time}`;
  // 🔴 עם שנה. הרשימה ממוינת מהחדש לישן, ובלי שנה קל להניח שהכל מהשבוע.
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${time}`;
}

export function SurveysPage() {
  const { data: surveys = [], isLoading } = useSurveys(90);
  const sv = useMemo(() => computeSurveyMetrics(surveys), [surveys]);

  return (
    <div style={{ background: '#f5f7fb' }} className="-mx-4 -my-6 min-h-screen px-4 py-5 sm:-mx-6 sm:px-6">
      <div className="mb-5 px-1">
        <div className="text-xl font-extrabold" style={{ color: NAVY }}>
          סקרי שביעות רצון
        </div>
        <div className="text-[11px] text-slate-400">
          <bdi>90</bdi> הימים האחרונים{isLoading ? ' · טוען…' : ''}
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
              <Stat n={sv.lowRated.length} t="בדירוג נמוך" color={sv.lowRated.length > 0 ? '#c2410c' : undefined} />
            </div>
            <div className="mt-3 text-center text-[11px] text-slate-400">
              <bdi>{sv.answered}</bdi> תשובות מתוך <bdi>{sv.sent}</bdi> סקרים שיצאו
            </div>
          </div>

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
              hint={`${sv.lowRated.length} לטיפול`}
            >
              {sv.lowRated.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">אף לקוח לא נתן ציון נמוך</p>
              ) : (
                <div className="space-y-2 py-1">
                  {sv.lowRated.map((s) => {
                    const mark = surveyMark({
                      score: s.satisfaction,
                      answeredAt: s.answeredAt,
                      comment: s.comment,
                    });
                    return (
                      <div key={s.id} className="flex items-start gap-2 text-xs">
                        {mark && (
                          <span
                            className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[11px] font-semibold ${SURVEY_TONE[mark.tone]}`}
                          >
                            {mark.emoji} {mark.label}
                          </span>
                        )}
                        <span className="min-w-0">
                          <span className="font-semibold text-slate-800">{s.customerName ?? 'לקוח'}</span>
                          {s.comment && (
                            <span className="block text-slate-500">{s.comment}</span>
                          )}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>

          <div className="mt-4">
            <Panel
              icon={<MessageSquareQuote className="h-4 w-4" />}
              title="מה הלקוחות כתבו"
              hint={`${sv.withComments.length} הערות`}
            >
              {sv.withComments.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">אין עדיין הערות חופשיות</p>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {sv.withComments.map((s) => (
                    <div key={s.id} className="rounded-xl border bg-slate-50/60 p-3" style={{ borderColor: '#eef1f6' }}>
                      <p className="text-[13px] leading-snug text-slate-700">{s.comment}</p>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        {s.customerName ?? 'לקוח'}
                        {s.satisfaction != null && ` · ${s.satisfaction} מתוך 5`}
                        {s.answeredAt && ` · ${commentDate(s.answeredAt)}`}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
