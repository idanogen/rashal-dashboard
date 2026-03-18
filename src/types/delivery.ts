import type { DriverName } from './route';

export type { DriverName };

export interface CalendarStop {
  orderId: string;
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
