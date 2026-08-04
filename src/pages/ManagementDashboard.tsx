import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import {
  Truck, Wrench, PackageOpen, Timer, TrendingUp, AlertTriangle, MapPin, Users, Info,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useOrders } from '@/hooks/useOrders';
import { useServiceCalls } from '@/hooks/useServiceCalls';
import { usePickups } from '@/hooks/usePickups';
import { useCalendarStops } from '@/hooks/useCalendarStops';
import { computeManagementMetrics, SLA_DAYS } from '@/lib/management-metrics';

const NAVY = '#14223a';
const BLUE = '#2b6cb0';
const TEAL = '#159a8a';
const GREEN = '#1e8e5a';
const AMBER = '#e0a800';
const RED = '#c0392b';
const PURPLE = '#6b46c1';

function KpiCard({ icon, title, accent, children }: { icon: React.ReactNode; title: string; accent: string; children: React.ReactNode }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-bold" style={{ color: NAVY }}>{title}</h3>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ background: accent }}>{icon}</div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
function Stat({ n, t, color }: { n: React.ReactNode; t: string; color?: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-extrabold leading-tight" style={{ color: color ?? NAVY }}>{n}</div>
      <div className="text-[11px] text-muted-foreground">{t}</div>
    </div>
  );
}
function Panel({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <Card className="border shadow-sm">
      <CardContent className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <span style={{ color: NAVY }}>{icon}</span>
          <h3 className="text-sm font-semibold" style={{ color: NAVY }}>{title}</h3>
          {hint && <span className="ms-auto text-[11px] text-muted-foreground">{hint}</span>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function ManagementDashboard() {
  const { data: orders = [], isLoading: l1 } = useOrders();
  const { data: serviceCalls = [], isLoading: l2 } = useServiceCalls();
  const { data: pickups = [], isLoading: l3 } = usePickups();
  const { data: stops = [], isLoading: l4 } = useCalendarStops();
  const loading = l1 || l2 || l3 || l4;

  const m = useMemo(
    () => computeManagementMetrics(orders, serviceCalls, pickups, stops),
    [orders, serviceCalls, pickups, stops],
  );

  const maxFunnel = Math.max(...m.pickupFunnel.map((f) => f.value), 1);
  const maxTech = Math.max(...m.callsByTechnician.map((t) => t.value), 1);
  const maxRegion = Math.max(...m.activityByRegion.map((r) => r.value), 1);
  const regionColors = [BLUE, TEAL, GREEN, AMBER, PURPLE, '#8a96a8'];

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold" style={{ color: NAVY }}>דשבורד הנהלה</h1>
        <p className="text-sm text-muted-foreground">תמונת מצב תפעולית חיה מנתוני פריוריטי{loading ? ' · טוען…' : ''}</p>
      </div>

      {/* KPI groups */}
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard title="אספקות" accent={GREEN} icon={<Truck className="h-4 w-4" />}>
          <div className="grid grid-cols-3 gap-2">
            <Stat n={m.kpi.deliveries.todayPlanned} t="מתוכננות היום" color={BLUE} />
            <Stat n={m.kpi.deliveries.todayDone} t="בוצעו היום" color={GREEN} />
            <Stat n={m.kpi.deliveries.late} t="באיחור" color={RED} />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
            <Stat n={`${m.kpi.deliveries.slaPct}%`} t={`עמידה ב-SLA (${SLA_DAYS} ימים)`} color={GREEN} />
            <Stat n={m.kpi.deliveries.avgDays ?? '—'} t="זמן אספקה ממוצע (ימים)" />
          </div>
        </KpiCard>

        <KpiCard title="קריאות שירות" accent={BLUE} icon={<Wrench className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-2">
            <Stat n={m.kpi.service.open} t="פתוחות" color={BLUE} />
            <Stat n={m.kpi.service.doneThisMonth} t="נסגרו החודש" color={GREEN} />
          </div>
          <div className="mt-3 border-t pt-3">
            <Stat n={m.kpi.service.avgCloseHours ?? '—'} t="זמן סגירה ממוצע (שעות)" />
          </div>
        </KpiCard>

        <KpiCard title="איסופי ציוד" accent={TEAL} icon={<PackageOpen className="h-4 w-4" />}>
          <div className="grid grid-cols-3 gap-2">
            <Stat n={m.kpi.pickups.waiting} t="ממתינים" color={AMBER} />
            <Stat n={m.kpi.pickups.collected} t="נאספו" color={TEAL} />
            <Stat n={m.kpi.pickups.cancelled} t="בוטלו" color="#8a96a8" />
          </div>
          <div className="mt-3 border-t pt-3">
            <Stat n={`${m.kpi.pickups.donePct}%`} t="אחוז ביצוע" color={TEAL} />
          </div>
        </KpiCard>

        <KpiCard title="חריגים לטיפול" accent={RED} icon={<AlertTriangle className="h-4 w-4" />}>
          <div className="grid grid-cols-3 gap-2">
            <Stat n={m.exceptions.lateDeliveries} t="אספקות באיחור" color={RED} />
            <Stat n={m.exceptions.pickupsOver14d} t="איסופים מעל 14 יום" color={AMBER} />
            <Stat n={m.exceptions.unlocatedStops} t="ללא מיקום במפה" color="#8a96a8" />
          </div>
        </KpiCard>
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
                <Tooltip contentStyle={{ fontSize: 12, direction: 'rtl' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="נפתחו" dataKey="a" fill={BLUE} radius={[3, 3, 0, 0]} />
                <Bar name="נסגרו" dataKey="b" fill={NAVY} radius={[3, 3, 0, 0]} />
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
                <Tooltip contentStyle={{ fontSize: 12, direction: 'rtl' }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar name="הוזמנו" dataKey="a" fill="#a9c2e0" radius={[3, 3, 0, 0]} />
                <Bar name="סופקו" dataKey="b" fill={GREEN} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Charts row 2 */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel icon={<PackageOpen className="h-4 w-4" />} title="משפך איסופים">
          <div className="space-y-2 py-1">
            {m.pickupFunnel.map((f, i) => (
              <div key={f.label} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs text-muted-foreground">{f.label}</span>
                <div className="h-6 flex-1 overflow-hidden rounded bg-muted/40">
                  <div className="flex h-full items-center justify-end rounded pe-2 text-[11px] font-bold text-white"
                    style={{ width: `${Math.max((f.value / maxFunnel) * 100, 8)}%`, background: [TEAL, '#38b2ac', '#4fd1c5'][i] ?? TEAL }}>
                    {f.value}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel icon={<Users className="h-4 w-4" />} title="קריאות לפי טכנאי">
          {m.callsByTechnician.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">אין עדיין שיבוצי שירות</p>
          ) : (
            <div className="space-y-2 py-1">
              {m.callsByTechnician.map((t) => (
                <div key={t.name} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 truncate text-xs">{t.name}</span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-muted/40">
                    <div className="h-full rounded" style={{ width: `${(t.value / maxTech) * 100}%`, background: BLUE }} />
                  </div>
                  <span className="w-6 shrink-0 text-start text-xs font-bold" style={{ color: NAVY }}>{t.value}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel icon={<MapPin className="h-4 w-4" />} title="פעילות לפי אזור">
          <div className="space-y-2 py-1">
            {m.activityByRegion.map((r, i) => (
              <div key={r.name} className="flex items-center gap-2">
                <span className="w-20 shrink-0 truncate text-xs">{r.name}</span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted/40">
                  <div className="h-full rounded" style={{ width: `${(r.value / maxRegion) * 100}%`, background: regionColors[i % regionColors.length] }} />
                </div>
                <span className="w-8 shrink-0 text-start text-xs font-bold" style={{ color: NAVY }}>{r.value}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* satisfaction placeholder note */}
      <Card className="border shadow-sm" style={{ borderColor: '#e3e8f0' }}>
        <CardContent className="flex items-start gap-3 p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: AMBER }}>
            <Info className="h-4 w-4" />
          </div>
          <div className="text-sm">
            <b style={{ color: NAVY }}>פאנלי שביעות רצון (CSAT / NPS / דירוגים) יתווספו כאן</b> כשמנוע הסקרים יזרים תשובות.
            הנתונים האלה לא קיימים בפריוריטי, ולכן נאספים דרך סקר WhatsApp אחרי כל שירות.
            <span className="text-muted-foreground"> ראה מסמך מיפוי הנתונים.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
