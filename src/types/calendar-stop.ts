import type { AssigneeName } from './route';

export type StopSourceType =
  | 'delivery'
  | 'service'
  | 'task'
  | 'pickup'
  | 'customer';

export type StopStatus =
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'not_completed'
  | 'cancelled';

/**
 * איך נסגרה עצירה שלא הושלמה.
 *
 * 🔴🔴 **עמי, 26/08/2026:** אספקה שיצאה והסתיימה חלקית (חגורה שלא
 * התאימה) איננה "בוצע" ואיננה "לא בוצע", ולכן הנהג **לא לחץ כלום**
 * והעצירה נשארה פתוחה לנצח. זה המנגנון שמייצר את השאריות.
 *
 * ⭐ הסטטוס נשאר `not_completed` בשני המקרים, כי ההתנהגות זהה: העצירה
 * נסגרת והמקור חוזר לממתינים. מה שההבחנה הזאת מוסיפה היא **מה המשרד
 * רואה**: "לא הגיע" מול "הגיע, וצריך להשלים".
 */
export type StopResolutionKind = 'not_done' | 'follow_up';

export const RESOLUTION_KIND_LABELS: Record<StopResolutionKind, string> = {
  not_done: 'לא בוצע',
  follow_up: 'נדרש המשך טיפול',
};

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
  driver: AssigneeName;
  sequence: number;

  // Optional summary record
  routeId?: string;

  // Source
  sourceType: StopSourceType;
  orderId?: string;
  serviceCallId?: string;
  pickupId?: string;
  /** CUSTNAME בפריוריטי. חובה כש-sourceType='customer'. */
  customerNumber?: string;

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
  /** תיאור המשימה, כפי שנרשם בהקמה. */
  notes?: string;
  /**
   * מה שהנהג רשם כשסימן בוצע או לא בוצע.
   * 🔴 עמודה נפרדת מ-`notes` מאז 23/08/2026: עד אז הסיבה נכתבה לתוך
   * `notes` ודרסה את תיאור המשימה. 27 משימות כבר איבדו אותו כך.
   */
  resolutionNote?: string;
  /** `not_done` או `follow_up`. ריק בעצירות שנסגרו לפני 27/08/2026. */
  resolutionKind?: StopResolutionKind;

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
  pickup: 'איסוף',
  customer: 'לקוח חדש',
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
  driver: AssigneeName;
  sequence?: number;
  sourceType: StopSourceType;
  orderId?: string;
  serviceCallId?: string;
  pickupId?: string;
  customerNumber?: string;
  customerName: string;
  address?: string;
  city?: string;
  phone?: string;
  notes?: string;
  /** Display name of the user who scheduled this stop. */
  scheduledBy?: string;
}
