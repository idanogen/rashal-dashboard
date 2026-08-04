// management-metrics.ts — אגרגציות תפעוליות לדשבורד ההנהלה.
// מחשב מהנתונים שכבר יש במחסן (הזמנות/קריאות/איסופים/יומן), בלי מקור חדש.
// כל מה שתלוי בנתוני סקר (CSAT/NPS/דירוגים) אינו כאן — הוא ממתין למנוע הסקרים.
import type { Order } from '@/types/order';
import type { ServiceCall } from '@/types/service-call';
import type { Pickup } from '@/types/pickup';
import type { CalendarStop } from '@/types/calendar-stop';
import { getZoneForCity, getZoneById, REGION_LABELS } from '@/types/zone';

/** יעד SLA לאספקה (עידן, 04/08): שבוע. */
export const SLA_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** תאריך מקומי YYYY-MM-DD (בלי הסטת timezone של toISOString). */
function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function daysBetween(aIso?: string, bIso?: string): number | null {
  if (!aIso || !bIso) return null;
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  return (b - a) / DAY_MS;
}
function real<T extends { duplicateOf?: string }>(rows: T[]): T[] {
  return rows.filter((r) => !r.duplicateOf);
}

export interface KpiBlock {
  deliveries: { todayPlanned: number; todayDone: number; late: number; slaPct: number; avgDays: number | null };
  service: { open: number; doneThisMonth: number; avgCloseHours: number | null };
  pickups: { waiting: number; collected: number; cancelled: number; donePct: number };
}

export interface Series { label: string; a: number; b: number }
export interface FunnelStep { label: string; value: number }
export interface NamedCount { name: string; value: number }

export interface ManagementMetrics {
  kpi: KpiBlock;
  serviceByDay: Series[];      // פתוחות (נפתחו) מול נסגרו, 14 יום
  ordersByMonth: Series[];     // הוזמנו מול סופקו, 6 חודשים
  pickupFunnel: FunnelStep[];  // ממתין → תואם → נאסף
  callsByTechnician: NamedCount[];
  activityByRegion: NamedCount[];
  exceptions: { lateDeliveries: number; pickupsOver14d: number; unlocatedStops: number };
}

export function computeManagementMetrics(
  orders: Order[],
  serviceCalls: ServiceCall[],
  pickups: Pickup[],
  stops: CalendarStop[],
): ManagementMetrics {
  const o = real(orders);
  const sc = real(serviceCalls);
  const pk = real(pickups);
  const today = localDate(new Date());
  const now = Date.now();

  const deliveryStops = stops.filter((s) => s.sourceType === 'delivery');
  const serviceStops = stops.filter((s) => s.sourceType === 'service');
  const isCompleted = (s: CalendarStop) => s.status === 'completed';
  const isActive = (s: CalendarStop) => s.status === 'planned' || s.status === 'in_progress';

  // ---- KPI: אספקות ----
  const orderById = new Map(o.map((r) => [r.id, r]));
  const todayPlanned = deliveryStops.filter((s) => s.deliveryDate === today && isActive(s)).length;
  const todayDone = deliveryStops.filter(
    (s) => isCompleted(s) && (s.completedAt ? localDate(new Date(s.completedAt)) === today : s.deliveryDate === today),
  ).length;
  const late = deliveryStops.filter((s) => isActive(s) && s.deliveryDate < today).length;

  const deliveredDurations: number[] = [];
  let slaHit = 0;
  for (const s of deliveryStops) {
    if (!isCompleted(s) || !s.orderId) continue;
    const ord = orderById.get(s.orderId);
    const d = daysBetween(ord?.created, s.completedAt);
    if (d == null || d < 0) continue;
    deliveredDurations.push(d);
    if (d <= SLA_DAYS) slaHit++;
  }
  const slaPct = deliveredDurations.length ? Math.round((slaHit / deliveredDurations.length) * 100) : 0;
  const avgDays = deliveredDurations.length
    ? Number((deliveredDurations.reduce((a, b) => a + b, 0) / deliveredDurations.length).toFixed(1))
    : null;

  // ---- KPI: קריאות שירות ----
  const openCalls = sc.filter((c) => c.serviceCallStatus === 'קריאה חדשה' || c.serviceCallStatus === 'תואם ביקור').length;
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const doneThisMonth = serviceStops.filter(
    (s) => isCompleted(s) && s.completedAt && new Date(s.completedAt) >= monthStart,
  ).length;
  const scById = new Map(sc.map((r) => [r.id, r]));
  const closeHours: number[] = [];
  for (const s of serviceStops) {
    if (!isCompleted(s) || !s.serviceCallId) continue;
    const call = scById.get(s.serviceCallId);
    const d = daysBetween(call?.created, s.completedAt);
    if (d != null && d >= 0) closeHours.push(d * 24);
  }
  const avgCloseHours = closeHours.length
    ? Number((closeHours.reduce((a, b) => a + b, 0) / closeHours.length).toFixed(1))
    : null;

  // ---- KPI: איסופים ----
  const pWaiting = pk.filter((p) => p.pickupStatus === 'ממתין לתאום').length;
  const pCoord = pk.filter((p) => p.pickupStatus === 'תואם איסוף').length;
  const pCollected = pk.filter((p) => p.pickupStatus === 'נאסף').length;
  const pCancelled = pk.filter((p) => p.pickupStatus === 'בוטל').length;
  const pTotalActive = pWaiting + pCoord + pCollected;
  const donePct = pTotalActive ? Math.round((pCollected / pTotalActive) * 100) : 0;

  // ---- קריאות שירות לפי יום (14) ----
  const serviceByDay: Series[] = [];
  const dayIndex = new Map<string, number>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now - i * DAY_MS);
    const key = localDate(d);
    dayIndex.set(key, serviceByDay.length);
    serviceByDay.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, a: 0, b: 0 });
  }
  for (const c of sc) {
    const k = c.created ? localDate(new Date(c.created)) : '';
    const i = dayIndex.get(k);
    if (i != null) serviceByDay[i].a++;
  }
  for (const s of serviceStops) {
    if (!isCompleted(s) || !s.completedAt) continue;
    const i = dayIndex.get(localDate(new Date(s.completedAt)));
    if (i != null) serviceByDay[i].b++;
  }

  // ---- אספקות לפי חודש (6) ----
  const ordersByMonth: Series[] = [];
  const monthIndex = new Map<string, number>();
  const MON = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
  const base = new Date(); base.setDate(1);
  for (let i = 5; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    monthIndex.set(key, ordersByMonth.length);
    ordersByMonth.push({ label: MON[d.getMonth()], a: 0, b: 0 });
  }
  for (const r of o) {
    if (!r.created) continue;
    const d = new Date(r.created);
    const i = monthIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i != null) ordersByMonth[i].a++;
  }
  for (const s of deliveryStops) {
    if (!isCompleted(s) || !s.completedAt) continue;
    const d = new Date(s.completedAt);
    const i = monthIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
    if (i != null) ordersByMonth[i].b++;
  }

  // ---- משפך איסופים ----
  const pickupFunnel: FunnelStep[] = [
    { label: 'ממתין לתאום', value: pWaiting + pCoord + pCollected },
    { label: 'תואם איסוף', value: pCoord + pCollected },
    { label: 'נאסף', value: pCollected },
  ];

  // ---- קריאות לפי טכנאי ----
  const techMap = new Map<string, number>();
  for (const s of serviceStops) {
    if (!s.driver) continue;
    techMap.set(s.driver, (techMap.get(s.driver) ?? 0) + 1);
  }
  const callsByTechnician = [...techMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // ---- פעילות לפי אזור (מעיר הלקוח) ----
  const regionMap = new Map<string, number>();
  const bump = (city?: string) => {
    const zoneId = city ? getZoneForCity(city) : null;
    const region = zoneId ? getZoneById(zoneId)?.region : null;
    const label = region ? REGION_LABELS[region] : 'ללא אזור';
    regionMap.set(label, (regionMap.get(label) ?? 0) + 1);
  };
  for (const s of stops) if (isActive(s) || isCompleted(s)) bump(s.city);
  const activityByRegion = [...regionMap.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  // ---- חריגים ----
  const pickupsOver14d = pk.filter(
    (p) => p.pickupStatus === 'ממתין לתאום' && p.created && (now - new Date(p.created).getTime()) > 14 * DAY_MS,
  ).length;
  const unlocatedStops = stops.filter((s) => isActive(s) && !s.coordinates).length;

  return {
    kpi: {
      deliveries: { todayPlanned, todayDone, late, slaPct, avgDays },
      service: { open: openCalls, doneThisMonth, avgCloseHours },
      pickups: { waiting: pWaiting, collected: pCollected, cancelled: pCancelled, donePct },
    },
    serviceByDay,
    ordersByMonth,
    pickupFunnel,
    callsByTechnician,
    activityByRegion,
    exceptions: { lateDeliveries: late, pickupsOver14d, unlocatedStops },
  };
}
