import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  Truck, Wrench, PackageOpen, Smile, Clock, Box, Frown, TrendingUp, MapPin, Users,
  Calendar, MapPinned, Menu,
} from 'lucide-react';
import { ActivityHeatMap } from '@/components/dashboard/ActivityHeatMap';
import { useOrders } from '@/hooks/useOrders';
import { useServiceCalls } from '@/hooks/useServiceCalls';
import { usePickups } from '@/hooks/usePickups';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { computeManagementMetrics, SLA_DAYS } from '@/lib/management-metrics';
import { useSurveys } from '@/hooks/useSurveys';
import { computeSurveyMetrics, formatScore } from '@/lib/surveys';

const NAVY = '#14223a';
const BLUE = '#2b6cb0';
const PURPLE = '#7c5cf0';
const GREEN = '#16a34a';
const AMBER = '#e0a800';
const RED = '#dc2626';

/* ---- כרטיס KPI בסגנון המוקאפ: כותרת מימין, אייקון בעיגול צבעוני משמאל ---- */
function KpiCard({
  title, icon, accent, muted, top, bottom,
}: {
  title: string; icon: React.ReactNode; accent: string; muted?: boolean;
  top: React.ReactNode; bottom?: React.ReactNode;
}) {
  return (
    <div className={`rounded-2xl border bg-white p-5 shadow-sm ${muted ? 'opacity-95' : ''}`} style={{ borderColor: '#eef1f6' }}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-bold" style={{ color: muted ? '#8a96a8' : NAVY }}>{title}</h3>
        <div className="flex h-9 w-9 items-center justify-center rounded-full text-white" style={{ background: accent }}>{icon}</div>
      </div>
      {top}
      {bottom && <div className="mt-4 grid grid-cols-2 gap-2 border-t pt-3" style={{ borderColor: '#f0f3f8' }}>{bottom}</div>}
    </div>
  );
}
function Big({ n, t, color }: { n: React.ReactNode; t: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-[26px] font-extrabold leading-none" style={{ color: color ?? NAVY }}>{n}</div>
      <div className="mt-1 text-[11px] text-slate-500">{t}</div>
    </div>
  );
}
function ProgressStat({ pct, label, color }: { pct: number; label: string; color: string }) {
  return (
    <div className="col-span-2">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[11px] text-slate-500">{label}</span>
        <span className="text-lg font-extrabold" style={{ color }}>{pct}%</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}
function Panel({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
      <div className="mb-4 flex items-center gap-2">
        <span style={{ color: NAVY }}>{icon}</span>
        <h3 className="text-sm font-bold" style={{ color: NAVY }}>{title}</h3>
        {hint && <span className="ms-auto text-[11px] text-slate-400">{hint}</span>}
      </div>
      {children}
    </div>
  );
}
function ExceptionCard({ icon, n, label, tint, fg }: { icon: React.ReactNode; n: number; label: string; tint: string; fg: string }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: tint }}>
      <div className="mb-2 flex items-center justify-between">
        <span style={{ color: fg }}>{icon}</span>
        <span className="text-[28px] font-extrabold leading-none" style={{ color: fg }}>{n}</span>
      </div>
      <div className="text-[12.5px] font-medium" style={{ color: NAVY }}>{label}</div>
    </div>
  );
}

export function ManagementDashboard() {
  const { data: orders = [], isLoading: l1 } = useOrders();
  const { data: serviceCalls = [], isLoading: l2 } = useServiceCalls();
  const { data: pickups = [], isLoading: l3 } = usePickups();
  const { data: stops = [], isLoading: l4 } = useCalendarStops();
  const { data: surveys = [], isLoading: l5 } = useSurveys(30);
  const loading = l1 || l2 || l3 || l4 || l5;

  const m = useMemo(
    () => computeManagementMetrics(orders, serviceCalls, pickups, stops),
    [orders, serviceCalls, pickups, stops],
  );
  const sv = useMemo(() => computeSurveyMetrics(surveys), [surveys]);

  const maxTech = Math.max(...m.callsByTechnician.map((t) => t.value), 1);
  const maxRegion = Math.max(...m.activityByRegion.map((r) => r.value), 1);
  const regionColors = [BLUE, '#38b2ac', GREEN, AMBER, PURPLE, '#8a96a8'];

  return (
    <div style={{ background: '#f5f7fb' }} className="-mx-4 -my-6 min-h-screen px-4 py-5 sm:-mx-6 sm:px-6">
      {/* Header בסגנון המוקאפ */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-5 py-3 shadow-sm" style={{ borderColor: '#eef1f6' }}>
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-slate-600" style={{ borderColor: '#e6ebf3' }}>
            <Calendar className="h-3.5 w-3.5" /> נתונים חיים
          </span>
          <span className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs text-slate-600" style={{ borderColor: '#e6ebf3' }}>
            <MapPinned className="h-3.5 w-3.5" /> כל הסניפים
          </span>
        </div>
        <div className="text-center">
          <div className="text-xl font-extrabold" style={{ color: NAVY }}>דשבורד הנהלה</div>
          <div className="text-[11px] text-slate-400">תמונת מצב כללית{loading ? ' · טוען…' : ''}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-lg font-black" style={{ color: GREEN }}>ר.<span style={{ color: NAVY }}>שעל</span></span>
          <Menu className="h-5 w-5 text-slate-400" />
        </div>
      </div>

      {/* KPI row */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* שביעות רצון. עד שתגיע התשובה הראשונה הכרטיס נשאר אפור, כדי שלא
            יציג ממוצע של מדגם אחד כאילו הוא מדד. */}
        <KpiCard title="שביעות רצון לקוחות" accent={sv.answered > 0 ? GREEN : '#cbd5e1'} muted={sv.answered === 0}
          icon={<Smile className="h-5 w-5" />}
          top={
            <div className="grid grid-cols-3 gap-2">
              <Big n={formatScore(sv.satisfaction) || '·'} t="שביעות רצון" color={sv.answered > 0 ? NAVY : '#8a96a8'} />
              <Big n={formatScore(sv.recommend) || '·'} t="ממליצים" color={sv.answered > 0 ? NAVY : '#8a96a8'} />
              <Big n={sv.responseRate === null ? '·' : `${sv.responseRate}%`} t="מענה לסקר" color={sv.answered > 0 ? GREEN : '#8a96a8'} />
            </div>
          }
          bottom={
            <div className="col-span-2 text-center text-[11px] text-slate-400">
              {sv.answered > 0
                ? `מבוסס על ${sv.answered} תשובות ב-30 יום`
                : sv.sent > 0
                  ? `${sv.sent} סקרים נשלחו, טרם התקבלה תשובה`
                  : 'טרם נשלחו סקרים'}
            </div>
          }
        />

        <KpiCard title="איסופי ציוד" accent={PURPLE} icon={<PackageOpen className="h-5 w-5" />}
          top={
            <div className="grid grid-cols-3 gap-2">
              <Big n={m.kpi.pickups.waiting} t="ממתינים" color={AMBER} />
              <Big n={m.kpi.pickups.collected} t="נאספו" color={PURPLE} />
              <Big n={m.kpi.pickups.cancelled} t="בוטלו" color="#8a96a8" />
            </div>
          }
          bottom={<ProgressStat pct={m.kpi.pickups.donePct} label="אחוז ביצוע" color={PURPLE} />}
        />

        <KpiCard title="קריאות שירות" accent={BLUE} icon={<Wrench className="h-5 w-5" />}
          top={
            <div className="grid grid-cols-2 gap-2">
              <Big n={m.kpi.service.open} t="פתוחות" color={BLUE} />
              <Big n={m.kpi.service.doneThisMonth} t="נסגרו החודש" color={GREEN} />
            </div>
          }
          bottom={
            <>
              <Big n={m.kpi.service.avgCloseHours ?? '—'} t="זמן סגירה ממוצע (שעות)" />
              <Big n={'—'} t="First Time Fix" color="#8a96a8" />
            </>
          }
        />

        <KpiCard title="אספקות" accent={GREEN} icon={<Truck className="h-5 w-5" />}
          top={
            <div className="grid grid-cols-3 gap-2">
              <Big n={m.kpi.deliveries.todayPlanned} t="מתוכננות היום" color={BLUE} />
              <Big n={m.kpi.deliveries.todayDone} t="בוצעו היום" color={GREEN} />
              <Big n={m.kpi.deliveries.late} t="באיחור" color={RED} />
            </div>
          }
          bottom={
            <>
              <Big n={`${m.kpi.deliveries.slaPct}%`} t={`עמידה ב-SLA (${SLA_DAYS} ימים)`} color={GREEN} />
              <Big n={m.kpi.deliveries.avgDays ?? '—'} t="זמן אספקה ממוצע (ימים)" />
            </>
          }
        />
      </div>

      {/* Charts row 1 */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel icon={<Wrench className="h-4 w-4" />} title="קריאות שירות לפי יום" hint="14 ימים · נפתחו מול נסגרו">
          <div className="h-[220px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.serviceByDay} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f6" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#7a889e' }} tickLine={false} axisLine={false} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#7a889e' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, direction: 'rtl', borderRadius: 10, border: '1px solid #eef1f6' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="נפתחו" dataKey="a" fill={BLUE} radius={[4, 4, 0, 0]} />
                <Bar name="נסגרו" dataKey="b" fill={NAVY} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel icon={<TrendingUp className="h-4 w-4" />} title="אספקות לפי חודש" hint="6 חודשים · הוזמנו מול סופקו">
          <div className="h-[220px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.ordersByMonth} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f6" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#7a889e' }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#7a889e' }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, direction: 'rtl', borderRadius: 10, border: '1px solid #eef1f6' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="הוזמנו" dataKey="a" fill="#bcd3ee" radius={[4, 4, 0, 0]} />
                <Bar name="סופקו" dataKey="b" fill={GREEN} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Charts row 2 */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel icon={<PackageOpen className="h-4 w-4" />} title="איסופים · משפך תהליך">
          <div className="space-y-2.5 py-1">
            {m.pickupFunnel.map((f, i) => {
              const shades = ['#c4b5fd', '#a78bfa', '#7c5cf0'];
              const width = 100 - i * 22;
              return (
                <div key={f.label} className="flex items-center gap-2">
                  <span className="w-24 shrink-0 text-xs text-slate-500">{f.label}</span>
                  <div className="flex-1">
                    <div className="mx-auto flex h-8 items-center justify-center rounded-md text-[12px] font-bold text-white"
                      style={{ width: `${width}%`, background: shades[i] }}>
                      {f.value}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel icon={<Users className="h-4 w-4" />} title="קריאות לפי טכנאי">
          {m.callsByTechnician.length === 0 ? (
            <p className="py-8 text-center text-xs text-slate-400">אין עדיין שיבוצי שירות</p>
          ) : (
            <div className="space-y-2.5 py-1">
              {m.callsByTechnician.map((t) => (
                <div key={t.name} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-xs">{t.name}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${(t.value / maxTech) * 100}%`, background: BLUE }} />
                  </div>
                  <span className="w-6 shrink-0 text-start text-xs font-bold" style={{ color: NAVY }}>{t.value}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel icon={<MapPin className="h-4 w-4" />} title="פעילות לפי אזור">
          <div className="space-y-2.5 py-1">
            {m.activityByRegion.map((r, i) => (
              <div key={r.name} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-xs">{r.name}</span>
                <div className="h-5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(r.value / maxRegion) * 100}%`, background: regionColors[i % regionColors.length] }} />
                </div>
                <span className="w-8 shrink-0 text-start text-xs font-bold" style={{ color: NAVY }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* מפת חום ארצית */}
      <div className="mb-4">
        <ActivityHeatMap orders={orders} serviceCalls={serviceCalls} pickups={pickups} stops={stops} />
      </div>

      {/* Exceptions row — פסטלים כמו במוקאפ */}
      <div className="rounded-2xl border bg-white p-5 shadow-sm" style={{ borderColor: '#eef1f6' }}>
        <h3 className="mb-4 text-center text-sm font-bold" style={{ color: NAVY }}>חריגים הדורשים טיפול</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ExceptionCard icon={<Clock className="h-5 w-5" />} n={m.exceptions.lateDeliveries} label="אספקות באיחור" tint="#fdecec" fg={RED} />
          <ExceptionCard icon={<Box className="h-5 w-5" />} n={m.exceptions.pickupsOver14d} label="איסופים מעל 14 יום" tint="#f3effe" fg={PURPLE} />
          <ExceptionCard icon={<MapPin className="h-5 w-5" />} n={m.exceptions.unlocatedStops} label="עצירות ללא מיקום במפה" tint="#eef4fd" fg={BLUE} />
          <ExceptionCard
            icon={<Frown className="h-5 w-5" />}
            n={sv.lowRated.length}
            label="לקוחות בדירוג נמוך"
            tint="#fdf6ec"
            fg={sv.lowRated.length > 0 ? '#c2410c' : '#8a96a8'}
          />
        </div>
      </div>

      {/* ── סקרי שביעות רצון ──────────────────────────────────────────
          הנקודה שבה הסקר מפסיק להיות ציון כללי והופך לכלי ניהולי: ממוצע
          פר נהג ופר קופה. הקטע כולו מוסתר עד שיש תשובה ראשונה, כדי שהמסך
          לא יתמלא בכרטיסים ריקים לפני שהמנוע רץ. */}
      {sv.answered > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Panel icon={<Smile className="h-4 w-4" />} title="שביעות רצון לפי נהג" hint="הנמוך קודם">
            <ScoreList rows={sv.byDriver} />
          </Panel>

          <Panel icon={<Users className="h-4 w-4" />} title="שביעות רצון לפי קופה" hint="הנמוך קודם">
            <ScoreList rows={sv.byFund} />
          </Panel>

          <Panel icon={<Frown className="h-4 w-4" />} title="מה הלקוחות כתבו" hint={`${sv.withComments.length} הערות`}>
            {sv.withComments.length === 0 ? (
              <p className="py-8 text-center text-xs text-slate-400">אין עדיין הערות חופשיות</p>
            ) : (
              <div className="max-h-[240px] space-y-2 overflow-y-auto py-1">
                {sv.withComments.slice(0, 20).map((s) => (
                  <div key={s.id} className="rounded-xl border p-2.5" style={{ borderColor: '#eef1f6' }}>
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-[11.5px] font-semibold" style={{ color: NAVY }}>
                        {s.customerName || 'לקוח'}
                      </span>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                        style={{
                          background: (s.satisfaction ?? 5) <= 2 ? '#fee2e2' : '#dcfce7',
                          color: (s.satisfaction ?? 5) <= 2 ? '#b91c1c' : '#166534',
                        }}
                      >
                        {s.satisfaction ?? '?'} מתוך 5
                      </span>
                    </div>
                    <p className="text-[12px] leading-relaxed text-slate-600">{s.comment}</p>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>
      )}
    </div>
  );
}

/** רשימת ממוצעים עם פס מילוי. הסולם קבוע 1 עד 5, אחרת השוואה בין נהגים משקרת. */
function ScoreList({ rows }: { rows: { name: string; avg: number; count: number }[] }) {
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
