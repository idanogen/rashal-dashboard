import type { CalendarStop, StopSourceType } from '@/types/calendar-stop';
import { supabase } from './supabase';
import { rowToStop, type CalendarStopRow } from './calendar-stops-row';

/**
 * בדיקת כפילות לפני שיבוץ. הוצא מ-`calendar-stops.ts` ב-28/10/2026 כשהקובץ
 * עבר את תקרת 500 השורות. הלוגיקה כמו שהייתה.
 */
export async function findActiveDuplicateStops(input: {
  customerName: string;
  phone?: string;
  address?: string;
  city?: string;
  /**
   * 🔴🔴 **סוג העצירה, ובלעדיו הבדיקה חוסמת עבודה לגיטימית.**
   *
   * עמי, 26/08/2026: "לקוח קיים פתח קריאה לביטול עסקה, לבוא לאסוף משהו
   * שסיפקתי לו לפני שבוע, והמערכת לא נותנת לי לשבץ. זה לא אחד ולא שתיים."
   *
   * השורש: אספקה ואיסוף לאותו לקוח הם **שתי עבודות שונות**, ועד היום
   * שתיהן נחשבו כאן לאותו דבר. נמדד לפני התיקון: **85 פריטים פתוחים**
   * (45 איסופים, 27 הזמנות, 13 קריאות) שאי אפשר היה לשבץ.
   *
   * ⭐ ההגנה המקורית נשמרת במלואה: שתי אספקות לאותו לקוח עדיין נחסמות.
   * מה שהשתנה הוא רק שסוגים שונים מפסיקים להתנגש זה בזה.
   *
   * 🔴 אופציונלי בכוונה, כדי לא לשבור קורא שטרם עודכן. בלעדיו ההתנהגות
   * היא הישנה, וזה בדיוק המקרה שצריך להיעלם, ולכן כל הקוראים עודכנו.
   */
  sourceType?: StopSourceType;
}): Promise<CalendarStop[]> {
  const target = {
    customerName: norm(input.customerName),
    phone: norm(input.phone),
    address: norm(input.address),
    city: norm(input.city),
  };

  let query = supabase
    .from('calendar_stops')
    .select('*')
    .in('status', ['planned', 'in_progress'])
    .ilike('customer_name', input.customerName.trim());
  // ⭐ מסונן בשרת ולא בדפדפן, כדי שהבדיקה תזהה בדיוק את מה שהמדד
  // הייחודי שבמסד יחסום, ולא יותר. שתי אמיתות שמתפצלות כאן פירושן
  // דיאלוג שקופץ על משהו שהיה עובר, או שיבוץ שנכשל בלי אזהרה.
  if (input.sourceType) query = query.eq('source_type', input.sourceType);
  // Pull a wide candidate set (by customer name) and filter the rest client-side
  // so we don't have to construct case-insensitive ilike clauses for every column.

  const { data, error } = await query;
  if (error) throw new Error(`findActiveDuplicateStops: ${error.message}`);
  const rows = (data as CalendarStopRow[]) ?? [];
  return rows
    .map(rowToStop)
    .filter(
      (s) =>
        norm(s.customerName) === target.customerName &&
        norm(s.phone) === target.phone &&
        norm(s.address) === target.address &&
        norm(s.city) === target.city
    );
}

function norm(s: string | undefined | null): string {
  if (!s) return '';
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}
