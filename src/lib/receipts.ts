import { supabase } from './supabase';
import type { ReceiptMonthRow } from './receipts-summary';

/**
 * קבלות וטיוטות: הגישה לנתונים. כמו `collections.ts`, הכל דרך פונקציות
 * במסד (`security invoker`), ולכן מי שאינו הנהלה מקבל רשימה ריקה.
 */
const num = (v: unknown) => Number(v ?? 0) || 0;

export async function fetchReceiptsByMonth(from: Date): Promise<ReceiptMonthRow[]> {
  const pFrom = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`;
  const { data, error } = await supabase.rpc('receipts_by_month', { p_from: pFrom });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    month: String(r.month),
    customerNumber: String(r.customer_number ?? ''),
    customerName: String(r.customer_name ?? r.customer_number ?? ''),
    n: num(r.n),
    total: num(r.total),
  }));
}

export interface CustomerReceiptRow {
  docNo: string | null;
  receiptDate: string;
  totalPrice: number;
  docType: string | null;
  docDesc: string | null;
}

export async function fetchCustomerReceipts(customerNumber: string): Promise<CustomerReceiptRow[]> {
  const { data, error } = await supabase.rpc('customer_receipts', { p_customer: customerNumber });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    docNo: (r.doc_no as string) ?? null,
    receiptDate: String(r.receipt_date ?? ''),
    totalPrice: num(r.total_price),
    docType: (r.doc_type as string) ?? null,
    docDesc: (r.doc_desc as string) ?? null,
  }));
}

export interface DraftRow {
  customerNumber: string;
  customerName: string;
  draftCount: number;
  total: number;
  oldestDate: string | null;
}

/** חשבוניות מרכזות בטיוטא: ממתינות להפקה, לא חוב. */
export async function fetchDebtDrafts(): Promise<DraftRow[]> {
  const { data, error } = await supabase.rpc('debt_drafts');
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    customerNumber: String(r.customer_number ?? ''),
    customerName: String(r.customer_name ?? r.customer_number ?? ''),
    draftCount: num(r.draft_count),
    total: num(r.total),
    oldestDate: (r.oldest_date as string) ?? null,
  }));
}
