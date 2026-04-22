import type {
  CalendarStop,
  ScheduleStopInput,
  StopStatus,
} from '@/types/calendar-stop';
import { supabase } from './supabase';

type CalendarStopRow = {
  id: string;
  delivery_date: string;
  driver: CalendarStop['driver'];
  sequence: number;
  route_id: string | null;
  source_type: CalendarStop['sourceType'];
  order_id: string | null;
  service_call_id: string | null;
  customer_name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  status: StopStatus;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function rowToStop(row: CalendarStopRow): CalendarStop {
  return {
    id: row.id,
    deliveryDate: row.delivery_date,
    driver: row.driver,
    sequence: row.sequence,
    routeId: row.route_id ?? undefined,
    sourceType: row.source_type,
    orderId: row.order_id ?? undefined,
    serviceCallId: row.service_call_id ?? undefined,
    customerName: row.customer_name,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    phone: row.phone ?? undefined,
    status: row.status,
    completedAt: row.completed_at ?? undefined,
    notes: row.notes ?? undefined,
    created: row.created_at,
    updated: row.updated_at,
  };
}

function stopFieldsToRow(
  fields: Partial<CalendarStop>
): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ('deliveryDate' in fields) row.delivery_date = fields.deliveryDate;
  if ('driver' in fields) row.driver = fields.driver;
  if ('sequence' in fields) row.sequence = fields.sequence;
  if ('routeId' in fields) row.route_id = fields.routeId ?? null;
  if ('sourceType' in fields) row.source_type = fields.sourceType;
  if ('orderId' in fields) row.order_id = fields.orderId ?? null;
  if ('serviceCallId' in fields) row.service_call_id = fields.serviceCallId ?? null;
  if ('customerName' in fields) row.customer_name = fields.customerName;
  if ('address' in fields) row.address = fields.address ?? null;
  if ('city' in fields) row.city = fields.city ?? null;
  if ('phone' in fields) row.phone = fields.phone ?? null;
  if ('status' in fields) row.status = fields.status;
  if ('completedAt' in fields) row.completed_at = fields.completedAt ?? null;
  if ('notes' in fields) row.notes = fields.notes ?? null;
  return row;
}

// ─── Reads ──────────────────────────────────────────────────────

export async function fetchAllStops(): Promise<CalendarStop[]> {
  const { data, error } = await supabase
    .from('calendar_stops')
    .select('*')
    .order('delivery_date', { ascending: true })
    .order('driver', { ascending: true })
    .order('sequence', { ascending: true });

  if (error) throw new Error(`fetchAllStops: ${error.message}`);
  return (data as CalendarStopRow[]).map(rowToStop);
}

export async function fetchStopsForDateRange(
  fromDate: string,
  toDate: string
): Promise<CalendarStop[]> {
  const { data, error } = await supabase
    .from('calendar_stops')
    .select('*')
    .gte('delivery_date', fromDate)
    .lte('delivery_date', toDate)
    .order('delivery_date', { ascending: true })
    .order('driver', { ascending: true })
    .order('sequence', { ascending: true });

  if (error) throw new Error(`fetchStopsForDateRange: ${error.message}`);
  return (data as CalendarStopRow[]).map(rowToStop);
}

export async function fetchStopsByOrderId(
  orderId: string
): Promise<CalendarStop[]> {
  const { data, error } = await supabase
    .from('calendar_stops')
    .select('*')
    .eq('order_id', orderId);

  if (error) throw new Error(`fetchStopsByOrderId: ${error.message}`);
  return (data as CalendarStopRow[]).map(rowToStop);
}

export async function fetchStopsByServiceCallId(
  serviceCallId: string
): Promise<CalendarStop[]> {
  const { data, error } = await supabase
    .from('calendar_stops')
    .select('*')
    .eq('service_call_id', serviceCallId);

  if (error) throw new Error(`fetchStopsByServiceCallId: ${error.message}`);
  return (data as CalendarStopRow[]).map(rowToStop);
}

// ─── Writes ─────────────────────────────────────────────────────

export async function createStop(input: ScheduleStopInput): Promise<CalendarStop> {
  // אם לא ציינו sequence, שים בסוף היום-נהג הקיים
  let sequence = input.sequence;
  if (sequence == null) {
    const { data: existing, error: countError } = await supabase
      .from('calendar_stops')
      .select('sequence')
      .eq('delivery_date', input.deliveryDate)
      .eq('driver', input.driver)
      .order('sequence', { ascending: false })
      .limit(1);
    if (countError) throw new Error(`createStop (sequence lookup): ${countError.message}`);
    const maxSeq = existing?.[0]?.sequence ?? -1;
    sequence = (maxSeq as number) + 1;
  }

  const row: Record<string, unknown> = {
    delivery_date: input.deliveryDate,
    driver: input.driver,
    sequence,
    source_type: input.sourceType,
    order_id: input.orderId ?? null,
    service_call_id: input.serviceCallId ?? null,
    customer_name: input.customerName,
    address: input.address ?? null,
    city: input.city ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
  };

  const { data, error } = await supabase
    .from('calendar_stops')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`createStop: ${error.message}`);
  return rowToStop(data as CalendarStopRow);
}

export async function updateStop(
  id: string,
  fields: Partial<CalendarStop>
): Promise<CalendarStop> {
  const { data, error } = await supabase
    .from('calendar_stops')
    .update(stopFieldsToRow(fields))
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`updateStop: ${error.message}`);
  return rowToStop(data as CalendarStopRow);
}

export async function deleteStop(id: string): Promise<void> {
  const { error } = await supabase.from('calendar_stops').delete().eq('id', id);
  if (error) throw new Error(`deleteStop: ${error.message}`);
}

/**
 * מסדר מחדש את העצירות באותו יום×נהג לפי סדר ה-ids שמועבר.
 * שולח UPDATE אחד לכל עצירה (רצוי להעביר batch — כאן לולאה).
 */
export async function reorderStops(
  deliveryDate: string,
  driver: CalendarStop['driver'],
  orderedIds: string[]
): Promise<void> {
  for (let i = 0; i < orderedIds.length; i++) {
    const { error } = await supabase
      .from('calendar_stops')
      .update({ sequence: i })
      .eq('id', orderedIds[i])
      .eq('delivery_date', deliveryDate)
      .eq('driver', driver);
    if (error) throw new Error(`reorderStops: ${error.message}`);
  }
}

/** מעביר stop לסטטוס סופי (completed / not_completed) עם timestamp. */
export async function resolveStop(
  id: string,
  status: 'completed' | 'not_completed',
  notes?: string
): Promise<CalendarStop> {
  const row: Record<string, unknown> = {
    status,
    completed_at: new Date().toISOString(),
  };
  if (notes != null) row.notes = notes;

  const { data, error } = await supabase
    .from('calendar_stops')
    .update(row)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(`resolveStop: ${error.message}`);
  return rowToStop(data as CalendarStopRow);
}
