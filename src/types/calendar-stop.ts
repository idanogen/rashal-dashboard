import type { DriverName } from './route';

export type StopSourceType = 'delivery' | 'service' | 'task';

export type StopStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'not_completed'
  | 'cancelled';

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

  // Status
  status: StopStatus;
  completedAt?: string;
  notes?: string;

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
}
