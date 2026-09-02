/**
 * ביצועי הצוות, מסך משלו.
 *
 * ⭐ **נולד משאלה של עידן** (<bdi>02/09/2026</bdi>): "מהנתונים שיש לנו,
 * אפשר כבר להסיק מסקנות? אחוז אספקות שבוצעו? כמה כל אחד עושה?"
 *
 * 🔴🔴 **והתשובה הכריעה את העיצוב.** המדידה הראתה שרודי סגר <bdi>75</bdi>
 * עצירות מתוך <bdi>271</bdi> משובצות, ואולג אפס מתוך <bdi>33</bdi>.
 * טבלה שמציגה "אחוז ביצוע" הייתה מדפיסה 28% ו-0% לצד שמות של אנשים,
 * ו**זה לא נכון**: העצירות האלה לא נכשלו, הן פשוט לא נסגרו במערכת.
 * לכן במסך הזה **הפתוחות הן עמודה משלהן ולא חלק מהאחוז**, ומי שכמעט לא
 * נכח במערכת אינו מדורג כלל אלא מסומן ככזה.
 *
 * ⭐ **המסך אינו מדרג עובדים, הוא מראה איפה העבודה נתקעת.** הכותרת
 * הראשונה היא הפתוחות מימים שעברו, כי כל אחת מהן היא לקוח שלא יודע מה
 * קורה איתו.
 */
import { useMemo, useState } from 'react';
import { CalendarClock, ClipboardList, Repeat, Users, XCircle } from 'lucide-react';
import { useTeamPerformance } from '@/hooks/useTeamPerformance';
import {
  needsAttention,
  orderPeople,
  pct,
  toPersonRow,
  OPEN_BACKLOG_ALERT,
} from '@/lib/team-metrics';

const NAVY = '#14223a';
const RED = '#c2410c';

/** 0 = ראשון, כמו ב-postgres. חמישי הוא היום האחרון שעובדים בו. */
const DOW_LABEL: Record<number, string> = {
  0: 'ראשון', 1: 'שני', 2: 'שלישי', 3: 'רביעי', 4: 'חמישי', 5: 'שישי', 6: 'שבת',
};

const LEAD_BUCKETS = [
  { key: 'd0_2' as const, label: 'עד יומיים', color: '#16a34a' },
  { key: 'd3_7' as const, label: 'שלושה עד שבעה', color: '#84cc16' },
  { key: 'd8_14' as const, label: 'שמונה עד 14', color: '#f59e0b' },
  { key: 'over14' as const, label: 'מעל שבועיים', color: '#dc2626' },
];

const KIND_LABEL: Record<string, string> = {
  driver: 'חלוקה',
  technician: 'שירות',
  both: 'חלוקה ושירות',
};

function Panel({
  icon, title, hint, children,
}: {
  icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-sm font-bold" style={{ color: NAVY }}>{title}</h3>
        {hint && <span className="text-[11px] text-slate-400">· {hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Stat({ n, t, color }: { n: React.ReactNode; t: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-extrabold leading-none" style={{ color: color ?? NAVY }}>{n}</div>
      <div className="mt-1 text-[11px] text-slate-400">{t}</div>
    </div>
  );
}

export function TeamPerformancePage() {
  const [days, setDays] = useState(90);
  const { data, isLoading, isError } = useTeamPerformance(days);

  const rows = useMemo(() => orderPeople((data?.people ?? []).map(toPersonRow)), [data]);
  const attention = useMemo(() => needsAttention(rows), [rows]);
  const totals = data?.totals;
  const lead = data?.leadTime ?? { n: 0, median: null, p90: null, d0_2: 0, d3_7: 0, d8_14: 0, over14: 0, ofCompleted: 0 };
  const rep = data?.repeat ?? { customers: 0, withRepeat: 0, visits: 0, closedWithCustomer: 0 };
  const dow = data?.byDow ?? [];
  const dowMax = Math.max(1, ...dow.map((d) => d.stops));
  const reasonTotal = (data?.reasons ?? []).reduce((s, r) => s + r.n, 0);

  return (
    <div style={{ background: '#f5f7fb' }} className="-mx-4 -my-6 min-h-screen px-4 py-5 sm:-mx-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <div className="text-xl font-extrabold" style={{ color: NAVY }}>ביצועי הצוות</div>
          <div className="text-[11px] text-slate-400">
            <bdi>{days}</bdi> הימים האחרונים{isLoading ? ' · טוען…' : ''}
          </div>
        </div>
        <div className="flex gap-1 rounded-xl border bg-white p-1" style={{ borderColor: '#eef1f6' }}>
          {[30, 90].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`rounded-lg px-3 py-1 text-xs font-bold ${
                d === days ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'
              }`}
            >
              <bdi>{d}</bdi> יום
            </button>
          ))}
        </div>
      </div>

      {/* 🔴 שגיאה נאמרת, ולא מוצגת כמסך ריק שנראה כמו "אין עבודה". */}
      {isError && (
        <Panel icon={<Users className="h-4 w-4" />} title="הנתונים לא נטענו">
          <p className="py-6 text-center text-xs text-slate-500">
            השליפה נכשלה. זה אינו "אין נתונים", אלא תקלה בטעינה. נסו לרענן את הדף.
          </p>
        </Panel>
      )}

      {!isError && (
        <>
          <div className="mb-4 rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat n={totals?.completed ?? '·'} t="עצירות שבוצעו" />
              <Stat n={totals?.notCompleted ?? '·'} t="לא בוצעו" />
              <Stat
                n={totals?.openFromPast ?? '·'}
                t="פתוחות מימים שעברו"
                color={(totals?.openFromPast ?? 0) > 0 ? RED : undefined}
              />
              <Stat
                n={totals && totals.completed > 0
                  ? `${Math.round((totals.closedSameDay / totals.completed) * 100)}%`
                  : '·'}
                t="נסגרו באותו יום"
                color="#15803d"
              />
            </div>
            {/* ⭐ המשפט הזה הוא חלק מהמסך ולא הערת שוליים: בלעדיו העמודות
                ייקראו כדירוג עובדים, וזה לא מה שהן. */}
            <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-400">
              המסך מודד <bdi>מה נסגר במערכת</bdi>, ולא מה נעשה בשטח. עצירה שנשארה פתוחה מיום שעבר
              אינה "לא בוצעה", היא לא נסגרה, ולכן היא בעמודה נפרדת ואינה נכנסת לאחוזים.
            </p>
          </div>

          {/* ⭐⭐ הפתוחות ראשונות, כי הן הדבר היחיד כאן שדורש פעולה היום. */}
          {attention.length > 0 && (
            <div className="mb-4 rounded-2xl border p-4" style={{ borderColor: '#fed7aa', background: '#fff7ed' }}>
              <div className="text-sm font-bold" style={{ color: '#9a3412' }}>
                עצירות שנשארו פתוחות מימים שעברו
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {attention.map((r) => (
                  <span key={r.name} className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-800">
                    {r.name} · <bdi>{r.openFromPast}</bdi>
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-orange-900/70">
                כל אחת מהן היא לקוח שהעבודה אצלו לא נסגרה במערכת. מוצג ממי שיש לו{' '}
                <bdi>{OPEN_BACKLOG_ALERT}</bdi> ומעלה.
              </p>
            </div>
          )}

          <Panel
            icon={<ClipboardList className="h-4 w-4" />}
            title="מי עשה כמה"
            hint={`${rows.length} אנשים`}
          >
            {rows.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">
                {isLoading ? 'טוען…' : 'אין עצירות משובצות בתקופה הזאת.'}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-xs">
                  <thead>
                    <tr className="text-slate-400">
                      <th className="p-2 text-start font-semibold">שם</th>
                      <th className="p-2 text-start font-semibold">תפקיד</th>
                      <th className="p-2 text-start font-semibold">הגיע</th>
                      <th className="p-2 text-start font-semibold">בוצע</th>
                      <th className="p-2 text-start font-semibold">לא בוצע</th>
                      <th className="p-2 text-start font-semibold">פתוחות</th>
                      <th className="p-2 text-start font-semibold">ימי פעילות</th>
                      <th className="p-2 text-start font-semibold">ליום</th>
                      <th className="p-2 text-start font-semibold">נסגר באותו יום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.name} className={`border-t ${r.tooFewDays ? 'opacity-60' : ''}`} style={{ borderColor: '#eef1f6' }}>
                        <td className="p-2 font-bold" style={{ color: NAVY }}>
                          {r.name}
                          {/* 🔴 מי שכמעט לא נכח מסומן, ולא מדורג בשקט לתחתית */}
                          {r.tooFewDays && (
                            <span className="ms-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-normal text-slate-500">
                              מעט מדי ימים
                            </span>
                          )}
                        </td>
                        <td className="p-2 text-slate-500">{KIND_LABEL[r.kind ?? ''] ?? '·'}</td>
                        <td className="p-2"><bdi>{r.arrived}</bdi></td>
                        <td className="p-2 font-bold"><bdi>{r.completed}</bdi></td>
                        <td className="p-2"><bdi>{r.notCompleted}</bdi></td>
                        <td className="p-2">
                          <bdi className={r.openFromPast >= OPEN_BACKLOG_ALERT ? 'font-bold text-orange-700' : ''}>
                            {r.openFromPast}
                          </bdi>
                        </td>
                        <td className="p-2 text-slate-500"><bdi>{r.activeDays}</bdi></td>
                        <td className="p-2 text-slate-500">
                          {r.perDay === null ? '·' : <bdi>{r.perDay.toFixed(1)}</bdi>}
                        </td>
                        <td className="p-2 text-slate-500">{pct(r.sameDayRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              icon={<XCircle className="h-4 w-4" />}
              title="למה לא בוצע"
              hint={reasonTotal > 0 ? `${reasonTotal} עצירות` : undefined}
            >
              {(data?.reasons ?? []).length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  אף עצירה לא סומנה כלא בוצעה בתקופה הזאת.
                </p>
              ) : (
                <div className="space-y-2 py-1">
                  {(data?.reasons ?? []).map((r) => {
                    const unclassified = r.reason === 'לא מסווג';
                    return (
                      <div key={r.reason} className="flex items-center gap-2 text-xs">
                        <span className={`w-40 shrink-0 truncate ${unclassified ? 'text-slate-400' : ''}`}>
                          {r.reason}
                        </span>
                        <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${reasonTotal ? (r.n / reasonTotal) * 100 : 0}%`,
                              background: unclassified ? '#cbd5e1' : '#f97316',
                            }}
                          />
                        </div>
                        <bdi className="w-8 shrink-0 text-start font-bold" style={{ color: NAVY }}>{r.n}</bdi>
                      </div>
                    );
                  })}
                  {/* 🔴 "לא מסווג" מוסבר ולא מוצג כקטגוריה אמיתית. */}
                  <p className="pt-2 text-[11px] leading-relaxed text-slate-400">
                    "לא מסווג" הן עצירות שהסיבה בהן נכתבה כטקסט חופשי לפני שהייתה רשימה סגורה.
                    מכאן והלאה כל בחירה מהרשימה במסך הנהג נספרת לבד.
                  </p>
                </div>
              )}
            </Panel>

            {/* ⭐⭐ **מדד ארגוני ולא אישי.** כמה זמן לוקח מרגע שהלקוח הזמין
                ועד שהציוד אצלו. זה אינו תלוי בנהג אלא בתיאום, במלאי
                ובעומס, ולכן הוא לא יושב בטבלת האנשים. */}
            <Panel
              icon={<CalendarClock className="h-4 w-4" />}
              title="מהזמנה עד אספקה"
              hint={lead.n > 0 ? `חציון ${lead.median} ימים` : undefined}
            >
              {lead.n === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  אין אספקות שמקושרות להזמנה בתקופה הזאת, ולכן אי אפשר לחשב את הזמן.
                </p>
              ) : (
                <>
                  <div className="space-y-2 py-1">
                    {LEAD_BUCKETS.map((b) => {
                      const n = lead[b.key];
                      return (
                        <div key={b.key} className="flex items-center gap-2 text-xs">
                          <span className="w-28 shrink-0">{b.label}</span>
                          <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${lead.n ? (n / lead.n) * 100 : 0}%`, background: b.color }}
                            />
                          </div>
                          <bdi className="w-8 shrink-0 text-start font-bold" style={{ color: NAVY }}>{n}</bdi>
                        </div>
                      );
                    })}
                  </div>
                  {/* 🔴 המכנה נאמר. 149 מתוך 571 אינו "כל האספקות". */}
                  <p className="pt-2 text-[11px] leading-relaxed text-slate-400">
                    נמדד על <bdi>{lead.n}</bdi> אספקות מתוך <bdi>{lead.ofCompleted}</bdi> שבוצעו,
                    אלה שמקושרות להזמנה ולכן ידוע מתי היא נפתחה. אצל{' '}
                    <bdi>{lead.over14}</bdi> מהן עברו יותר משבועיים, וזה המקום שבו לקוח מתחיל להתקשר.
                  </p>
                </>
              )}
            </Panel>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
              icon={<Repeat className="h-4 w-4" />}
              title="לקוחות שדרשו יותר מנסיעה אחת"
              hint={rep.customers > 0 ? `${rep.withRepeat} מתוך ${rep.customers}` : undefined}
            >
              {rep.customers === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">
                  אין מספיק עצירות עם מספר לקוח בתקופה הזאת.
                </p>
              ) : (
                <div className="py-2">
                  <div className="flex items-end justify-center gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-extrabold leading-none" style={{ color: '#c2410c' }}>
                        {Math.round((rep.withRepeat / rep.customers) * 100)}%
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">מהלקוחות</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-extrabold leading-none" style={{ color: NAVY }}>
                        {rep.visits}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-400">נסיעות אליהם</div>
                    </div>
                  </div>
                  {/* 🔴 המכנה שוב: רק עצירות שיש להן מספר לקוח. משימה
                      שנפתחה ידנית בלי ישות אינה יודעת אצל מי היא הייתה. */}
                  <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
                    <bdi>{rep.withRepeat}</bdi> לקוחות מתוך <bdi>{rep.customers}</bdi> קיבלו יותר
                    מנסיעה אחת, ויחד הם <bdi>{rep.visits}</bdi> נסיעות מתוך{' '}
                    <bdi>{rep.closedWithCustomer}</bdi>. כל נסיעה שנייה היא עלות שלא תוכננה, ולרוב
                    היא נולדת ממשהו שהתגלה בשטח ולא מהנהג.
                  </p>
                </div>
              )}
            </Panel>

            <Panel icon={<Users className="h-4 w-4" />} title="עומס לפי יום בשבוע">
              {dow.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">אין עצירות בתקופה הזאת.</p>
              ) : (
                <div className="space-y-2 py-1">
                  {dow.map((d) => (
                    <div key={d.dow} className="flex items-center gap-2 text-xs">
                      <span className="w-12 shrink-0">{DOW_LABEL[d.dow] ?? d.dow}</span>
                      <div className="h-4 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${dowMax ? (d.stops / dowMax) * 100 : 0}%`, background: '#2563eb' }}
                        />
                      </div>
                      <bdi className="w-8 shrink-0 text-start font-bold" style={{ color: NAVY }}>{d.stops}</bdi>
                    </div>
                  ))}
                  <p className="pt-2 text-[11px] leading-relaxed text-slate-400">
                    מספר העצירות המשובצות בכל יום. חמישי קל יותר משאר הימים, וזה המקום הראשון
                    להזיז אליו עומס מיום עמוס.
                  </p>
                </div>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
