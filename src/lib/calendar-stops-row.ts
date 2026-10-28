import type { CalendarStop, CoordinationMethod, CoordinationStatus, StopStatus } from '@/types/calendar-stop';
import { getCityCoordinates } from './geocoding';

/**
 * שורת `calendar_stops` במסד והמרה לטיפוס של הלקוח. הוצא מ-`calendar-stops.ts`
 * ב-28/10/2026 כשהקובץ עבר את תקרת 500 השורות. 28/10: `phone_extra`,
 * `original_address`, `original_city` (מוסיפים ולא דורסים).
 */
export type CalendarStopRow = {
  id: string;
  delivery_date: string;
  driver: CalendarStop['driver'];
  sequence: number;
  route_id: string | null;
  source_type: CalendarStop['sourceType'];
  order_id: string | null;
  service_call_id: string | null;
  pickup_id: string | null;
  customer_number: string | null;
  customer_name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  phone_extra?: string | null;
  original_address?: string | null;
  original_city?: string | null;
  status: StopStatus;
  completed_at: string | null;
  notes: string | null;
  resolution_note: string | null;
  resolution_kind: 'not_done' | 'follow_up' | null;
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

export function rowToStop(row: CalendarStopRow): CalendarStop {
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
    customerNumber: row.customer_number ?? undefined,
    customerName: row.customer_name,
    address: row.address ?? undefined,
    city: row.city ?? undefined,
    phone: row.phone ?? undefined,
    phoneExtra: row.phone_extra ?? undefined,
    originalAddress: row.original_address ?? undefined,
    originalCity: row.original_city ?? undefined,
    coordinates,
    coordinatesSource,
    geocodedAt: row.geocoded_at ?? undefined,
    geocodedAddress: row.geocoded_address ?? undefined,
    status: row.status,
    completedAt: row.completed_at ?? undefined,
    notes: row.notes ?? undefined,
    resolutionNote: row.resolution_note ?? undefined,
    resolutionKind: row.resolution_kind ?? undefined,
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
