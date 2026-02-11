import type { Order } from '@/types/order';
import { getDaysSinceCreated } from '@/lib/utils';

/**
 * ייצוא רשימת הזמנות (מסלול) לקובץ CSV
 *
 * הקובץ כולל:
 * - מספר סידורי (1, 2, 3...)
 * - שם לקוח
 * - טלפון
 * - כתובת
 * - עיר
 * - סטטוס הזמנה
 * - ימים מאז יצירה
 *
 * @param orders - רשימת הזמנות בסדר המסלול
 * @param filename - שם הקובץ (אופציונלי)
 */
export function exportRouteToCSV(
  orders: Order[],
  filename?: string
): void {
  if (orders.length === 0) {
    console.warn('אין הזמנות לייצוא');
    return;
  }

  // כותרות
  const headers = [
    'מספר',
    'שם לקוח',
    'טלפון',
    'כתובת',
    'עיר',
    'סטטוס',
    'ימים מאז יצירה',
  ];

  // שורות
  const rows = orders.map((order, index) => {
    const days = getDaysSinceCreated(order.created);

    return [
      (index + 1).toString(),
      order.customerName || '',
      order.phone || '',
      order.address || '',
      order.city || '',
      order.orderStatus || '',
      days !== null ? days.toString() : '',
    ];
  });

  // בניית תוכן CSV
  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');

  // BOM (Byte Order Mark) לתמיכה בעברית ב-Excel
  const bom = '\ufeff';
  const blob = new Blob([bom + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });

  // הורדת הקובץ
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  // שם קובץ ברירת מחדל: route-YYYY-MM-DD.csv
  const defaultFilename = `route-${
    new Date().toISOString().split('T')[0]
  }.csv`;
  link.download = filename || defaultFilename;

  // לחיצה על הלינק להורדה
  document.body.appendChild(link);
  link.click();

  // ניקוי
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * ייצוא רשימת הזמנות לפורמט JSON (לשימוש עתידי)
 * @param orders - רשימת הזמנות
 * @param filename - שם הקובץ
 */
export function exportRouteToJSON(
  orders: Order[],
  filename?: string
): void {
  if (orders.length === 0) {
    console.warn('אין הזמנות לייצוא');
    return;
  }

  const jsonContent = JSON.stringify(orders, null, 2);
  const blob = new Blob([jsonContent], {
    type: 'application/json;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;

  const defaultFilename = `route-${
    new Date().toISOString().split('T')[0]
  }.json`;
  link.download = filename || defaultFilename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
