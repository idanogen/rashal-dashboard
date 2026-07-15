import type {
  CalendarStop,
  CoordinationMethod,
  CoordinationStatus,
  ScheduleStopInput,
  StopStatus,
} from '@/types/calendar-stop';
import { supabase } from './supabase';
import { geocodeAddress, getCityCoordinates } from './geocoding';

type CalendarStopRow = {
  id: string;
  delivery_date: string;
  driver: CalendarStop['driver'];
  sequence: number;
  route_id: string | null;
  source_type: CalendarStop['sourceType'];
  order_id: string | null;
  service_call_id: string | null;
  pickup_id: string | null;
  customer_name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  status: StopStatus;
  completed_at: string | null;
  notes: string | null;
  coordination_status: CoordinationStatus | null;
  coordination_method: CoordinationMethod | null;
  coordinated_at: string | null;
  time_window_start: string | null;
  time_window_end: string | null;
  coordination_needs_cancel: boolean | null;
  scheduled_by: string | null;
  rescheduled_by: string | null;
  rescheduled_at: string | null;
  geocoded_lat: number | null;
  geocoded_lng: number | null;
  geocoded_at: string | null;
  geocoded_address: string | null;
  created_at: string;
  updated_at: string;
};

function rowToStop(row: CalendarStopRow): CalendarStop {
  // 3 levels of confidence: precise geocode → city center → none.
  const hasGeocode = row.geocoded_lat != null && row.geocoded_lng != null;
  const cityCenter = getCityCoordinates(row.city);
  const coordinates = hasGeocode
    ? { lat: Number(row.geocoded_lat), lng: Number(row.geocoded_lng) }
    : cityCenter;
  const coordinatesSource: CalendarStop['coordinatesSource'] = hasGeocode
    ? 'geocoded'
    : cityCenter
      ? 'city'
      : undefined;

  return {
    id: row.id,
    deliveryDate: row.delivery_date,
    driver: row.driver,
    sequence: row.sequence,
    routeId: row.route_id ?? undefined,
    sourceType: row.source_type,
    orderId: row.order_id ?? undefined,
    serviceCallId: row.service_call_id ?? undefined,
    pickupId: row.pickup_id ?? undefined,
    customerName: row.customer_name,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    phone: row.phone ?? undefined,
    coordinates,
    coordinatesSource,
    geocodedAt: row.geocoded_at ?? undefined,
    geocodedAddress: row.geocoded_address ?? undefined,
    status: row.status,
    completedAt: row.completed_at ?? undefined,
    notes: row.notes ?? undefined,
    coordinationStatus: row.coordination_status ?? undefined,
    coordinationMethod: row.coordination_method ?? undefined,
    coordinatedAt: row.coordinated_at ?? undefined,
    timeWindowStart: row.time_window_start ?? undefined,
    timeWindowEnd: row.time_window_end ?? undefined,
    coordinationNeedsCancel: row.coordination_needs_cancel ?? undefined,
    scheduledBy: row.scheduled_by ?? undefined,
    rescheduledBy: row.rescheduled_by ?? undefined,
    rescheduledAt: row.rescheduled_at ?? undefined,
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
  if ('pickupId' in fields) row.pickup_id = fields.pickupId ?? null;
  if ('customerName' in fields) row.customer_name = fields.customerName;
  if ('address' in fields) row.address = fields.address ?? null;
  if ('city' in fields) row.city = fields.city ?? null;
  if ('phone' in fields) row.phone = fields.phone ?? null;
  if ('status' in fields) row.status = fields.status;
  if ('completedAt' in fields) row.completed_at = fields.completedAt ?? null;
  if ('notes' in fields) row.notes = fields.notes ?? null;
  if ('coordinationStatus' in fields) row.coordination_status = fields.coordinationStatus ?? null;
  if ('coordinationMethod' in fields) row.coordination_method = fields.coordinationMethod ?? null;
  if ('coordinatedAt' in fields) row.coordinated_at = fields.coordinatedAt ?? null;
  if ('timeWindowStart' in fields) row.time_window_start = fields.timeWindowStart ?? null;
  if ('timeWindowEnd' in fields) row.time_window_end = fields.timeWindowEnd ?? null;
  if ('coordinationNeedsCancel' in fields) row.coordination_needs_cancel = fields.coordinationNeedsCancel ?? false;
  if ('scheduledBy' in fields) row.scheduled_by = fields.scheduledBy ?? null;
  if ('rescheduledBy' in fields) row.rescheduled_by = fields.rescheduledBy ?? null;
  if ('rescheduledAt' in fields) row.rescheduled_at = fields.rescheduledAt ?? null;
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

/**
 * Find ACTIVE (planned/in_progress) stops that match a customer's dedup key.
 * Used to warn before scheduling: same customer can't have two active stops.
 * The DB also enforces this via `calendar_stops_no_active_dup` unique index.
 */
export async function findActiveDuplicateStops(input: {
  customerName: string;
  phone?: string;
  address?: string;
  city?: string;
}): Promise<CalendarStop[]> {
  const target = {
    customerName: norm(input.customerName),
    phone: norm(input.phone),
    address: norm(input.address),
    city: norm(input.city),
  };

  const query = supabase
    .from('calendar_stops')
    .select('*')
    .in('status', ['planned', 'in_progress'])
    .ilike('customer_name', input.customerName.trim());
  // Pull a wide candidate set (by customer name) and filter the rest client-side
  // so we don't have to construct case-insensitive ilike clauses for every column.

  const { data, error } = await query;
  if (error) throw new Error(`findActiveDuplicateStops: ${error.message}`);
  const rows = (data as CalendarStopRow[]) ?? [];
  return rows
    .map(rowToStop)
    .filter(
      (s) =>
        norm(s.customerName) === target.customerName &&
        norm(s.phone) === target.phone &&
        norm(s.address) === target.address &&
        norm(s.city) === target.city
    );
}

function norm(s: string | undefined | null): string {
  if (!s) return '';
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
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
    pickup_id: input.pickupId ?? null,
    customer_name: input.customerName,
    address: input.address ?? null,
    city: input.city ?? null,
    phone: input.phone ?? null,
    notes: input.notes ?? null,
    scheduled_by: input.scheduledBy ?? null,
  };

  const { data, error } = await supabase
    .from('calendar_stops')
    .insert(row)
    .select()
    .single();

  if (error) throw new Error(`createStop: ${error.message}`);
  return rowToStop(data as CalendarStopRow);
}

/**
 * שיבוץ מחדש של עצירה קיימת ליום/נהג אחר (גרירה בין ימים).
 * - sequence = סוף קבוצת היעד (אותו lookup כמו createStop).
 * - חותמת rescheduled_by/at.
 * - אם יש תיאום לקוח → coordination_needs_cancel=true (צריך לבטל מול הלקוח).
 */
export async function rescheduleStop(
  stopId: string,
  opts: { newDate: string; newDriver: CalendarStop['driver']; rescheduledBy?: string }
): Promise<CalendarStop> {
  const { data: existing, error: seqErr } = await supabase
    .from('calendar_stops')
    .select('sequence')
    .eq('delivery_date', opts.newDate)
    .eq('driver', opts.newDriver)
    .order('sequence', { ascending: false })
    .limit(1);
  if (seqErr) throw new Error(`rescheduleStop (sequence): ${seqErr.message}`);
  const sequence = ((existing?.[0]?.sequence as number) ?? -1) + 1;

  const patch: Record<string, unknown> = {
    delivery_date: opts.newDate,
    driver: opts.newDriver,
    sequence,
    rescheduled_by: opts.rescheduledBy ?? null,
    rescheduled_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('calendar_stops')
    .update(patch)
    .eq('id', stopId)
    .select()
    .single();
  if (error) throw new Error(`rescheduleStop: ${error.message}`);
  const stop = rowToStop(data as CalendarStopRow);

  // עצירה מתואמת ששובצה מחדש → לסמן שצריך לבטל את התיאום מול הלקוח.
  if (stop.coordinationStatus && !stop.coordinationNeedsCancel) {
    const { data: data2, error: err2 } = await supabase
      .from('calendar_stops')
      .update({ coordination_needs_cancel: true })
      .eq('id', stopId)
      .select()
      .single();
    if (err2) throw new Error(`rescheduleStop (flag): ${err2.message}`);
    return rowToStop(data2 as CalendarStopRow);
  }
  return stop;
}

/**
 * העברת עצירה שלא בוצעה (not_completed) ליום אחר — "החייאה" לשיבוץ פעיל.
 * שונה מ-rescheduleStop: מאפס את הסטטוס ל-planned + מנקה completed_at,
 * כדי שהעצירה תחזור להיות פעילה על היום החדש.
 */
export async function moveStopToNewDay(
  stopId: string,
  opts: { newDate: string; newDriver: CalendarStop['driver']; movedBy?: string }
): Promise<CalendarStop> {
  const { data: existing, error: seqErr } = await supabase
    .from('calendar_stops')
    .select('sequence')
    .eq('delivery_date', opts.newDate)
    .eq('driver', opts.newDriver)
    .order('sequence', { ascending: false })
    .limit(1);
  if (seqErr) throw new Error(`moveStopToNewDay (sequence): ${seqErr.message}`);
  const sequence = ((existing?.[0]?.sequence as number) ?? -1) + 1;

  const { data, error } = await supabase
    .from('calendar_stops')
    .update({
      delivery_date: opts.newDate,
      driver: opts.newDriver,
      sequence,
      status: 'planned',
      completed_at: null,
      rescheduled_by: opts.movedBy ?? null,
      rescheduled_at: new Date().toISOString(),
    })
    .eq('id', stopId)
    .select()
    .single();
  if (error) throw new Error(`moveStopToNewDay: ${error.message}`);
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

// ─── Geocoding ──────────────────────────────────────────────────

/**
 * מבצע geocoding אמיתי לכתובת העצירה ושומר את הנקודה המדויקת ב-DB.
 * - אם אין כתובת → לא עושה כלום (הקריאה מ-DB תיפול ל-fallback לפי עיר).
 * - אם ה-geocoding נכשל → לא כותב (יישאר fallback לפי עיר, ננסה שוב ב-backfill).
 * נועד להרצה fire-and-forget; לא זורק (מחזיר false בכשל).
 */
export async function geocodeStopAddress(stop: {
  id: string;
  address?: string;
  city?: string;
}): Promise<boolean> {
  if (!stop.address || !stop.address.trim()) return false;
  try {
    const result = await geocodeAddress(stop.address, { city: stop.city });
    if (!result) return false;
    const { error } = await supabase
      .from('calendar_stops')
      .update({
        geocoded_lat: result.lat,
        geocoded_lng: result.lng,
        geocoded_at: new Date().toISOString(),
        geocoded_address: stop.address,
      })
      .eq('id', stop.id);
    if (error) {
      console.error('[geocodeStopAddress] update failed:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[geocodeStopAddress] error:', err);
    return false;
  }
}
