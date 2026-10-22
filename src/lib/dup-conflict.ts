/**
 * האם השיבוץ הקיים שייך למסמך **אחר** של אותו לקוח.
 *
 * 🔴 עמי, 20/10 ו-22/10/2026: ללקוח שני איסופים פתוחים, מנוף וכיסא. שיבץ
 * אחד, והשני נחסם כ"שיבוץ כפול". שני מסמכים שונים הם עבודה אמיתית, ולכן
 * מ-22/10 המדד הייחודי במסד כולל את המסמך
 * (`20261022_dup_guard_by_source_record.sql`), והדיאלוג מציע "שבץ גם את זה".
 *
 * ⭐ חייב להסכים עם המדד: הוא מפריד לפי `order_id`/`service_call_id`/
 * `pickup_id`. לקוח חדש (`customer`) אין לו מסמך, ושם החסימה נשארת.
 *
 * קובץ טהור בלי ייבוא, כדי שייבדק.
 */

export type DupKind = 'delivery' | 'service' | 'pickup' | 'customer';

interface StopRef {
  orderId?: string;
  serviceCallId?: string;
  pickupId?: string;
}

/** מזהה המסמך שהעצירה נשענת עליו, כמו הרכיב האחרון במפתח המדד. */
export function stopRecordId(s: StopRef): string | undefined {
  return s.orderId ?? s.serviceCallId ?? s.pickupId ?? undefined;
}

/**
 * true כשכל השיבוצים הקיימים הם של מסמכים אחרים, כלומר המסד ירשה את
 * השיבוץ החדש. שיבוץ קיים בלי מסמך, או של אותו מסמך, מחזיר false.
 */
export function isOtherDocument(kind: DupKind, itemId: string, existing: StopRef[]): boolean {
  if (kind === 'customer' || existing.length === 0) return false;
  return existing.every((s) => {
    const rid = stopRecordId(s);
    return rid !== undefined && rid !== itemId;
  });
}
