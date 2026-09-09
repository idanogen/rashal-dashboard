/**
 * דוח בוקר טוב למנהלים, מסך משלו.
 *
 * ⭐ **נולד מבקשה של עידן** (<bdi>09/09/2026</bdi>): "מסך או אזור שיעזור
 * למנהלים להבין כמה סופק אתמול, דוח בוקר טוב על אספקות של אתמול ובנוסף
 * היסטוריה." שלוש שאלות בכל בוקר: מה סופק, מה לא ולמה, ואיך זה נראה
 * לאורך זמן.
 *
 * ההחלטות: מסך בתפריט ההנהלה עם כרטיס בדשבורד ההנהלה · הודעת וואטסאפ
 * בשבע בבוקר בימי עבודה עם קישור לכאן (`/morning/<תאריך>`) · "סופק" =
 * רק "בוצע". 🔴 פתוחות מחוץ לאחוז: עצירה שלא נסגרה היא בעיית דיווח,
 * לא כישלון אספקה, ומי שלא דיווח על כלום מסומן "לא דיווח" ולא 0%.
 */
import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Sun, TrendingUp, XCircle } from 'lucide-react';
import { useMorningReport } from '@/hooks/useMorningReport';
import {
  deliveryRate, driverReported, morningDayLabel, morningMonthLabel, morningShortDay, shiftDate, todayLocal,
} from '@/lib/morning-report';

const NAVY = '#14223a';
const GREEN = '#15803d';
const RED = '#c2410c';
const AMBER = '#b45309';

const KIND_LABEL: Record<string, string> = { driver: 'נהג', technician: 'טכנאי', both: 'נהג וטכנאי' };
const SOURCE_LABEL: Record<string, string> = { delivery: 'אספקה', order: 'אספקה', service: 'שירות', service_call: 'שירות', pickup: 'איסוף', task: 'משימה', customer: 'ביקור', inspection: 'בדיקת מנוף' };
const REASON_KIND_LABEL: Record<string, string> = { not_done: 'לא סופק', follow_up: 'המשך טיפול' };

function Panel({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
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

function Kpi({ n, t, sub, color, accent }: { n: React.ReactNode; t: string; sub?: string; color?: string; accent: string }) {
  return (
    <div className="rounded-2xl border bg-white p-4 text-center shadow-sm" style={{ borderColor: '#eef1f6', borderTopWidth: 3, borderTopColor: accent }}>
      <div className="text-3xl font-extrabold leading-none" style={{ color: color ?? NAVY }}><bdi>{n}</bdi></div>
      <div className="mt-1.5 text-[12px] font-semibold text-slate-600">{t}</div>
      {sub && <div className="text-[10.5px] text-slate-400">{sub}</div>}
    </div>
  );
}

function RateBar({ delivered, notDelivered, reported }: { delivered: number; notDelivered: number; reported: boolean }) {
  const rate = deliveryRate(delivered, notDelivered);
  if (!reported) {
    return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">לא דיווח</span>;
  }
  if (rate == null) return <span className="text-[11px] text-slate-400">אין</span>;
  const color = rate >= 90 ? GREEN : rate >= 70 ? AMBER : RED;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-2 w-16 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full" style={{ width: `${rate}%`, background: color }} />
      </span>
      <bdi className="text-[12px] font-bold" style={{ color }}>{rate}%</bdi>
    </span>
  );
}

export function MorningReportPage() {
  const { date: dateParam } = useParams<{ date?: string }>();
  const navigate = useNavigate();
  const requested = dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) ? dateParam : null;
  const { data, isLoading, isError } = useMorningReport(requested);

  const date = data?.date ?? requested ?? '';
  const t = data?.totals;
  const rate = t ? deliveryRate(t.delivered, t.not_delivered) : null;
  const today = todayLocal();
  const canGoForward = date !== '' && date < shiftDate(today, -1);

  const trend = useMemo(() => (data?.trend ?? []).filter((d) => d.planned > 0), [data]);
  const trendMax = Math.max(1, ...trend.map((d) => d.planned));

  return (
    <div style={{ background: '#f5f7fb' }} className="-mx-4 -my-6 min-h-screen px-4 py-5 sm:-mx-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2 text-xl font-extrabold" style={{ color: NAVY }}>
            <Sun className="h-5 w-5 text-amber-500" /> דוח בוקר
          </div>
          <div className="text-[11px] text-slate-400">
            {date ? morningDayLabel(date) : ''}{isLoading ? ' · טוען…' : ''}
          </div>
        </div>
        {/* בורר יום: יום אחורה, יום קדימה, וחזרה ל"אתמול" (ברירת המחדל של המסד). */}
        <div className="flex items-center gap-1 rounded-xl border bg-white p-1 shadow-sm" style={{ borderColor: '#eef1f6' }}>
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-50"
            title="יום אחורה"
            disabled={!date}
            onClick={() => navigate(`/morning/${shiftDate(date, -1)}`)}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <input
            type="date"
            dir="ltr"
            className="rounded-lg border-0 bg-transparent px-1 text-[12.5px] text-slate-700 outline-none"
            value={date}
            max={shiftDate(today, -1)}
            onChange={(e) => e.target.value && navigate(`/morning/${e.target.value}`)}
          />
          <button
            type="button"
            className="rounded-lg px-2 py-1 text-slate-500 hover:bg-slate-50 disabled:opacity-30"
            title="יום קדימה"
            disabled={!canGoForward}
            onClick={() => navigate(`/morning/${shiftDate(date, 1)}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {requested && (
            <Link to="/morning" className="rounded-lg px-2 py-1 text-[12px] font-semibold hover:bg-slate-50" style={{ color: NAVY }}>
              אתמול
            </Link>
          )}
        </div>
      </div>

      {isError && (
        <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">הדוח לא נטען. נסו לרענן.</div>
      )}

      {/* ═══ המספרים של היום ═══ */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <Kpi n={t?.planned ?? '…'} t="שובצו" sub={t ? `${t.drivers} נהגים וטכנאים` : undefined} accent={NAVY} />
        <Kpi n={t?.delivered ?? '…'} t="סופקו" sub='נסגרו "בוצע"' color={GREEN} accent={GREEN} />
        <Kpi n={t?.not_delivered ?? '…'} t="לא סופקו" sub="עם סיבה מהשטח" color={t && t.not_delivered > 0 ? RED : NAVY} accent={RED} />
        <Kpi n={t?.open ?? '…'} t="נשארו פתוחות" sub="לא דווחו במערכת" color={t && t.open > 0 ? AMBER : NAVY} accent={AMBER} />
        <Kpi
          n={rate == null ? (t ? 'אין דיווח' : '…') : `${rate}%`}
          t="אחוז אספקה"
          sub={t ? `מתוך מה שדווח (${t.delivered + t.not_delivered})` : undefined}
          color={rate == null ? '#8a96a8' : rate >= 90 ? '#1d4ed8' : rate >= 70 ? AMBER : RED}
          accent="#1d4ed8"
        />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* ═══ לפי נהג ═══ */}
        <div className="lg:col-span-3">
          <Panel icon={<ClipboardList className="h-4 w-4" />} title="לפי נהג וטכנאי" hint="פתוחות מחוץ לאחוז">
            {data && data.byDriver.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">לא היו עצירות ביום הזה.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-[10.5px] text-slate-400">
                      <th className="py-1.5 text-start font-semibold">שם</th>
                      <th className="py-1.5 text-center font-semibold">שובצו</th>
                      <th className="py-1.5 text-center font-semibold">סופקו</th>
                      <th className="py-1.5 text-center font-semibold">לא סופקו</th>
                      <th className="py-1.5 text-center font-semibold">פתוחות</th>
                      <th className="py-1.5 text-start font-semibold">אחוז אספקה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.byDriver ?? []).map((d) => {
                      const reported = driverReported(d);
                      return (
                        <tr key={d.name} className="border-t" style={{ borderColor: '#f0f3f8' }}>
                          <td className="py-2 font-semibold" style={{ color: NAVY }}>
                            {d.name}
                            {d.kind && <span className="ms-1.5 text-[10px] font-normal text-slate-400">{KIND_LABEL[d.kind] ?? d.kind}</span>}
                          </td>
                          <td className="py-2 text-center"><bdi>{d.planned}</bdi></td>
                          <td className="py-2 text-center font-semibold" style={{ color: d.delivered > 0 ? GREEN : undefined }}><bdi>{d.delivered}</bdi></td>
                          <td className="py-2 text-center" style={{ color: d.not_delivered > 0 ? RED : undefined }}><bdi>{d.not_delivered}</bdi></td>
                          <td className="py-2 text-center">
                            {d.open > 0
                              ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold" style={{ color: AMBER }}><bdi>{d.open}</bdi></span>
                              : <bdi className="text-slate-400">0</bdi>}
                          </td>
                          <td className="py-2"><RateBar delivered={d.delivered} notDelivered={d.not_delivered} reported={reported} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        {/* ═══ לא סופק ואיפה זה עומד ═══ */}
        <div className="lg:col-span-2">
          <Panel icon={<XCircle className="h-4 w-4" />} title="לא סופק ואיפה זה עומד" hint="מה שהמנהל צריך לטפל בו">
            {data && data.notDelivered.length === 0 && data.open.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">הכל סופק ודווח. בוקר טוב.</div>
            ) : (
              <div className="space-y-2">
                {(data?.notDelivered ?? []).map((s) => (
                  <div key={s.id} className="rounded-xl border px-3 py-2" style={{ borderColor: '#fde2d3', background: '#fff8f4' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12.5px] font-bold" style={{ color: NAVY }}>
                        {s.customer ?? 'לקוח'}{s.city ? ` · ${s.city}` : ''}
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: RED }}>
                        {REASON_KIND_LABEL[s.kind ?? ''] ?? 'לא סופק'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-slate-600">
                      {s.driver ?? ''}{s.source ? ` · ${SOURCE_LABEL[s.source] ?? s.source}` : ''}
                      {s.reason ? ` · ${s.reason}` : ''}
                    </div>
                    {s.note && <div className="mt-0.5 text-[11px] text-slate-500">{s.note}</div>}
                  </div>
                ))}
                {(data?.open ?? []).map((s) => (
                  <div key={s.id} className="rounded-xl border px-3 py-2" style={{ borderColor: '#fdecc8', background: '#fffbf0' }}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-[12.5px] font-bold" style={{ color: NAVY }}>
                        {s.customer ?? 'לקוח'}{s.city ? ` · ${s.city}` : ''}
                      </div>
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ background: '#fde68a', color: AMBER }}>
                        {s.arrived ? 'הגעתי, לא נסגר' : 'פתוחה'}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-slate-600">
                      {s.driver ?? 'לא משובץ'}{s.source ? ` · ${SOURCE_LABEL[s.source] ?? s.source}` : ''} · לברר עם {s.driver ? 'הנהג' : 'הסדרן'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* ═══ מגמה ═══ */}
        <div className="lg:col-span-3">
          <Panel icon={<TrendingUp className="h-4 w-4" />} title="המגמה: ימי העבודה האחרונים" hint="גובה העמודה = כמה שובצו, ירוק = סופקו">
            {trend.length === 0 ? (
              <div className="py-6 text-center text-sm text-slate-400">אין נתונים.</div>
            ) : (
              <div className="flex items-end gap-1.5" style={{ height: 150 }}>
                {trend.map((d) => {
                  const h = Math.round((d.planned / trendMax) * 110);
                  const dh = Math.round((d.delivered / trendMax) * 110);
                  const nh = Math.round((d.not_delivered / trendMax) * 110);
                  const isCurrent = d.date === date;
                  const lbl = morningShortDay(d.date);
                  return (
                    <Link
                      key={d.date}
                      to={`/morning/${d.date}`}
                      className="flex flex-1 flex-col items-center justify-end gap-1"
                      title={`${morningDayLabel(d.date)}: ${d.delivered} מתוך ${d.planned}`}
                    >
                      <div
                        className="flex w-full flex-col justify-end overflow-hidden rounded-t-md"
                        style={{ height: h, background: '#e5e9f0', outline: isCurrent ? `2px solid ${NAVY}` : undefined, outlineOffset: 1 }}
                      >
                        <div style={{ height: nh, background: RED }} />
                        <div style={{ height: dh, background: GREEN }} />
                      </div>
                      <div className="text-[10px] font-semibold text-slate-500">{lbl.dow}</div>
                      <div className="text-[9.5px] text-slate-400"><bdi>{lbl.date}</bdi></div>
                      <div className="text-[9.5px] font-semibold" style={{ color: NAVY }}><bdi>{d.delivered}/{d.planned}</bdi></div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Panel>
        </div>

        {/* ═══ לפי חודש ═══ */}
        <div className="lg:col-span-2">
          <Panel icon={<CalendarDays className="h-4 w-4" />} title="לפי חודש" hint="עד היום שנבחר">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-[10.5px] text-slate-400">
                  <th className="py-1.5 text-start font-semibold">חודש</th>
                  <th className="py-1.5 text-center font-semibold">ימים</th>
                  <th className="py-1.5 text-center font-semibold">שובצו</th>
                  <th className="py-1.5 text-center font-semibold">סופקו</th>
                  <th className="py-1.5 text-center font-semibold">פתוחות</th>
                  <th className="py-1.5 text-start font-semibold">אחוז</th>
                </tr>
              </thead>
              <tbody>
                {(data?.months ?? []).map((m) => (
                  <tr key={m.month} className="border-t" style={{ borderColor: '#f0f3f8' }}>
                    <td className="py-2 font-semibold" style={{ color: NAVY }}>{morningMonthLabel(m.month)}</td>
                    <td className="py-2 text-center"><bdi>{m.workdays}</bdi></td>
                    <td className="py-2 text-center"><bdi>{m.planned}</bdi></td>
                    <td className="py-2 text-center font-semibold" style={{ color: GREEN }}><bdi>{m.delivered}</bdi></td>
                    <td className="py-2 text-center" style={{ color: m.open > 0 ? AMBER : undefined }}><bdi>{m.open}</bdi></td>
                    <td className="py-2"><RateBar delivered={m.delivered} notDelivered={m.not_delivered} reported /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[10.5px] text-slate-400">
              המערכת מלאה מיולי 2026. חודש מוקדם יותר חלקי.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
