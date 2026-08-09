import type { NewCustomer } from '@/types/customer';
import { supabase } from './supabase';
import { dataWindowCutoff } from './constants';

const PAGE = 1000;
/** גודל אצווה ל-`in(...)` — אותו גודל שה-sync משתמש בו מול priority_customers. */
const LOOKUP_BATCH = 200;

type CustomerRow = {
  custname: string;
  cdes: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  fax: string | null;
  agent: string | null;
  health_fund: string | null;
  opened_by: string | null;
  priority_udate: string | null;
};

/**
 * אוסף את כל ערכי `column` הקיימים ב-`table` עבור קבוצת מספרי לקוח.
 * מחזיר Set של המספרים שנמצאו.
 *
 * חשוב: PostgREST חותך ב-1000 שורות בשקט, ולכן גם כאן יש דפדוף. שאילתה
 * שמחזירה בדיוק 1000 תיראה תקינה לגמרי ותשקר.
 */
async function existingFor(
  table: 'orders' | 'service_calls' | 'pickups',
  customerNumbers: string[]
): Promise<Set<string>> {
  const found = new Set<string>();

  for (let i = 0; i < customerNumbers.length; i += LOOKUP_BATCH) {
    const batch = customerNumbers.slice(i, i + LOOKUP_BATCH);

    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select('customer_number')
        .in('customer_number', batch)
        .range(from, from + PAGE - 1);

      if (error) throw new Error(`existingFor(${table}): ${error.message}`);
      for (const r of data ?? []) {
        const v = (r as { customer_number: string | null }).customer_number;
        if (v) found.add(v);
      }
      if (!data || data.length < PAGE) break;
    }
  }

  return found;
}

/** לקוחות שכבר יש להם עצירת 'customer' פעילה ביומן. */
async function scheduledCustomers(customerNumbers: string[]): Promise<Set<string>> {
  const found = new Set<string>();

  for (let i = 0; i < customerNumbers.length; i += LOOKUP_BATCH) {
    const batch = customerNumbers.slice(i, i + LOOKUP_BATCH);
    const { data, error } = await supabase
      .from('calendar_stops')
      .select('customer_number')
      .eq('source_type', 'customer')
      .in('status', ['planned', 'in_progress'])
      .in('customer_number', batch);

    if (error) throw new Error(`scheduledCustomers: ${error.message}`);
    for (const r of data ?? []) {
      const v = (r as { customer_number: string | null }).customer_number;
      if (v) found.add(v);
    }
  }

  return found;
}

/**
 * לקוחות שנפתחו בפריוריטי בתוך חלון הנתונים, עם סימון מה כבר קיים לצדם.
 * ממוין מהחדש לישן — הלקוח שנפתח היום הוא זה שהאספקה שלו הכי קרובה.
 */
export async function fetchNewCustomers(): Promise<NewCustomer[]> {
  const cutoff = dataWindowCutoff();
  const rows: CustomerRow[] = [];

  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('priority_customers')
      .select('custname,cdes,address,city,phone,fax,agent,health_fund,opened_by,priority_udate')
      .gte('priority_udate', cutoff)
      .order('priority_udate', { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) throw new Error(`fetchNewCustomers: ${error.message}`);
    rows.push(...((data ?? []) as CustomerRow[]));
    if (!data || data.length < PAGE) break;
  }

  const numbers = rows.map((r) => r.custname).filter(Boolean);
  const [withOrder, withCall, withPickup, scheduled] = await Promise.all([
    existingFor('orders', numbers),
    existingFor('service_calls', numbers),
    existingFor('pickups', numbers),
    scheduledCustomers(numbers),
  ]);

  return rows.map((r) => ({
    customerNumber: r.custname,
    customerName: r.cdes ?? r.custname,
    address: r.address ?? undefined,
    city: r.city ?? undefined,
    phone: r.phone ?? undefined,
    fax: r.fax ?? undefined,
    agent: r.agent ?? undefined,
    healthFund: r.health_fund ?? undefined,
    openedBy: r.opened_by ?? undefined,
    openedAt: r.priority_udate ?? undefined,
    hasOrder: withOrder.has(r.custname),
    hasServiceCall: withCall.has(r.custname),
    hasPickup: withPickup.has(r.custname),
    isScheduled: scheduled.has(r.custname),
  }));
}
