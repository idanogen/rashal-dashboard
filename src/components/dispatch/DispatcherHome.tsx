import { AlertTriangle, PhoneOff, MapPinOff, CalendarX2, Clock, ArrowLeft } from 'lucide-react';

/**
 * ─── מסך הפתיחה של הסדרן ─────────────────────────────────────────────────
 *
 * **הבקשה (עידן, 02/09/2026):** "אנחנו אוספים הרבה מידע וחבל לא להשתמש בו."
 *
 * ⭐ **הכלל שמארגן את המסך: כל מספר כאן הוא עבודה שאפשר לעשות עכשיו**, ולא
 * מדד. לכן אין כאן גרפים, אין מגמות, ואין אחוזים.
 *
 * 🔴🔴 **והכלל השני, שנולד מטעות שלי בטיוטה הראשונה: מספר בלי חלון זמן
 * משקר.** הצעתי "7 נסיעות מיותרות היום" ו"150 לקוחות שלא יודעים", ואז
 * מדדתי לפי תאריך: **כל ה-7, כל ה-4, ו-141 מתוך ה-150 מתוארכים לעבר.**
 * כלומר כל השורה הדחופה שלי הייתה בעצם שאריות ישנות בשלוש מסכות שונות,
 * והסדרן היה לוחץ, מגלה עצירות מלפני חודשיים, ומפסיק להאמין למסך ביום
 * הראשון. **מה שקורה היום מופרד עכשיו במפורש ממה שנשאר פתוח מהעבר.**
 *
 * 🔴 **וכל מספר הוא כפתור שפותח את הרשימה המסוננת.** מספר שאי אפשר ללחוץ
 * עליו הוא דוח, והסדרן לא צריך דוח.
 */

export interface DispatcherHomeData {
  cancelledButScheduled: number;
  /** רק של היום. הכלל: מספר בלי חלון זמן משקר. */
  uncoordinatedToday: number;
  needsCancel: number;
  staleStops: number;
  noAddress: number;
  over30: number;
  over90: number;
  pendingTotal: number;
  arrivedThisWeek: number;
  scheduledToday: number;
  scheduledTomorrow: number;
  returnedFromRoute: number;
  topCities: { city: string; n: number }[];
}

function Tile({
  n, label, hint, tone, icon,
}: {
  n: number; label: string; hint?: string; tone: 'red' | 'amber' | 'slate'; icon: React.ReactNode;
}) {
  const c = {
    red: { bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c' },
    amber: { bg: '#fffbeb', bd: '#fde68a', fg: '#b45309' },
    slate: { bg: '#f8fafc', bd: '#e2e8f0', fg: '#334155' },
  }[tone];
  return (
    <button
      className="flex w-full items-center gap-3 rounded-xl border p-3 text-start transition hover:shadow-sm"
      style={{ background: c.bg, borderColor: c.bd }}
    >
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg" style={{ background: '#fff', color: c.fg }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold leading-tight" style={{ color: '#0f172a' }}>{label}</span>
        {hint && <span className="block text-[11px] leading-tight text-slate-500">{hint}</span>}
      </span>
      <span className="flex-none text-2xl font-bold tabular-nums" style={{ color: c.fg }}>{n}</span>
      <ArrowLeft className="h-4 w-4 flex-none text-slate-300" />
    </button>
  );
}

function Row({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
        {note && <span className="text-[11px] text-slate-500">{note}</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-3">{children}</div>
    </section>
  );
}

export function DispatcherHome({ d, name = 'עמי' }: { d: DispatcherHomeData; name?: string }) {
  const peak = Math.max(...d.topCities.map((c) => c.n), 1);
  return (
    <div dir="rtl" className="mx-auto max-w-4xl p-4">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-slate-900">בוקר טוב, {name}</h1>
          <p className="text-[13px] text-slate-500">
            היום משובצות <b className="text-slate-700">{d.scheduledToday}</b> עצירות
          </p>
        </div>
        {/* 🔴 השורה שאף מסך לא אומר היום. אם ב-17:00 היא עדיין אפס, מחר
            אף נהג לא יוצא. */}
        {d.scheduledTomorrow === 0 ? (
          <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2">
            <CalendarX2 className="h-4 w-4 text-amber-600" />
            <span className="text-[13px] font-semibold text-amber-800">מחר עדיין לא שובץ כלום</span>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-600">
            מחר משובצות <b>{d.scheduledTomorrow}</b>
          </div>
        )}
      </div>

      <Row title="היום ומחר" note="מה שקורה בפועל בימים הקרובים">
        <Tile n={d.scheduledToday} tone="slate" icon={<CalendarX2 className="h-5 w-5" />}
          label="עצירות משובצות היום" />
        <Tile n={d.uncoordinatedToday} tone="amber" icon={<PhoneOff className="h-5 w-5" />}
          label="מהיום, בלי שהלקוח יודע" hint="בלי תיאום טלפוני ובלי הודעה" />
        <Tile n={d.returnedFromRoute} tone="amber" icon={<AlertTriangle className="h-5 w-5" />}
          label="חזרו מהקו ומחכים להחלטה" hint="הנהג רשם סיבה לכל אחד" />
      </Row>

      <Row title="התור שממתין לשיבוץ" note={`${d.pendingTotal} ממתינים, ומהם רק ${d.arrivedThisWeek} נכנסו השבוע`}>
        <Tile n={d.noAddress} tone="red" icon={<MapPinOff className="h-5 w-5" />}
          label="אי אפשר לנתב, חסרה כתובת" hint="שיחת טלפון אחת פותחת אותם" />
        <Tile n={d.over30} tone="amber" icon={<Clock className="h-5 w-5" />}
          label="ממתינים מעל 30 יום" />
        <Tile n={d.over90} tone="amber" icon={<Clock className="h-5 w-5" />}
          label="ממתינים מעל 90 יום" hint={`מתוך ה-${d.over30}`} />
      </Row>

      {/* 🔴 שורה נפרדת, ובכוונה: אלה אינם עבודה של היום אלא ניקוי, והם
          מזהמים כל מדד אחר כל עוד הם פתוחים. */}
      <Row title="נשאר פתוח מהעבר" note="לא עבודה של היום, אבל זה מה שמלכלך את כל השאר">
        <Tile n={d.staleStops} tone="red" icon={<Clock className="h-5 w-5" />}
          label="עצירות פתוחות בתאריך שעבר" hint="הוותיקה מאפריל" />
        <Tile n={d.cancelledButScheduled} tone="red" icon={<AlertTriangle className="h-5 w-5" />}
          label="מתוכן, בוטלו בפריוריטי" hint="לסגור, לא לנסוע" />
        <Tile n={d.needsCancel} tone="amber" icon={<CalendarX2 className="h-5 w-5" />}
          label="מתוכן, יש לבטל תיאום" />
      </Row>

      <section>
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="text-[15px] font-bold text-slate-900">איפה העבודה מחכה</h2>
          <span className="text-[11px] text-slate-500">צפיפות היא מה שהופך רשימה למסלול</span>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          {d.topCities.map((c) => (
            <button key={c.city} className="mb-1.5 flex w-full items-center gap-3 text-start last:mb-0">
              <span className="w-24 flex-none truncate text-[13px] text-slate-700">{c.city}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full bg-blue-500" style={{ width: `${(c.n / peak) * 100}%` }} />
              </span>
              <span className="w-8 flex-none text-end text-[13px] font-bold tabular-nums text-slate-800">{c.n}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
