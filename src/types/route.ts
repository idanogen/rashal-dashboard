// נהגי חלוקה (מסך משלוחים). דוד הוא גם טכנאי.
export type DriverName = 'דוד' | 'רודי' | 'מוחמד' | 'מוהנד';
// טכנאי שירות (מסך קריאות שירות). דוד מופיע גם כאן.
export type TechnicianName = 'אולג' | 'ישראל' | 'אבי' | 'דוד';
// כל ערכי ה-enum `driver_name` ב-DB — assignee של עצירה (נהג או טכנאי).
export type AssigneeName = DriverName | TechnicianName;

export type RouteStatus = 'מאושר' | 'בביצוע' | 'הושלם' | 'בוטל';

export const DRIVERS: DriverName[] = ['דוד', 'רודי', 'מוחמד', 'מוהנד'];
export const TECHNICIANS: TechnicianName[] = ['אולג', 'ישראל', 'אבי', 'דוד'];
/** כל ה-assignees לבחירה (נהגים + טכנאים) ללא כפילות — דוד מופיע פעם אחת. לקישור משתמש. */
export const ASSIGNEES: AssigneeName[] = ['דוד', 'רודי', 'מוחמד', 'מוהנד', 'אולג', 'ישראל', 'אבי'];
/** טכנאים שאינם נהגים — לניתוב משימות (task) למסך הנכון. דוד (נהג+טכנאי) משויך למשלוחים. */
export const TECHNICIAN_ONLY = new Set<AssigneeName>(['אולג', 'ישראל', 'אבי']);

/** טלפונים — לשמירה בלבד (ללא תצוגה כרגע). */
export const ASSIGNEE_PHONES: Record<AssigneeName, string> = {
  דוד: '058-5868780',
  רודי: '050-8334248',
  מוחמד: '0522906066',
  מוהנד: '052-5079808',
  אולג: '050-4466123',
  ישראל: '054-9018939',
  אבי: '058-6699369',
};

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
  driver: DriverName;
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
