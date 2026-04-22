import type { DriverName } from './route';

export type { DriverName };

export type CalendarStopSource = 'delivery' | 'service' | 'task';
export type CalendarStopStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'not_completed'
  | 'cancelled';

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
