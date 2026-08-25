import { supabase } from '@/lib/supabase';
// 🔴 **טיפוסי הציוד חיים במודול שנבדק ביחידה, ולא כאן.** שתי הגדרות
// לאותה צורה נפרדות זו מזו בשקט, וזה בדיוק מה שקרה כאן פעם.
import type { MatchKind, OpenItem, MatchCounts, CustomerStock } from '@/lib/customer-answer';
export type { StockItem, CustomerStock } from '@/lib/customer-answer';

/**
 * הכרטיס מגיע מהמסד בקריאה אחת.
 *
 * ⭐ **דרך RPC ולא דרך נקודת קצה בוורסל, וזו לא בחירת נוחות.** הפרויקט
 * על תוכנית Hobby שתקרתה **12 פונקציות לפריסה**, והקובץ ה-13 בנה
 * בהצלחה ואז הפיל את הפריסה בשלב `Deploying outputs`.
 * [[vercel_hobby_twelve_function_cap]]
 *
 * 🔴 **וההרשאה נאכפת בפונקציה עצמה** (`is_office_staff`), לא במסך.
 * מסך שרק מסתיר כפתורים משאיר את הנתונים פתוחים בדיוק כמו קודם.
 */

export interface CustomerHit {
  customer_number: string | null;
  customer_name: string | null;
  phone: string | null;
  phone_local: string | null;
  city: string | null;
  match_kind: MatchKind;
  score: number;
}

export interface TimelineEvent {
  at: string;
  kind: 'order' | 'call' | 'pickup' | 'stop' | 'note' | 'survey' | 'wa';
  title: string;
  ref: string | null;
  detail: string | null;
  match: MatchKind | null;
}

export interface CustomerCardData {
  ok: boolean;
  error?: string;
  customer: {
    customerNumber: string | null;
    name: string | null;
    phone: string | null;
    city: string | null;
    address: string | null;
    healthFund: string | null;
    agent: string | null;
  };
  open: {
    orders: OpenItem[];
    calls: OpenItem[];
    pickups: OpenItem[];
    notes: { ref: string | null; date: string | null; status: string | null; total: number | null }[];
  };
  timeline: TimelineEvent[];
  wa: null | {
    phone: string | null;
    lastInboundAt: string | null;
    unansweredSince: string | null;
    readAt: string | null;
    messageCount: number | null;
    messages: { direction: 'in' | 'out'; body: string | null; at: string; status: string | null }[];
  };
  stock: CustomerStock;
  surveys: { at: string; q1: number | null; q2: number | null; comment: string | null; driver: string | null }[];
  documents: {
    notes: { ref: string | null; date: string | null; status: string | null; invoiced: boolean | null; total: number | null }[];
    invoices: { ref: string | null; date: string | null; total: number | null; status: string | null; type: string | null }[];
  };
  match: MatchCounts;
  counts: { orders: number; calls: number; pickups: number; notes: number; stops: number };
}

export async function searchCustomers(query: string): Promise<CustomerHit[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await supabase.rpc('customer_search', { p_query: q });
  if (error) throw new Error(error.message);
  return (data ?? []) as CustomerHit[];
}

export async function fetchCustomerCard(
  customerNumber: string | null,
  phone: string | null,
): Promise<CustomerCardData> {
  const { data, error } = await supabase.rpc('customer_card', {
    p_customer: customerNumber,
    p_phone: phone,
  });
  if (error) throw new Error(error.message);
  return data as CustomerCardData;
}

/** מפתחות react-query, במקום אחד כדי ששני הצרכנים לא יפצלו את המטמון. */
export const customerCardKey = (num: string | null, phone: string | null) =>
  ['customer-card', num ?? '', phone ?? ''] as const;
export const customerSearchKey = (q: string) => ['customer-search', q] as const;
