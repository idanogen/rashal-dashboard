import type { NewCustomer } from '@/types/customer';
import { supabase } from './supabase';
import { dataWindowCutoff } from './constants';
import { timedFetch } from './perf-collect';

type CustomerRow = {
  custname: string;
  cdes: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  fax: string | null;
  agent: string | null;
  health_fund: string | null;
  opened_by: string | null;
  priority_udate: string | null;
  has_order?: boolean | null;
  has_service_call?: boolean | null;
  has_pickup?: boolean | null;
  is_scheduled?: boolean | null;
};

/**
 * לקוחות שנפתחו בפריוריטי בתוך חלון הנתונים, עם סימון מה כבר קיים לצדם.
 * ממוין מהחדש לישן: הלקוח שנפתח היום הוא זה שהאספקה שלו הכי קרובה.
 *
 * 🔴🔴 **היה כאן 34 קריאות רשת, והפך לאחת.**
 *
 * המימוש הקודם שאב את כל הלקוחות (1,462 בחלון), ואז שאל **מהדפדפן**
 * "למי מהם יש כבר הזמנה / קריאה / איסוף / שיבוץ" בארבע שליפות נפרדות,
 * כל אחת מהן באצוות של 200 מספרי לקוח **בלולאה סדרתית**:
 * `ceil(1462/200) = 8` סבבים לכל טבלה. ⭐ ובנוסף השאלה "האם קיימת
 * הזמנה" הוחזרה כ**שורות**: 1,477 שורות הזמנה נסעו לדפדפן רק כדי
 * שנסמן וי על 1,214 לקוחות.
 *
 * ⭐ **וזה בדיוק מה שמדידת הטעינה חשפה:** השליפה הזאת יצאה הנתיב
 * הקריטי של מסך הסדרן גם כשהיא מחזירה אפס שורות, כי מה שעולה זמן הוא
 * הסבבים ולא הנתונים. [[cron_hour_must_match_when_humans_work]]
 *
 * 🔴 עכשיו `exists(...)` במסד, שם זה בדיוק מה שאינדקס עושה טוב.
 * נמדד: **60 מילישניות לכל 1,462 השורות עם ארבעת הדגלים.**
 */
export async function fetchNewCustomers(): Promise<NewCustomer[]> {
  return timedFetch(
    'customers',
    async (countPage) => {
      // 🔴🔴 **גם RPC נחתך על 1,000 שורות.** התקרה של PostgREST חלה על
      // כל תשובה, גם כשהיא מגיעה מפונקציה. נתפס בייצור **באותו יום שבו
      // הקוד הזה נכתב**, ביומן הטעינה: `customers` החזירה בדיוק 1,000
      // במקום 1,462, כלומר **462 לקוחות נעלמו בשקט** ולא הייתה שום
      // שגיאה. בדיוק אותה מלכודת שהעימוד הישן כאן הגן מפניה.
      // [[postgrest_default_row_cap]]
      const PAGE = 1000;
      const rows: CustomerRow[] = [];
      for (let from = 0; ; from += PAGE) {
        countPage();
        const { data, error } = await supabase
          .rpc('new_customers', { p_since: dataWindowCutoff() })
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`fetchNewCustomers: ${error.message}`);
        const batch = (data ?? []) as CustomerRow[];
        rows.push(...batch);
        if (batch.length < PAGE) break;
      }

      return rows.map((r) => ({
        customerNumber: r.custname,
        customerName: r.cdes ?? r.custname,
        address: r.address ?? undefined,
        city: r.city ?? undefined,
        phone: r.phone ?? undefined,
        fax: r.fax ?? undefined,
        agent: r.agent ?? undefined,
        healthFund: r.health_fund ?? undefined,
        openedBy: r.opened_by ?? undefined,
        openedAt: r.priority_udate ?? undefined,
        hasOrder: !!r.has_order,
        hasServiceCall: !!r.has_service_call,
        hasPickup: !!r.has_pickup,
        isScheduled: !!r.is_scheduled,
      }));
    },
    (rows) => rows.length
  );
}

