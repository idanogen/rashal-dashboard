import type { Pickup, PickupLine, PickupStatus } from '@/types/pickup';
import { supabase } from './supabase';

type PickupRow = {
  id: string;
  priority_pickup_id: string | null;
  priority_doc: number | null;
  customer_number: string | null;
  customer_name: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  priority_status: string | null;
  pickup_status: PickupStatus | null;
  pickup_date: string | null;
  source_order: string | null;
  delivery_note: string | null;
  reference: string | null;
  to_warehouse: string | null;
  agent: string | null;
  opened_by: string | null;
  total_qty: number | null;
  total_price: number | null;
  lines: PickupLine[] | null;
  duplicate_of: string | null;
  created_at: string;
};

function rowToPickup(row: PickupRow): Pickup {
  return {
    id: row.id,
    priorityPickupId: row.priority_pickup_id ?? undefined,
    priorityDoc: row.priority_doc ?? undefined,
    customerNumber: row.customer_number ?? undefined,
    customerName: row.customer_name,
    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    priorityStatus: row.priority_status ?? undefined,
    pickupStatus: row.pickup_status ?? undefined,
    pickupDate: row.pickup_date ?? undefined,
    sourceOrder: row.source_order ?? undefined,
    deliveryNote: row.delivery_note ?? undefined,
    reference: row.reference ?? undefined,
    toWarehouse: row.to_warehouse ?? undefined,
    agent: row.agent ?? undefined,
    openedBy: row.opened_by ?? undefined,
    totalQty: row.total_qty ?? undefined,
    totalPrice: row.total_price ?? undefined,
    lines: Array.isArray(row.lines) ? row.lines : undefined,
    duplicateOf: row.duplicate_of ?? undefined,
    created: row.created_at,
  };
}

function fieldsToRow(fields: Partial<Omit<Pickup, 'id'>>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('customerName' in fields) row.customer_name = fields.customerName;
  if ('customerNumber' in fields) row.customer_number = fields.customerNumber;
  if ('phone' in fields) row.phone = fields.phone;
  if ('address' in fields) row.address = fields.address;
  if ('city' in fields) row.city = fields.city;
  if ('pickupStatus' in fields) row.pickup_status = fields.pickupStatus;
  return row;
}

export async function fetchAllPickups(): Promise<Pickup[]> {
  // PostgREST defaults max-rows to 1000. Paginate so we always get every row.
  const PAGE = 1000;
  const all: Pickup[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('pickups')
      .select('*')
      .order('pickup_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`Supabase fetchAllPickups: ${error.message}`);
    const rows = (data as PickupRow[]) ?? [];
    all.push(...rows.map(rowToPickup));
    if (rows.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function updatePickup(
  id: string,
  fields: Partial<Omit<Pickup, 'id'>>
): Promise<Pickup> {
  const { data, error } = await supabase
    .from('pickups')
    .update(fieldsToRow(fields))
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`Supabase updatePickup: ${error.message}`);
  return rowToPickup(data as PickupRow);
}
