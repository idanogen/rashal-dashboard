// Airtable field names (Hebrew) mapped to our property names
export const FIELD_MAP: Record<string, string> = {
  'שם הלקוח': 'customerName',
  'טלפון': 'phone',
  'סטטוס לקוח': 'customerStatus',
  'Status': 'status',
  'סטטוס הזמנה': 'orderStatus',
  'קופת חולים': 'healthFund',
  'לקוח נפתח ע״י': 'openedBy',
  'פקס': 'fax',
  'כתובת': 'address',
  'עיר': 'city',
  'סוכן': 'agent',
  'מסמכים': 'documents',
  // הסרנו 'Created': 'created' - משתמשים ב-createdTime המובנה
};

// Reverse map: English property name -> Hebrew field name
export const REVERSE_FIELD_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FIELD_MAP).map(([k, v]) => [v, k])
);

export const ORDER_STATUS_OPTIONS = [
  { value: 'ממתין לתאום', label: 'ממתין לתאום', color: 'blue' },
  { value: 'תואמה אספקה ', label: 'תואמה אספקה', color: 'purple' },
  { value: 'איו במלאי', label: 'אין במלאי', color: 'amber' },
  { value: 'סופק', label: 'סופק', color: 'green' },
] as const;

export const TASK_STATUS_OPTIONS = [
  { value: 'Todo', label: 'לביצוע', color: 'red' },
  { value: 'In progress', label: 'בטיפול', color: 'yellow' },
  { value: 'Done', label: 'הושלם', color: 'green' },
] as const;

export const CUSTOMER_STATUS_OPTIONS = [
  { value: 'לקוח חדש', label: 'לקוח חדש', color: 'blue' },
  { value: 'לקוח קיים', label: 'לקוח קיים', color: 'gray' },
] as const;

export const WORKERS = ['שורה', 'אילונה'] as const;

// Display name for order status (handles typo "איו" -> "אין")
export function getOrderStatusLabel(status: string | undefined): string {
  if (!status) return 'לא ידוע';
  const option = ORDER_STATUS_OPTIONS.find(o => o.value === status);
  return option?.label || status;
}

export function getOrderStatusColor(status: string | undefined): string {
  if (!status) return 'gray';
  const option = ORDER_STATUS_OPTIONS.find(o => o.value === status);
  return option?.color || 'gray';
}

export function getTaskStatusLabel(status: string | undefined): string {
  if (!status) return 'לביצוע';
  const option = TASK_STATUS_OPTIONS.find(o => o.value === status);
  return option?.label || status;
}
