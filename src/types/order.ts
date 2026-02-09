export interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  size: number;
  type: string;
  thumbnails?: {
    small?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
  };
}

export interface Order {
  id: string;
  customerName: string;
  phone?: string;
  customerStatus?: 'לקוח חדש' | 'לקוח קיים';
  status?: 'Todo' | 'In progress' | 'Done';
  orderStatus?: 'ממתין לתאום' | 'איו במלאי' | 'סופק';
  healthFund?: string;
  openedBy?: string;
  fax?: string;
  address?: string;
  city?: string;
  agent?: string;
  documents?: AirtableAttachment[];
  created: string;
}

export interface OrderStats {
  total: number;
  byOrderStatus: {
    waiting: number;
    outOfStock: number;
    delivered: number;
  };
  byWorker: Record<string, number>;
  byStatus: {
    todo: number;
    inProgress: number;
    done: number;
  };
  uniqueCities: string[];
  todayCount: number;
  thisWeekDelivered: number;
}

export type OrderField = keyof Omit<Order, 'id'>;
