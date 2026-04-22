import type { Order } from '@/types/order';
import { supabase } from './supabase';

type OrderRow = {
  id: string;
  customer_name: string;
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
  created_at: string;
};

function rowToOrder(row: OrderRow): Order {
  return {
    id: row.id,
    customerName: row.customer_name,
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
    created: row.created_at,
  };
}

function orderFieldsToRow(fields: Partial<Omit<Order, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('customerName' in fields) row.customer_name = fields.customerName;
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
  return row;
}

export async function fetchAllOrders(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Supabase fetchAllOrders: ${error.message}`);
  return (data as OrderRow[]).map(rowToOrder);
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
