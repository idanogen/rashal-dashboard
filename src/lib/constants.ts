export const ORDER_STATUS_OPTIONS = [
  { value: 'ממתין לליקוט', label: 'ממתין לליקוט', color: 'slate' },
  { value: 'ממתין לתאום', label: 'ממתין לתאום', color: 'blue' },
  { value: 'תואמה אספקה', label: 'תואמה אספקה', color: 'purple' },
  { value: 'אין במלאי', label: 'אין במלאי', color: 'amber' },
  { value: 'סופק', label: 'סופק', color: 'green' },
  { value: 'בוטל', label: 'בוטל', color: 'red' },
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

// ─── Data window ────────────────────────────────────────────
// Upper bound on how far back the list screens load rows. The tables grow with
// every Priority sync (orders went 600 → 6,000 in four months) and the client
// reads them whole, so an unbounded fetch gets heavier forever.
//
// 180 days excludes nothing today — the oldest order is from 06/04/2026 — so
// this is a growth guard, not a behaviour change. Anything touched inside the
// window is kept regardless of age (see dataWindowFilter), so an old record
// that is still being worked on never disappears from the screen.
// Tighten this number if the dispatcher does not need half a year of history.
export const DATA_WINDOW_DAYS = 180;

export function dataWindowCutoff(): string {
  const d = new Date();
  d.setDate(d.getDate() - DATA_WINDOW_DAYS);
  return d.toISOString();
}

/** PostgREST `or` clause: created inside the window, or touched inside it. */
export function dataWindowFilter(): string {
  const cutoff = dataWindowCutoff();
  return `created_at.gte.${cutoff},updated_at.gte.${cutoff}`;
}
