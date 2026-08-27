import { supabase } from './supabase';
import type { AgingBucket } from './aging';

/**
 * גיול חובות ותיעוד גבייה: הגישה לנתונים.
 *
 * 🔴 **הכל עובר דרך שתי פונקציות במסד ולא דרך שליפה מהטבלה.** יש 1,238
 * חשבוניות פתוחות, ו-PostgREST חותך על 1,000 שורות בלי להתלונן. מסך
 * שנבנה על שליפה ישירה היה מציג חוב חלקי ונראה תקין לגמרי.
 *
 * ⭐ וההרשאה נאכפת ב-RLS של `consolidated_invoices` (הנהלה בלבד), ולכן
 * מי שאינו מורשה מקבל רשימה ריקה. הפונקציות הן `security invoker` בדיוק
 * כדי שזה יקרה מעצמו.
 */

export interface AgingRow {
  customerNumber: string;
  customerName: string;
  openCount: number;
  total: number;
  oldestDays: number;
  buckets: Record<AgingBucket, number>;
  lastNoteAt: string | null;
  nextActionDate: string | null;
}

interface AgingDbRow {
  customer_number: string;
  customer_name: string | null;
  open_count: number;
  total: string | number;
  oldest_days: number;
  b0_30: string | number;
  b31_60: string | number;
  b61_90: string | number;
  b91_120: string | number;
  b120_plus: string | number;
  last_note_at: string | null;
  next_action_date: string | null;
}

const num = (v: string | number | null) => Number(v ?? 0) || 0;

export async function fetchAging(): Promise<AgingRow[]> {
  const { data, error } = await supabase.rpc('debt_aging');
  if (error) throw error;
  return ((data ?? []) as AgingDbRow[]).map((r) => ({
    customerNumber: r.customer_number,
    customerName: r.customer_name || r.customer_number,
    openCount: Number(r.open_count) || 0,
    total: num(r.total),
    oldestDays: Number(r.oldest_days) || 0,
    buckets: {
      b0_30: num(r.b0_30),
      b31_60: num(r.b31_60),
      b61_90: num(r.b61_90),
      b91_120: num(r.b91_120),
      b120_plus: num(r.b120_plus),
    },
    lastNoteAt: r.last_note_at,
    nextActionDate: r.next_action_date,
  }));
}

export interface OpenInvoiceRow {
  docNo: string | null;
  invoiceDate: string;
  totalPrice: number;
  status: string | null;
  sourceOrder: string | null;
  ageDays: number;
}

export async function fetchCustomerOpenInvoices(customerNumber: string): Promise<OpenInvoiceRow[]> {
  const { data, error } = await supabase.rpc('customer_open_invoices', {
    p_customer: customerNumber,
  });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    docNo: (r.doc_no as string) ?? null,
    invoiceDate: r.invoice_date as string,
    totalPrice: num(r.total_price as string),
    status: (r.status as string) ?? null,
    sourceOrder: (r.source_order as string) ?? null,
    ageDays: Number(r.age_days) || 0,
  }));
}

export const OUTCOMES = [
  { value: 'promised', label: 'הבטיח לשלם' },
  { value: 'partial', label: 'שילם חלקית' },
  { value: 'paid', label: 'שילם' },
  { value: 'no_answer', label: 'לא ענה' },
  { value: 'dispute', label: 'מחלוקת' },
  { value: 'other', label: 'אחר' },
] as const;

export type CollectionOutcome = (typeof OUTCOMES)[number]['value'];

export const OUTCOME_LABELS: Record<CollectionOutcome, string> = OUTCOMES.reduce(
  (acc, o) => ({ ...acc, [o.value]: o.label }),
  {} as Record<CollectionOutcome, string>
);

export interface CollectionNote {
  id: string;
  customerNumber: string;
  customerName: string | null;
  note: string;
  outcome: CollectionOutcome;
  promisedAmount: number | null;
  nextActionDate: string | null;
  createdByName: string | null;
  createdAt: string;
}

export async function fetchNotes(customerNumber: string): Promise<CollectionNote[]> {
  const { data, error } = await supabase
    .from('collection_notes')
    .select('*')
    .eq('customer_number', customerNumber)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    id: r.id as string,
    customerNumber: r.customer_number as string,
    customerName: (r.customer_name as string) ?? null,
    note: r.note as string,
    outcome: r.outcome as CollectionOutcome,
    promisedAmount: r.promised_amount == null ? null : Number(r.promised_amount),
    nextActionDate: (r.next_action_date as string) ?? null,
    createdByName: (r.created_by_name as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

export async function addNote(input: {
  customerNumber: string;
  customerName: string | null;
  note: string;
  outcome: CollectionOutcome;
  promisedAmount?: number | null;
  nextActionDate?: string | null;
  createdByName?: string | null;
}): Promise<void> {
  const { data: session } = await supabase.auth.getUser();
  const { error } = await supabase.from('collection_notes').insert({
    customer_number: input.customerNumber,
    customer_name: input.customerName,
    note: input.note.trim(),
    outcome: input.outcome,
    promised_amount: input.promisedAmount ?? null,
    next_action_date: input.nextActionDate || null,
    created_by: session?.user?.id ?? null,
    created_by_name: input.createdByName ?? null,
  });
  if (error) throw error;
}
