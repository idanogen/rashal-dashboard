import { supabase } from './supabase';
import {
  ORDER_ARCHIVE_MANUAL,
  ORDER_ARCHIVE_RESTORED,
  ORDERS_ARCHIVE_FILTER,
  rowToArchivedOrder,
  type ArchivedOrder,
  type ArchivedOrderRow,
} from './orders-archive-rules';

const COLS =
  'id, priority_order_id, customer_name, customer_number, phone, city, priority_status, created_at, archived_at, archived_reason';

/** כל מה שבארכיון ההזמנות, החדש שעבר למעלה. מעומד, כי PostgREST חותך ב-1,000. */
export async function fetchArchivedOrders(): Promise<ArchivedOrder[]> {
  const PAGE = 1000;
  const all: ArchivedOrder[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('orders')
      .select(COLS)
      .not('archived_at', 'is', null)
      .or(ORDERS_ARCHIVE_FILTER)
      .order('archived_at', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`ארכיון ההזמנות: ${error.message}`);
    const rows = (data as ArchivedOrderRow[]) ?? [];
    all.push(...rows.map(rowToArchivedOrder));
    if (rows.length < PAGE) return all;
  }
}

/**
 * 🔴 עדכון שתפס אפס שורות אינו שגיאה ב-PostgREST (משתמש בלי הרשאה), לכן סופרים.
 * ההחזרה כותבת 'restored', והכלל היומי מדלג עליה, אחרת היא חוזרת לארכיון מחר.
 */
async function setArchive(id: string, archived: boolean): Promise<void> {
  const patch = archived
    ? { archived_at: new Date().toISOString(), archived_reason: ORDER_ARCHIVE_MANUAL }
    : { archived_at: null, archived_reason: ORDER_ARCHIVE_RESTORED };
  const { data, error } = await supabase.from('orders').update(patch).eq('id', id).select('id');
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('אין הרשאה לשנות את ההזמנה, או שהיא כבר עודכנה');
}

export const restoreArchivedOrder = (id: string) => setArchive(id, false);
export const archiveOrderManually = (id: string) => setArchive(id, true);
