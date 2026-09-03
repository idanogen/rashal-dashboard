import { supabase } from './supabase';
import type { OpenedByMonthRow } from './month-series';

/**
 * הזמנות שנפתחו לפי חודש, כולל ארכיון. ספירה במסד (`orders_opened_by_month`),
 * כי הדפדפן לא טוען ארכיון ולא צריך שיטען אלפי שורות רק כדי לספור.
 */
export async function fetchOrdersOpenedByMonth(from: Date): Promise<OpenedByMonthRow[]> {
  const pFrom = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-01`;
  const { data, error } = await supabase.rpc('orders_opened_by_month', { p_from: pFrom });
  if (error) throw error;
  return ((data ?? []) as Array<Record<string, unknown>>).map((r) => ({
    month: String(r.month),
    opened: Number(r.opened) || 0,
    cancelled: Number(r.cancelled) || 0,
  }));
}
