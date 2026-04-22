// Row from public.order_documents (loaded separately from the orders query)
export interface OrderDocument {
  id: string;
  orderId: string;
  storagePath: string;
  filename: string;
  sizeBytes?: number;
  mimeType?: string;
  created: string;
}

export interface Order {
  id: string;
  customerName: string;
  phone?: string;
  customerStatus?: 'לקוח חדש' | 'לקוח קיים';
  status?: 'Todo' | 'In progress' | 'Done';
  orderStatus?: 'ממתין לליקוט' | 'ממתין לתאום' | 'תואמה אספקה' | 'אין במלאי' | 'סופק';
  healthFund?: string;
  openedBy?: string;
  fax?: string;
  address?: string;
  city?: string;
  agent?: string;
  documents?: OrderDocument[];
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
