import type { DriverName, AssigneeName } from './route';

export type { DriverName, AssigneeName };

export type CalendarStopSource = 'delivery' | 'service' | 'task' | 'pickup';
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
  /** המשובץ (נהג או טכנאי) */
  driver: AssigneeName;
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
  driver: AssigneeName;
  stops: CalendarStop[];
}

export interface AssigneeStyle {
  label: string;
  color: string;
  borderColor: string;
  badgeColor: string;
}

export const DRIVER_CONFIG: Record<AssigneeName, AssigneeStyle> = {
  דוד: {
    label: 'דוד',
    color: 'bg-blue-100 text-blue-700',
    borderColor: 'border-s-blue-500',
    badgeColor: 'bg-blue-500',
  },
  רודי: {
    label: 'רודי',
    color: 'bg-emerald-100 text-emerald-700',
    borderColor: 'border-s-emerald-500',
    badgeColor: 'bg-emerald-500',
  },
  מוחמד: {
    label: 'מוחמד',
    color: 'bg-purple-100 text-purple-700',
    borderColor: 'border-s-purple-500',
    badgeColor: 'bg-purple-500',
  },
  מוהנד: {
    label: 'מוהנד',
    color: 'bg-amber-100 text-amber-700',
    borderColor: 'border-s-amber-500',
    badgeColor: 'bg-amber-500',
  },
  אולג: {
    label: 'אולג',
    color: 'bg-cyan-100 text-cyan-700',
    borderColor: 'border-s-cyan-500',
    badgeColor: 'bg-cyan-500',
  },
  ישראל: {
    label: 'ישראל',
    color: 'bg-rose-100 text-rose-700',
    borderColor: 'border-s-rose-500',
    badgeColor: 'bg-rose-500',
  },
  אבי: {
    label: 'אבי',
    color: 'bg-indigo-100 text-indigo-700',
    borderColor: 'border-s-indigo-500',
    badgeColor: 'bg-indigo-500',
  },
};

const NEUTRAL_STYLE: AssigneeStyle = {
  label: '—',
  color: 'bg-muted text-muted-foreground',
  borderColor: 'border-s-muted-foreground',
  badgeColor: 'bg-muted-foreground',
};

/** Safe lookup — never crashes on an unknown/legacy assignee value. */
export function assigneeStyle(name: string | undefined | null): AssigneeStyle {
  if (!name) return NEUTRAL_STYLE;
  return DRIVER_CONFIG[name as AssigneeName] ?? { ...NEUTRAL_STYLE, label: name };
}
