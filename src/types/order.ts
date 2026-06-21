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

export type CustomerReplyStatus = 'ממתין' | 'מתאים' | 'לא מתאים' | 'בקשת שינוי';

export interface Order {
  id: string;
  customerName: string;
  /** מספר לקוח מפריוריטי (CUSTNAME). נמשך דרך Make. */
  customerNumber?: string;
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
  /** If set, this row is a Priority dupe of the referenced head row. */
  duplicateOf?: string;
  /** When the user scheduled a manual WhatsApp reminder for this order. */
  scheduledReminderAt?: string;
  /** Last parsed WhatsApp reply status from the customer. */
  customerReplyStatus?: CustomerReplyStatus;
  /** Free-text time the customer requested (e.g. "אחה"צ", "מחר"). */
  customerRequestedTime?: string;
  /** When the most recent WhatsApp reminder was sent for this order. */
  lastReminderAt?: string;
  /** YYYY-MM-DD — when the order is scheduled for delivery (cron uses this). */
  deliveryDate?: string;
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
