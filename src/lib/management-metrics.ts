// management-metrics.ts — אגרגציות תפעוליות לדשבורד ההנהלה.
// מחשב מהנתונים שכבר יש במחסן (הזמנות/קריאות/איסופים/יומן), בלי מקור חדש.
// כל מה שתלוי בנתוני סקר (CSAT/NPS/דירוגים) אינו כאן — הוא ממתין למנוע הסקרים.
import type { Order } from '@/types/order';
import type { ServiceCall } from '@/types/service-call';
import type { DeliveryNote, ConsolidatedInvoice } from '@/types/document';
import { CINVOICE_NOT_SENT } from '@/types/document';
import type { Pickup } from '@/types/pickup';
import type { CalendarStop } from '@/types/calendar-stop';
import { getZoneForCity, getZoneById, REGION_LABELS } from '@/types/zone';
import { countOpenOverDays, countRepeatCalls } from './repeat-calls';
import {
  deliveryTargetStatus, weekStart, countsTowardTarget, type TargetStatus,
} from './delivery-target';

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
  deliveries: {
    todayPlanned: number; todayDone: number; late: number; slaPct: number; avgDays: number | null;
    /** עמידה ביעד השבועי + שמונת השבועות שלפניו, לרצועה בכרטיס */
    weekly: TargetStatus;
    weeklyHistory: { weekStart: string; count: number }[];
  };
  service: { open: number; doneThisMonth: number; avgCloseHours: number | null };
  docs: {
    notesOpen: number; notesClosedThisMonth: number; notesOldestOpenDays: number | null;
    invoicesNotSent: number; invoicesSent: number; invoicesTotal: number;
  };
  pickups: { waiting: number; collected: number; cancelled: number; donePct: number };
}

export interface Series { label: string; a: number; b: number }
export interface FunnelStep { label: string; value: number }
export interface NamedCount { name: string; value: number }

export interface ManagementMetrics {
  kpi: KpiBlock;
  serviceByDay: Series[];      // פתוחות (נפתחו) מול נסגרו, 14 יום
  docsByMonth: Series[];       // תעודות משלוח: נפתחו מול נסגרו, 6 חודשים
  ordersByMonth: Series[];     // הוזמנו מול סופקו, 6 חודשים
  pickupFunnel: FunnelStep[];  // ממתין → תואם → נאסף
  callsByTechnician: NamedCount[];
  activityByRegion: NamedCount[];
  exceptions: {
    lateDeliveries: number;
    pickupsOver14d: number;
    unlocatedStops: number;
    /**
     * <span class="pill">מההערות של עידן</span> קריאות שירות פתוחות מעל
     * שבעה ימים. 🔴 **מוצג בצבע ניטרלי ולא כאזעקה**, כי המערכת בפיילוט
     * ועמי משבץ בעיקר מהיום למחר. עידן, 26/08: "עדיין לא התחלנו שימוש
     * מלא." סף התראה ייקבע רק כשהשימוש המלא יתחיל, כי סף שנקבע על נתוני
     * פיילוט מלמד את כולם להתעלם מהמסך.
     */
    callsOver7d: number;
    /**
     * 🔴 **קריאה חוזרת = פרונטלית שחוזרת לאותו מספר סידורי תוך 3 חודשים.**
     * שלומי, 20/08: "אם יש לי מישהו שכבר חוזר אני רוצה לדעת מזה."
     * ⭐ ההכרעה שלו ושל עידן הייתה פרונטליות בלבד, ולא במקרה: נמדד
     * ב-90 יום ש-402 מתוך 459 החוזרות הן טלפוניות, ואלה אינן "כבר היינו
     * אצלו". סימון כולן היה צובע שליש מהקריאות והופך לרעש.
     */
    repeatCalls: number;
  };
}

export function computeManagementMetrics(
  orders: Order[],
  serviceCalls: ServiceCall[],
  pickups: Pickup[],
  stops: CalendarStop[],
  notes: DeliveryNote[] = [],
  invoices: ConsolidatedInvoice[] = [],
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

  // ---- KPI: מסמכים כספיים ----
  // "פתוח" = טיוטא. המסמך נפתח בפריוריטי ומעולם לא נסגר סופית.
  const openNotes = notes.filter((n) => n.status === 'טיוטא');
  const notesClosedThisMonth = notes.filter(
    // אין שדה "נסגר ב-". עבור מסמך שכבר אינו טיוטא, UDATE הוא בקירוב טוב
    // רגע הסגירה, כי זה העדכון האחרון שנעשה עליו.
    (n) => n.status === 'סופית' && n.priorityUdate && new Date(n.priorityUdate) >= monthStart,
  ).length;
  const notesOldestOpenDays = openNotes.length
    ? Math.max(...openNotes.map((n) => (n.docDate ? Math.floor((now - new Date(n.docDate).getTime()) / DAY_MS) : 0)))
    : null;
  // "פתוחה" = טרם שודרה לקופה. הסטטוסים כאן הם מחזור EDI ולא טיוטא/סופית,
  // ולכן ההגדרה נשענת על רשימת סטטוסים מפורשת ולא על ערך יחיד.
  const invoicesNotSent = invoices.filter((i) => CINVOICE_NOT_SENT.includes(i.status ?? '')).length;
  const invoicesSent = invoices.filter((i) => i.status === 'vEDI-SENT').length;

  // ---- תעודות משלוח לפי חודש (6): נפתחו מול נסגרו ----
  const docsByMonth: Series[] = [];
  const docMonthIndex = new Map<string, number>();
  const docBase = new Date(); docBase.setDate(1);
  const MON_D = ['ינו', 'פבר', 'מרץ', 'אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט', 'אוק', 'נוב', 'דצמ'];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(docBase.getFullYear(), docBase.getMonth() - i, 1);
    docMonthIndex.set(`${d.getFullYear()}-${d.getMonth()}`, docsByMonth.length);
    docsByMonth.push({ label: MON_D[d.getMonth()], a: 0, b: 0 });
  }
  for (const n of notes) {
    if (n.docDate) {
      const d = new Date(n.docDate);
      const i = docMonthIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i != null) docsByMonth[i].a++;
    }
    if (n.status === 'סופית' && n.priorityUdate) {
      const d = new Date(n.priorityUdate);
      const i = docMonthIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
      if (i != null) docsByMonth[i].b++;
    }
  }

  // ---- חריגים ----
  const pickupsOver14d = pk.filter(
    (p) => p.pickupStatus === 'ממתין לתאום' && p.created && (now - new Date(p.created).getTime()) > 14 * DAY_MS,
  ).length;
  const unlocatedStops = stops.filter((s) => isActive(s) && !s.coordinates).length;

  // ⭐ שני החישובים יושבים ב-`repeat-calls.ts`, בלי ייבוא, ולכן הם
  // נבדקים ביחידה. ההגדרה עצמה (פרונטליות בלבד) היא ההכרעה שנשמרת שם.
  const callsOver7d = countOpenOverDays(sc, 7, now);
  const repeatCalls = countRepeatCalls(sc, { nowMs: now });


  // ---- יעד האספקות השבועי (שלומי, 02/09/2026) ----
  // ⭐ נספר מתעודות המשלוח, שהן המדד לאספקות שסוכם ב-26/08. הכלל עצמו
  // (מי נספרת, מתי מתחיל השבוע, ומה הקצב הצפוי) יושב ב-delivery-target.ts
  // בלי ייבוא, ולכן הוא נבדק ביחידה.
  const nowDate = new Date(now);
  const curWeekStart = weekStart(nowDate).getTime();
  const weekCounts = new Map<number, number>();
  for (const n of notes) {
    if (!countsTowardTarget(n.status, n.docDate)) continue;
    const d = new Date(n.docDate as string);
    if (Number.isNaN(d.getTime())) continue;
    const w = weekStart(d).getTime();
    weekCounts.set(w, (weekCounts.get(w) ?? 0) + 1);
  }
  const weekly = deliveryTargetStatus(weekCounts.get(curWeekStart) ?? 0, nowDate);
  // שמונת השבועות שקדמו לנוכחי, מהישן לחדש. שבוע בלי תעודות הוא אפס
  // ולא חור, אחרת הרצועה משקרת ומראה רצף שלא היה.
  const weeklyHistory: { weekStart: string; count: number }[] = [];
  for (let i = 8; i >= 1; i--) {
    const w = new Date(curWeekStart);
    w.setDate(w.getDate() - i * 7);
    weeklyHistory.push({ weekStart: localDate(w), count: weekCounts.get(w.getTime()) ?? 0 });
  }

  return {
    kpi: {
      deliveries: { todayPlanned, todayDone, late, slaPct, avgDays, weekly, weeklyHistory },
      service: { open: openCalls, doneThisMonth, avgCloseHours },
      pickups: { waiting: pWaiting, collected: pCollected, cancelled: pCancelled, donePct },
      docs: {
        notesOpen: openNotes.length,
        notesClosedThisMonth,
        notesOldestOpenDays,
        invoicesNotSent,
        invoicesSent,
        invoicesTotal: invoices.length,
      },
    },
    serviceByDay,
    docsByMonth,
    ordersByMonth,
    pickupFunnel,
    callsByTechnician,
    activityByRegion,
    exceptions: { lateDeliveries: late, pickupsOver14d, unlocatedStops, callsOver7d, repeatCalls },
  };
}
