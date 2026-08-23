/**
 * 🔴 **שמות הצוות אינם טיפוס יותר.** עד 23/08/2026 ישבה כאן רשימה סגורה
 * של שבעה שמות, וקליטת נהג או טכנאי חדש חייבה שינוי קוד ופריסה. הרשימה
 * עברה לטבלת `assignees` ולמסך הצוות, וכאן נשאר רק הכינוי לשם.
 *
 * מי שצריך את הרשימה החיה קורא ל-`useAssignees()`.
 */
export type AssigneeName = string;

export type RouteStatus = 'מאושר' | 'בביצוע' | 'הושלם' | 'בוטל';

export const ROUTE_STATUS_OPTIONS = [
  { value: 'מאושר' as const, label: 'מאושר', color: 'blue' },
  { value: 'בביצוע' as const, label: 'בביצוע', color: 'amber' },
  { value: 'הושלם' as const, label: 'הושלם', color: 'green' },
  { value: 'בוטל' as const, label: 'בוטל', color: 'red' },
] as const;

export interface RouteStop {
  id: string;
  customerName: string;
  address?: string;
  city?: string;
  phone?: string;
  sequence: number;
}

export interface ApprovedRoute {
  id: string;
  routeName: string;
  driver: AssigneeName;
  deliveryDate: string;
  status: RouteStatus;
  orderIds: string[];
  stops: RouteStop[];
  stopCount: number;
  estimatedDistance: number;
  estimatedTime: number;
  notes?: string;
  created: string;
}
