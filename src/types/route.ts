export type DriverName = 'רודי דויד' | 'נהג חיצוני מועלם';
export type RouteStatus = 'מאושר' | 'בביצוע' | 'הושלם' | 'בוטל';

export const DRIVERS: DriverName[] = ['רודי דויד', 'נהג חיצוני מועלם'];

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
