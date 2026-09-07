import { supabase } from './supabase';
import type { HistoryHit, LastTouch } from './history-line';

/**
 * היסטוריה אחת (07/09/2026): שתי שאילתות קטנות למסד, שתיהן דרך RPC כדי
 * שההרשאה תיאכף בפונקציה (`is_office_staff`) ולא במסך.
 */

type HitRow = {
  customer_number: string | null; customer_name: string | null; phone: string | null; city: string | null;
  match_kind: string; score: number;
  last_visit_date: string | null; last_visit_driver: string | null; last_visit_outcome: string | null;
  last_order_date: string | null; last_order_status: string | null; last_order_ref: string | null;
  last_call_date: string | null; last_call_status: string | null; last_call_ref: string | null;
  last_call_by: string | null; last_call_type: string | null;
  last_note_date: string | null;
  open_orders: number; open_calls: number; deliveries: number;
};

/** כל הלקוחות המוכרים שמתאימים לחיפוש, מכל השנים, עם האירוע האחרון. */
export async function historySearch(query: string, limit = 8): Promise<HistoryHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase.rpc('history_search', { p_query: q, p_limit: limit });
  if (error) throw new Error(error.message);
  return ((data ?? []) as HitRow[]).map((r) => ({
    customerNumber: r.customer_number,
    customerName: r.customer_name,
    phone: r.phone,
    city: r.city,
    lastVisitDate: r.last_visit_date,
    lastVisitDriver: r.last_visit_driver,
    lastVisitOutcome: r.last_visit_outcome,
    lastOrderDate: r.last_order_date,
    lastOrderStatus: r.last_order_status,
    lastOrderRef: r.last_order_ref,
    lastCallDate: r.last_call_date,
    lastCallStatus: r.last_call_status,
    lastCallRef: r.last_call_ref,
    lastCallBy: r.last_call_by,
    lastCallType: r.last_call_type,
    lastNoteDate: r.last_note_date,
    openOrders: r.open_orders ?? 0,
    openCalls: r.open_calls ?? 0,
    deliveries: r.deliveries ?? 0,
  }));
}

export interface TouchKey {
  /** המפתח שהמסך מזהה בו את הפריט (מזהה הרשומה) */
  k: string;
  n?: string | null;
  name: string;
  phone?: string | null;
}

type TouchRow = {
  k: string; visits: number; last_visit_date: string | null; last_visit_driver: string | null; last_visit_outcome: string | null;
  deliveries: number; last_delivery_date: string | null; calls_done: number; last_call_date: string | null; last_call_by: string | null;
};

/**
 * "ביקור אחרון" לכל כרטיס ברשימה, בקריאה אחת. מחזיר רק מי שיש לו משהו;
 * מי שחסר במפה הוא לקוח חדש.
 */
export async function fetchLastTouch(keys: TouchKey[]): Promise<Map<string, LastTouch>> {
  const out = new Map<string, LastTouch>();
  if (!keys.length) return out;
  const { data, error } = await supabase.rpc('customer_last_touch', {
    p_keys: keys.slice(0, 2000).map((k) => ({ k: k.k, n: k.n ?? null, name: k.name, phone: k.phone ?? null })),
  });
  if (error) throw new Error(error.message);
  for (const r of (data ?? []) as TouchRow[]) {
    out.set(r.k, {
      visits: r.visits ?? 0,
      lastVisitDate: r.last_visit_date,
      lastVisitDriver: r.last_visit_driver,
      lastVisitOutcome: r.last_visit_outcome,
      deliveries: r.deliveries ?? 0,
      lastDeliveryDate: r.last_delivery_date,
      callsDone: r.calls_done ?? 0,
      lastCallDate: r.last_call_date,
      lastCallBy: r.last_call_by,
    });
  }
  return out;
}
