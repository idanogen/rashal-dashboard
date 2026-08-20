import type { DeliveryNote, Invoice, ConsolidatedInvoice, DocStatus } from '@/types/document';
import { supabase } from './supabase';

type DeliveryNoteRow = {
  id: string;
  priority_doc_id: string;
  customer_number: string | null;
  customer_name: string | null;
  doc_date: string | null;
  status: DocStatus | null;
  invoiced: string | null;
  source_order: string | null;
  warehouse: string | null;
  agent: string | null;
  opened_by: string | null;
  total_qty: number | null;
  total_price: number | null;
  priority_udate: string | null;
};

type InvoiceRow = {
  id: string;
  priority_iv_id: string;
  customer_number: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  status: DocStatus | null;
  source_order: string | null;
  agent: string | null;
  book_num: string | null;
  fnc_num: string | null;
  recon_date: string | null;
  vat: number | null;
  total_price: number | null;
};

/**
 * PostgREST חותך ב-1,000 שורות בשקט. מדפדפים תמיד.
 * (זה בדיוק מה ש-`fetchAllStops` לא עשה, וזו הייתה פצצת זמן.)
 */
async function fetchPaged<Row>(table: string, orderCol: string): Promise<Row[]> {
  const PAGE = 1000;
  const all: Row[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .is('archived_at', null)
      .order(orderCol, { ascending: false, nullsFirst: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase ${table}: ${error.message}`);
    const rows = (data as Row[]) ?? [];
    all.push(...rows);
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function fetchAllDeliveryNotes(): Promise<DeliveryNote[]> {
  const rows = await fetchPaged<DeliveryNoteRow>('delivery_notes', 'doc_date');
  return rows.map((r) => ({
    id: r.id,
    priorityDocId: r.priority_doc_id,
    customerNumber: r.customer_number ?? undefined,
    customerName: r.customer_name ?? undefined,
    docDate: r.doc_date ?? undefined,
    status: r.status ?? undefined,
    invoiced: r.invoiced ?? undefined,
    sourceOrder: r.source_order ?? undefined,
    warehouse: r.warehouse ?? undefined,
    agent: r.agent ?? undefined,
    openedBy: r.opened_by ?? undefined,
    totalQty: r.total_qty ?? undefined,
    totalPrice: r.total_price ?? undefined,
    priorityUdate: r.priority_udate ?? undefined,
  }));
}

export async function fetchAllInvoices(): Promise<Invoice[]> {
  const rows = await fetchPaged<InvoiceRow>('invoices', 'invoice_date');
  return rows.map((r) => ({
    id: r.id,
    priorityIvId: r.priority_iv_id,
    customerNumber: r.customer_number ?? undefined,
    customerName: r.customer_name ?? undefined,
    invoiceDate: r.invoice_date ?? undefined,
    status: r.status ?? undefined,
    sourceOrder: r.source_order ?? undefined,
    agent: r.agent ?? undefined,
    bookNum: r.book_num ?? undefined,
    fncNum: r.fnc_num ?? undefined,
    reconDate: r.recon_date ?? undefined,
    vat: r.vat ?? undefined,
    totalPrice: r.total_price ?? undefined,
  }));
}

type CInvoiceRow = {
  id: string;
  priority_iv_id: string;
  doc_no: string | null;
  customer_number: string | null;
  customer_name: string | null;
  invoice_date: string | null;
  status: string | null;
  total_price: number | null;
};

export async function fetchAllConsolidatedInvoices(): Promise<ConsolidatedInvoice[]> {
  const rows = await fetchPaged<CInvoiceRow>('consolidated_invoices', 'invoice_date');
  return rows.map((r) => ({
    id: r.id,
    priorityIvId: r.priority_iv_id,
    docNo: r.doc_no ?? undefined,
    customerNumber: r.customer_number ?? undefined,
    customerName: r.customer_name ?? undefined,
    invoiceDate: r.invoice_date ?? undefined,
    status: r.status ?? undefined,
    totalPrice: r.total_price ?? undefined,
  }));
}
