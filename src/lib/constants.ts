export const ORDER_STATUS_OPTIONS = [
  { value: 'ממתין לליקוט', label: 'ממתין לליקוט', color: 'slate' },
  { value: 'ממתין לתאום', label: 'ממתין לתאום', color: 'blue' },
  { value: 'תואמה אספקה', label: 'תואמה אספקה', color: 'purple' },
  { value: 'אין במלאי', label: 'אין במלאי', color: 'amber' },
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

// ─── Service Calls ──────────────────────────────────────────

export const SERVICE_CALL_STATUS_OPTIONS = [
  { value: 'קריאה חדשה', label: 'קריאה חדשה', color: 'blue' },
  { value: 'תואם ביקור', label: 'תואם ביקור', color: 'purple' },
  { value: 'בוצע', label: 'בוצע', color: 'green' },
  { value: 'בוטל', label: 'בוטל', color: 'red' },
] as const;
