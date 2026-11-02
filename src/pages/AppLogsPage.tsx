/**
 * "מי נתקע היום" (02/11/2026, שלב 3 בתוכנית הלוגים). מסך לעידן בלבד בתקופת
 * ההרצה: מי נכנס לאפליקציה ולדשבורד, באיזו גרסה, מי דיווח "יש בעיה", מי
 * נחסם בטופס ואיזו שגיאה קפצה. התוכנית:
 * ~/Idan-HQ/meetings/rashal/2026-11-01-תוכנית-לוגים.html
 *
 * ⭐ הנתונים מ-`app_day_summary` בלבד, אותה פונקציה שסיכום הבוקר במייל קורא.
 */
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ChevronLeft, ChevronRight, ClipboardList, PhoneOff, Users, Bug } from 'lucide-react';
import { useAppDaySummary } from '@/hooks/useAppDaySummary';
import { toLocalDateStr } from '@/lib/calendar-meta';
import { morningDayLabel, shiftDate } from '@/lib/morning-report';
import {
  KNOWN_ERRORS, agoLabel, blockReasonLabel, sortUsers, unexpectedErrors, userFlag,
  type DayUser, type Flag,
} from '@/lib/app-day-summary';

const NAVY = '#14223a';
const FLAG_COLOR: Record<Flag, string> = { red: '#c2410c', amber: '#b45309', ok: '#15803d' };
const FLAG_BG: Record<Flag, string> = { red: '#fff1ec', amber: '#fff8e6', ok: '#f0faf3' };
const ROLE_LABEL: Record<string, string> = {
  driver: 'שטח', admin: 'מנהל מערכת', management: 'הנהלה', team_manager: 'מנהל צוות', dispatcher: 'סדרן', viewer: 'משרד',
};

const hhmm = (iso: string) => new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

function Panel({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-slate-400">{icon}</span>
        <h3 className="text-sm font-bold" style={{ color: NAVY }}>{title}</h3>
        {hint && <span className="text-[11px] text-slate-400">· {hint}</span>}
      </div>
      {children}
    </section>
  );
}

function Kpi({ n, t, color }: { n: number; t: string; color?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 text-center shadow-sm" style={{ borderColor: '#eef1f6' }}>
      <div className="text-3xl font-extrabold leading-none" style={{ color: color ?? NAVY }}><bdi>{n}</bdi></div>
      <div className="mt-1.5 text-[12px] font-semibold text-slate-600">{t}</div>
    </div>
  );
}

/** שורת סימנים קצרה למשתמש: רק מה שקרה, בלי אפסים. */
function userSignals(u: DayUser): string[] {
  const out: string[] = [];
  if (u.problems) out.push(`⚠️ ${u.problems} דיווחי בעיה`);
  if (u.crashes) out.push(`💥 ${u.crashes} קריסות`);
  if (u.rejected) out.push(`⛔ ${u.rejected} פעולות נדחו`);
  if (u.forms_failed) out.push(`${u.forms_failed} טפסים לא נשמרו`);
  if (u.forms_blocked) out.push(`${u.forms_blocked} חסימות בטופס`);
  if (u.forms_cancelled) out.push(`${u.forms_cancelled} טפסים בוטלו באמצע`);
  if (u.image_errors) out.push(`${u.image_errors} תמונות לא נטענו`);
  const errs = unexpectedErrors(u);
  if (errs) out.push(`${errs} שגיאות`);
  return out;
}

function formLine(u: DayUser): string | null {
  if (!u.forms_opened && !u.forms_saved && !u.forms_sent) return null;
  return `טפסים: נפתח מסך ${u.forms_opened} · נשמרו ${u.forms_saved} · הגיעו לשרת ${u.forms_sent}`;
}

export function AppLogsPage() {
  const { date: dateParam } = useParams<{ date?: string }>();
  const today = toLocalDateStr(new Date());
  const day = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : today;
  const { data, isLoading, isError, error, dataUpdatedAt } = useAppDaySummary(day);
  // השעון של "עודכן לפני": מתקדם כל 15 שניות, ולא נקרא בתוך הרינדור.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const users = data ? sortUsers(data.users) : [];
  const field = users.filter((u) => u.app === 'driver');
  const office = users.filter((u) => u.app === 'dashboard');
  const needAttention = users.filter((u) => userFlag(u) !== 'ok').length;

  const renderUser = (u: DayUser) => {
    const flag = userFlag(u);
    const signals = userSignals(u);
    const forms = formLine(u);
    return (
      <li key={`${u.app}:${u.name}`} className="rounded-xl border p-3" style={{ borderColor: '#eef1f6', background: FLAG_BG[flag] }}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: FLAG_COLOR[flag] }} />
          <span className="font-bold" style={{ color: NAVY }}>{u.name}</span>
          <span className="text-[11px] text-slate-500">{ROLE_LABEL[u.role ?? ''] ?? u.role}</span>
          <span className="text-[11px] text-slate-500">
            {hhmm(u.first_seen)} עד {hhmm(u.last_seen)} · {u.sessions} כניסות · {u.screens} מסכים
          </span>
          {u.version && <bdi className="rounded bg-white/70 px-1.5 text-[11px] text-slate-500" dir="ltr">{u.version.slice(0, 12)}</bdi>}
        </div>
        {signals.length > 0 && (
          <div className="mt-1.5 text-[12.5px] font-semibold" style={{ color: FLAG_COLOR[flag] }}>{signals.join(' · ')}</div>
        )}
        {forms && <div className="mt-1 text-[12px] text-slate-600">{forms}</div>}
      </li>
    );
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold" style={{ color: NAVY }}>מי נתקע היום</h1>
          <p className="text-[12px] text-slate-500">
            לוגים של תקופת ההרצה, לעידן בלבד.
            {dataUpdatedAt > 0 && <> עודכן {agoLabel(Math.max(0, now - dataUpdatedAt))}, מתרענן לבד כל דקה.</>}
          </p>
        </div>
        <nav className="flex items-center gap-1 text-sm">
          <Link to={`/admin/app-logs/${shiftDate(day, -1)}`} className="rounded-md p-1.5 hover:bg-slate-100" aria-label="יום קודם">
            <ChevronRight className="h-4 w-4" />
          </Link>
          <span className="min-w-36 text-center font-semibold" style={{ color: NAVY }}>{morningDayLabel(day)}</span>
          {day < today ? (
            <Link to={shiftDate(day, 1) === today ? '/admin/app-logs' : `/admin/app-logs/${shiftDate(day, 1)}`}
              className="rounded-md p-1.5 hover:bg-slate-100" aria-label="יום הבא">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : <span className="w-7" />}
        </nav>
      </header>

      {isError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          טעינת הלוגים נכשלה: {(error as Error).message}
        </div>
      ) : isLoading || !data ? (
        <div className="p-10 text-center text-sm text-slate-400">טוען…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Kpi n={field.length} t="בשטח באפליקציה" />
            <Kpi n={office.length} t="במשרד בדשבורד" />
            <Kpi n={data.problems.length} t="דיווחי יש בעיה" color={data.problems.length ? FLAG_COLOR.red : undefined} />
            <Kpi n={needAttention} t="דורשים תשומת לב" color={needAttention ? FLAG_COLOR.amber : undefined} />
          </div>

          {data.problems.length > 0 && (
            <Panel icon={<AlertTriangle className="h-4 w-4" />} title="דיווחי יש בעיה" hint="מהחדש לישן">
              <ul className="space-y-2">
                {data.problems.map((p) => (
                  <li key={p.occurred_at + (p.user_name ?? '')} className="rounded-xl border p-3" style={{ borderColor: '#fbd5c5', background: FLAG_BG.red }}>
                    <div className="flex flex-wrap gap-x-3 text-[12.5px]">
                      <b style={{ color: NAVY }}>{p.user_name ?? 'לא מזוהה'}</b>
                      <span><bdi>{hhmm(p.occurred_at)}</bdi></span>
                      <span className="font-semibold" style={{ color: FLAG_COLOR.red }}>{p.topic}</span>
                      {p.customer_name && <span>אצל {p.customer_name}</span>}
                      {p.screen && <bdi dir="ltr" className="text-slate-500">{p.screen}</bdi>}
                    </div>
                    {p.text && <p className="mt-1 text-sm text-slate-700">{p.text}</p>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel icon={<Users className="h-4 w-4" />} title="בשטח" hint="אדום וכתום למעלה">
            {field.length ? <ul className="space-y-2">{field.map(renderUser)}</ul>
              : <p className="text-sm text-slate-400">אף אחד מהשטח עוד לא נכנס היום באפליקציה המעודכנת.</p>}
          </Panel>

          {data.silent.length > 0 && (
            <Panel icon={<PhoneOff className="h-4 w-4" />} title="יש להם עצירות היום ולא נראו באפליקציה"
              hint="לא פתחו, או עדיין על גרסה בלי לוגים">
              <div className="flex flex-wrap gap-2">
                {data.silent.map((s) => (
                  <span key={s.name} className="rounded-full bg-slate-100 px-3 py-1 text-[12.5px] text-slate-700">
                    {s.name} · <bdi>{s.stops}</bdi> עצירות
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {data.form_blocks.length > 0 && (
            <Panel icon={<ClipboardList className="h-4 w-4" />} title="איפה נחסמו בטפסים">
              <ul className="space-y-1 text-sm">
                {data.form_blocks.map((b) => (
                  <li key={b.form_key + b.reason}>
                    <bdi dir="ltr" className="text-slate-500">{b.form_key}</bdi> · {blockReasonLabel(b.reason)} ·{' '}
                    <bdi>{b.n}</bdi> פעמים · {b.users}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {data.top_errors.length > 0 && (
            <Panel icon={<Bug className="h-4 w-4" />} title="שגיאות" hint="הנפוצות קודם">
              <ul className="space-y-2 text-sm">
                {data.top_errors.map((e) => (
                  <li key={e.name}>
                    <div className="flex flex-wrap gap-x-2">
                      <bdi dir="ltr" className="font-semibold" style={{ color: NAVY }}>{e.name}</bdi>
                      <span className="text-slate-500"><bdi>{e.n}</bdi> פעמים · <bdi>{e.users}</bdi> משתמשים</span>
                      {KNOWN_ERRORS[e.name] && <span className="text-[12px] text-emerald-700">{KNOWN_ERRORS[e.name]}</span>}
                    </div>
                    {e.sample && <div dir="ltr" className="mt-0.5 truncate text-start text-[11.5px] text-slate-400">{e.sample}</div>}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          <Panel icon={<Users className="h-4 w-4" />} title="במשרד">
            {office.length ? <ul className="space-y-2">{office.map(renderUser)}</ul>
              : <p className="text-sm text-slate-400">אף אחד מהמשרד לא נכנס לדשבורד ביום הזה.</p>}
          </Panel>
        </>
      )}
    </div>
  );
}
