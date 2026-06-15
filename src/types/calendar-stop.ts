import type { DriverName } from './route';

export type StopSourceType = 'delivery' | 'service' | 'task';

export type StopStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'not_completed'
  | 'cancelled';

export type CoordinationStatus =
  | 'whatsapp_sent'
  | 'phone_confirmed'
  | 'customer_confirmed'
  | 'customer_rejected'
  | 'customer_change';

export type CoordinationMethod = 'whatsapp' | 'phone';

export interface CalendarStop {
  id: string;

  // Scheduling
  deliveryDate: string; // YYYY-MM-DD
  driver: DriverName;
  sequence: number;

  // Optional summary record
  routeId?: string;

  // Source
  sourceType: StopSourceType;
  orderId?: string;
  serviceCallId?: string;

  // Cached stop data
  customerName: string;
  address?: string;
  city?: string;
  phone?: string;

  // Location (3 levels of confidence)
  /** Resolved point: precise geocode if available, else city center. */
  coordinates?: { lat: number; lng: number };
  /** 'geocoded' = precise address, 'city' = city-center fallback, undefined = no location. */
  coordinatesSource?: 'geocoded' | 'city';
  geocodedAt?: string;
  geocodedAddress?: string;

  // Status
  status: StopStatus;
  completedAt?: string;
  notes?: string;

  // Coordination (WhatsApp / phone)
  coordinationStatus?: CoordinationStatus;
  coordinationMethod?: CoordinationMethod;
  coordinatedAt?: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  /** Set true when a coordinated stop is rescheduled — coordination must be cancelled with the customer. */
  coordinationNeedsCancel?: boolean;

  // Scheduling audit (from now on)
  scheduledBy?: string;
  rescheduledBy?: string;
  rescheduledAt?: string;

  created: string;
  updated: string;
}

export const STOP_SOURCE_LABELS: Record<StopSourceType, string> = {
  delivery: 'משלוח',
  service: 'שירות',
  task: 'משימה',
};

export const STOP_STATUS_LABELS: Record<StopStatus, string> = {
  planned: 'מתוכנן',
  in_progress: 'בביצוע',
  completed: 'בוצע',
  not_completed: 'לא בוצע',
  cancelled: 'בוטל',
};

/** Builds a CalendarStop from an Order (used on schedule). */
export interface ScheduleStopInput {
  deliveryDate: string;
  driver: DriverName;
  sequence?: number;
  sourceType: StopSourceType;
  orderId?: string;
  serviceCallId?: string;
  customerName: string;
  address?: string;
  city?: string;
  phone?: string;
  notes?: string;
  /** Display name of the user who scheduled this stop. */
  scheduledBy?: string;
}
