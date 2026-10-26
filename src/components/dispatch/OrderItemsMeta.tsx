import { craneInOrder } from '@/lib/crane-identity';
import type { Order } from '@/types/order';

/**
 * שורת הציוד של הזמנה ברשימת הממתינים בסדרן.
 *
 * ⭐ עידן, 26/10/2026: "אני רוצה להציג את האימוג'י של המנוף". הזמנה עם מנוף
 * (לפי המק"ט, `craneInOrder`) מקבלת 🏗️ כבר כאן, לפני השיבוץ, כי זה ביקור
 * ארוך יותר ואישור הדרכה חובה לנהג.
 */
export function OrderItemsMeta({ items }: { items: Order['items'] }) {
  if (!items || items.length === 0) return null;
  const first = items[0];
  return (
    <p
      className="mt-0.5 text-[11px] text-muted-foreground"
      title={items.map((it) => `${it.desc ?? it.part ?? ''}${it.qty && it.qty !== 1 ? ` ×${it.qty}` : ''}`).join('\n')}
    >
      {craneInOrder(items) && (
        <span
          className="me-1 inline-flex items-center rounded-md border border-amber-300 bg-amber-50 px-1 text-[10px] font-semibold text-amber-900"
          title="אספקת מנוף: הנהג חייב להחתים על אישור הדרכה"
        >
          🏗️ מנוף
        </span>
      )}
      ציוד: <bdi>{first.desc ?? first.part}</bdi>
      {first.qty && first.qty !== 1 ? ` ×${first.qty}` : ''}
      {items.length > 1 && <span className="font-medium"> (+{items.length - 1} פריטים)</span>}
    </p>
  );
}
