import type { Order } from '@/types/order';
import { supabase } from './supabase';

type OrderRow = {
  id: string;
  customer_name: string;
  customer_number: string | null;
  phone: string | null;
  customer_status: Order['customerStatus'] | null;
  status: Order['status'] | null;
  order_status: Order['orderStatus'] | null;
  health_fund: string | null;
  opened_by: string | null;
  fax: string | null;
  address: string | null;
  city: string | null;
  agent: string | null;
  items: Order['items'] | null;
  duplicate_of: string | null;
  scheduled_reminder_at: string | null;
  customer_reply_status: Order['customerReplyStatus'] | null;
  customer_requested_time: string | null;
  last_reminder_at: string | null;
  delivery_date: string | null;
  created_at: string;
};

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customerName: row.customer_name,
    customerNumber: row.customer_number ?? undefined,
    phone: row.phone ?? undefined,
    customerStatus: row.customer_status ?? undefined,
    status: row.status ?? undefined,
    orderStatus: row.order_status ?? undefined,
    healthFund: row.health_fund ?? undefined,
    openedBy: row.opened_by ?? undefined,
    fax: row.fax ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    agent: row.agent ?? undefined,
    items: row.items ?? undefined,
    duplicateOf: row.duplicate_of ?? undefined,
    scheduledReminderAt: row.scheduled_reminder_at ?? undefined,
    customerReplyStatus: row.customer_reply_status ?? undefined,
    customerRequestedTime: row.customer_requested_time ?? undefined,
    lastReminderAt: row.last_reminder_at ?? undefined,
    deliveryDate: row.delivery_date ?? undefined,
    created: row.created_at,
  };
}

function orderFieldsToRow(fields: Partial<Omit<Order, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('customerName' in fields) row.customer_name = fields.customerName;
  if ('customerNumber' in fields) row.customer_number = fields.customerNumber;
  if ('phone' in fields) row.phone = fields.phone;
  if ('customerStatus' in fields) row.customer_status = fields.customerStatus;
  if ('status' in fields) row.status = fields.status;
  if ('orderStatus' in fields) row.order_status = fields.orderStatus;
  if ('healthFund' in fields) row.health_fund = fields.healthFund;
  if ('openedBy' in fields) row.opened_by = fields.openedBy;
  if ('fax' in fields) row.fax = fields.fax;
  if ('address' in fields) row.address = fields.address;
  if ('city' in fields) row.city = fields.city;
  if ('agent' in fields) row.agent = fields.agent;
  if ('scheduledReminderAt' in fields) row.scheduled_reminder_at = fields.scheduledReminderAt;
  if ('customerReplyStatus' in fields) row.customer_reply_status = fields.customerReplyStatus;
  if ('customerRequestedTime' in fields) row.customer_requested_time = fields.customerRequestedTime;
  if ('lastReminderAt' in fields) row.last_reminder_at = fields.lastReminderAt;
  if ('deliveryDate' in fields) row.delivery_date = fields.deliveryDate;
  return row;
}

export async function fetchAllOrders(): Promise<Order[]> {
  // PostgREST defaults max-rows to 1000. Paginate explicitly so we always get every row.
  const PAGE = 1000;
  const all: Order[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase fetchAllOrders: ${error.message}`);
    const rows = (data as OrderRow[]) ?? [];
    all.push(...rows.map(rowToOrder));
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function updateOrder(
  id: string,
  fields: Partial<Omit<Order, 'id'>>
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .update(orderFieldsToRow(fields))
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Supabase updateOrder: ${error.message}`);
  return rowToOrder(data as OrderRow);
}

export async function updateMultipleOrders(
  records: Array<{ id: string; fields: Partial<Omit<Order, 'id'>> }>
): Promise<Order[]> {
  const results: Order[] = [];
  for (const r of records) {
    results.push(await updateOrder(r.id, r.fields));
  }
  return results;
}

export async function createOrder(
  fields: Partial<Omit<Order, 'id' | 'created'>> & { customerName: string }
): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .insert(orderFieldsToRow(fields))
    .select()
    .single();

  if (error) throw new Error(`Supabase createOrder: ${error.message}`);
  return rowToOrder(data as OrderRow);
}
