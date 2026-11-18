/**
 * ארכיון ההזמנות (18/11/2026): מה שירד מ"הזמנות ממתינות לתיאום". הכלל חי במסד
 * (`orders_archive_stale`, 20261118_orders_archive_rule.sql, רץ כל בוקר); כאן רק
 * התצוגה. קובץ בלי ייבוא, לכן נבדק ביחידה.
 *
 * ⭐ השדות זהים לשורת ארכיון של קריאה, כדי שאותו חיפוש (`matchesArchiveSearch`)
 * ואותו מסך ישמשו את שתיהן. כ-6,800 הזמנות שאורכבו באוגוסט לא מוצגות כאן.
 */

export interface ArchivedOrder {
  id: string;
  docno: string | null;
  customerName: string;
  customerNumber: string | null;
  phone: string | null;
  city: string | null;
  priorityStatus: string | null;
  created: string;
  archivedAt: string;
  reason: string;
}

export interface ArchivedOrderRow {
  id: string;
  priority_order_id: string | null;
  customer_name: string | null;
  customer_number: string | null;
  phone: string | null;
  city: string | null;
  priority_status: string | null;
  created_at: string;
  archived_at: string;
  archived_reason: string | null;
}

/** המסנן של השליפה (PostgREST `or`): רק הכלל והכפתור הידני. */
export const ORDERS_ARCHIVE_FILTER = 'archived_reason.like.rule:*,archived_reason.eq.manual';

/** מה הכפתור הידני כותב, ומה ההחזרה כותבת כדי שהכלל היומי לא יחזיר לארכיון. */
export const ORDER_ARCHIVE_MANUAL = 'manual';
export const ORDER_ARCHIVE_RESTORED = 'restored';

export function rowToArchivedOrder(r: ArchivedOrderRow): ArchivedOrder {
  return {
    id: r.id,
    docno: r.priority_order_id,
    customerName: r.customer_name ?? '',
    customerNumber: r.customer_number,
    phone: r.phone,
    city: r.city,
    priorityStatus: r.priority_status,
    created: r.created_at,
    archivedAt: r.archived_at,
    reason: r.archived_reason ?? '',
  };
}

/** למה ההזמנה בארכיון, במילים של המשרד. */
export function orderArchiveReasonLabel(reason: string, priorityStatus: string | null): string {
  if (reason === 'rule:billed-30d') return `${priorityStatus ?? 'בוצעה'} בפריוריטי, מעל 30 יום בלי שיבוץ`;
  if (reason === 'rule:approved-90d') return 'מאושרת לבצוע, מעל 90 יום בלי שיבוץ';
  if (reason === 'rule:dup') return 'כפיל';
  if (reason === ORDER_ARCHIVE_MANUAL) return 'הועברה ידנית';
  return reason;
}
