import type { AssigneeName } from './route';
import type { Assignee, AssigneeStyle } from './assignee';
import { styleForColor } from './assignee';

export type { AssigneeName };
export type { AssigneeStyle };

export type CalendarStopSource =
  | 'delivery'
  | 'service'
  | 'task'
  | 'pickup'
  | 'customer';
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
  /**
   * הסיבה שהעצירה סומנה "לא בוצע", כדי שהאיקס על כרטיס היומן לא יעמוד
   * בלי הסבר (עידן, 30/08/2026: "איפה אני רואה את הסיבה שזה עבר לאיקס?").
   */
  resolutionNote?: string;
  resolutionKind?: import('./calendar-stop').StopResolutionKind;
}

export interface CalendarDelivery {
  id: string;
  date: string; // YYYY-MM-DD
  driver: AssigneeName;
  stops: CalendarStop[];
}

/**
 * מטמון הצבעים של הצוות.
 *
 * 🔴 **למה מטמון ולא prop:** `assigneeStyle` נקראת מתוך תאי יומן, מרקרים
 * על המפה ושורות סיכום, מקומות שאין להם גישה ל-hook ושהעברת מפה אליהם
 * הייתה דורשת להשחיל prop דרך שכבות שלמות. `useAssignees` מזין את
 * המטמון, וכל קריאה נופלת לאפור ניטרלי עד שהוא מלא. הצבע קוסמטי, השם
 * תמיד מוצג, ולכן טעינה חלקית לא מסתירה מידע.
 */
const styleCache = new Map<string, AssigneeStyle>();

export function primeAssigneeStyles(list: Assignee[]): void {
  styleCache.clear();
  for (const a of list) styleCache.set(a.name, styleForColor(a.color, a.name));
}

const NEUTRAL_STYLE: AssigneeStyle = {
  label: '-',
  color: 'bg-muted text-muted-foreground',
  borderColor: 'border-s-muted-foreground',
  badgeColor: 'bg-muted-foreground',
};

/** חיפוש בטוח. לעולם לא קורס על שם שכבר לא קיים בטבלה. */
export function assigneeStyle(name: string | undefined | null): AssigneeStyle {
  if (!name) return NEUTRAL_STYLE;
  return styleCache.get(name) ?? { ...NEUTRAL_STYLE, label: name };
}
