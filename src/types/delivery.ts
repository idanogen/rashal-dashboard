import type { DriverName } from './route';

export type { DriverName };

export type CalendarStopSource = 'delivery' | 'service' | 'task';
export type CalendarStopStatus =
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
  /** calendar_stops.id — יחידת הזיהוי של ה-stop ביומן */
  stopId: string;
  /** orderId או serviceCallId — תלוי בסוג */
  sourceId: string;
  sourceType: CalendarStopSource;
  status: CalendarStopStatus;
  /** יום האספקה */
  deliveryDate: string;
  /** הנהג המשויך */
  driver: DriverName;
  customerName: string;
  address?: string;
  city?: string;
  phone?: string;
  /** נקודה מדויקת (geocoded) או מרכז-עיר (fallback) — לציור על המפה ולניווט. */
  coordinates?: { lat: number; lng: number };
  /** 'geocoded' = מדויק, 'city' = לפי עיר, undefined = אין מיקום. */
  coordinatesSource?: 'geocoded' | 'city';
  /** WhatsApp / phone coordination tracking */
  coordinationStatus?: CoordinationStatus;
  coordinationMethod?: CoordinationMethod;
  coordinatedAt?: string;
  timeWindowStart?: string;
  timeWindowEnd?: string;
  /** Set true when a coordinated stop is rescheduled — coordination must be cancelled. */
  coordinationNeedsCancel?: boolean;
  /** Scheduling audit (display names). */
  scheduledBy?: string;
  rescheduledBy?: string;
  rescheduledAt?: string;
}

export interface CalendarDelivery {
  id: string;
  date: string; // YYYY-MM-DD
  driver: DriverName;
  stops: CalendarStop[];
}

export const DRIVER_CONFIG: Record<DriverName, {
  label: string;
  color: string;
  borderColor: string;
  badgeColor: string;
}> = {
  'רודי דויד': {
    label: 'רודי דויד',
    color: 'bg-blue-100 text-blue-700',
    borderColor: 'border-s-blue-500',
    badgeColor: 'bg-blue-500',
  },
  'נהג חיצוני מועלם': {
    label: 'נהג חיצוני',
    color: 'bg-purple-100 text-purple-700',
    borderColor: 'border-s-purple-500',
    badgeColor: 'bg-purple-500',
  },
};
