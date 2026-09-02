import { supabase } from './supabase';
import { isLowRated, openLowRated, orderLowRated } from './low-rated';

/**
 * סקרי שביעות רצון: שליפה ואגרגציה לדשבורד ההנהלה.
 *
 * הטבלה סגורה ל-anon לגמרי; המסך הזה קורא כמשתמש מחובר, ולכן policy
 * `authenticated_read_customer_surveys` הוא מה שמאפשר את השליפה.
 * הכתיבה לעולם לא עוברת מכאן, אלא רק דרך /api/survey בצד השרת.
 */

export interface Survey {
  id: string;
  stopId: string | null;
  orderId: string | null;
  customerNumber: string | null;
  customerName: string | null;
  /** הנייד שאליו יצא הסקר. משמש את קישור הוואטסאפ ברשימת ההערות. */
  phoneE164: string | null;
  driver: string | null;
  healthFund: string | null;
  deliveredAt: string | null;
  sentAt: string | null;
  openedAt: string | null;
  answeredAt: string | null;
  satisfaction: number | null;
  recommend: number | null;
  comment: string | null;
  status: 'pending' | 'sent' | 'answered' | 'skipped' | 'failed';
  /** מתי מישהו סימן שהדירוג הנמוך טופל. null = פתוח */
  handledAt: string | null;
  /** מי סימן. נגזר בשרת מהפרופיל, לא נשלח מהדפדפן */
  handledBy: string | null;
}

interface SurveyRow {
  id: string;
  stop_id: string | null;
  order_id: string | null;
  customer_number: string | null;
  customer_name: string | null;
  phone_e164: string | null;
  driver: string | null;
  health_fund: string | null;
  delivered_at: string | null;
  sent_at: string | null;
  opened_at: string | null;
  answered_at: string | null;
  q1_satisfaction: number | null;
  q2_recommend: number | null;
  comment: string | null;
  status: Survey['status'];
  handled_at: string | null;
  handled_by: string | null;
}

function toSurvey(r: SurveyRow): Survey {
  return {
    id: r.id,
    stopId: r.stop_id,
    orderId: r.order_id,
    customerNumber: r.customer_number,
    customerName: r.customer_name,
    phoneE164: r.phone_e164,
    driver: r.driver,
    healthFund: r.health_fund,
    deliveredAt: r.delivered_at,
    sentAt: r.sent_at,
    openedAt: r.opened_at,
    answeredAt: r.answered_at,
    satisfaction: r.q1_satisfaction,
    recommend: r.q2_recommend,
    comment: r.comment,
    status: r.status,
    handledAt: r.handled_at,
    handledBy: r.handled_by,
  };
}

const COLUMNS =
  'id, stop_id, order_id, customer_number, customer_name, phone_e164, driver, health_fund,' +
  ' delivered_at, sent_at, opened_at, answered_at, q1_satisfaction, q2_recommend, comment, status,' +
  ' handled_at, handled_by';

/**
 * כל הסקרים מ-N הימים האחרונים.
 *
 * ⚠️ `.range()` בלי `.order()` מפיל שורות כשהתוכנית מתחלפת באמצע הדפדוף,
 * ולכן יש כאן מיון מפורש. הנפח היום הוא בערך 7 שורות ביום, אז עמוד אחד
 * מספיק בהרבה, אבל המיון נשאר כדי שזה יישאר נכון גם בעוד שנה.
 */
export async function fetchSurveys(days = 30): Promise<Survey[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('customer_surveys')
    .select(COLUMNS)
    .gte('created_at', since)
    // שורות הבדיקה של עידן ושל שלומי נשארות במסד כהוכחה שהצינור עבד, אבל
    // הן לא מדידה. `eq(false)` ולא `neq(true)`, כי סינון שלילי ב-PostgREST
    // מפיל גם שורות עם NULL, ולכן העמודה היא NOT NULL DEFAULT false.
    .eq('is_test', false)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) throw error;
  // הטבלה חדשה ועדיין אינה בטיפוסים שנוצרו מהסכימה, ולכן המעבר דרך unknown.
  return ((data ?? []) as unknown as SurveyRow[]).map(toSurvey);
}

/* ─────────────────────────── אגרגציות ─────────────────────────── */

export interface NamedScore {
  name: string;
  avg: number;
  count: number;
}

export interface SurveyMetrics {
  /** נענו בפועל */
  answered: number;
  /** נשלחו (כולל אלה שנענו). המכנה של שיעור המענה */
  sent: number;
  /** ממוצע שביעות רצון, 1 עד 5 */
  satisfaction: number | null;
  /** ממוצע המלצה, 1 עד 5. זה אינו NPS תקני, כי הסולם הוא כוכבים */
  recommend: number | null;
  /** אחוז מענה, מעוגל */
  responseRate: number | null;
  /**
   * ציון 1 או 2 בשביעות רצון. אלה הלקוחות שכדאי להרים אליהם טלפון.
   * הפתוחים קודם, ואחריהם אלה שכבר סומנו כמטופלים.
   */
  lowRated: Survey[];
  /**
   * ⭐ אותם לקוחות **שעדיין לא טופלו**. זה המספר שמייצג עבודה פתוחה,
   * וזה המספר שמוצג בשני המסכים. תווית אחת ושני חישובים שונים היא בדיוק
   * הדרך שבה מסכים מתחילים לסתור זה את זה.
   * [[label_and_math_from_two_mechanisms]]
   */
  lowOpen: Survey[];
  byDriver: NamedScore[];
  byFund: NamedScore[];
  /** התשובות שיש בהן מלל חופשי, החדשות קודם */
  withComments: Survey[];
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function groupAverage(rows: Survey[], key: (s: Survey) => string | null): NamedScore[] {
  const buckets = new Map<string, number[]>();
  for (const row of rows) {
    const name = (key(row) ?? '').trim();
    if (!name || row.satisfaction === null) continue;
    const list = buckets.get(name) ?? [];
    list.push(row.satisfaction);
    buckets.set(name, list);
  }
  return [...buckets.entries()]
    .map(([name, values]) => ({ name, avg: average(values) as number, count: values.length }))
    .sort((a, b) => a.avg - b.avg); // הנמוך קודם: זה מה שדורש תשומת לב
}

export function computeSurveyMetrics(surveys: Survey[]): SurveyMetrics {
  const answered = surveys.filter((s) => s.answeredAt !== null);

  // המכנה הוא מי שההודעה יצאה אליו. סקר שעדיין בתור, או שדולג עליו,
  // אינו כישלון מענה ואסור לו להוריד את האחוז.
  const sent = surveys.filter((s) => s.sentAt !== null);

  // ⭐ הפתוחים קודם: הרשימה היא רשימת עבודה, ומה שכבר טופל יורד למטה
  // ולא נמחק, כדי שאפשר יהיה לראות מי טיפל ומתי.
  const low = orderLowRated(answered.filter(isLowRated));

  const satisfaction = average(
    answered.map((s) => s.satisfaction).filter((v): v is number => v !== null),
  );
  const recommend = average(
    answered.map((s) => s.recommend).filter((v): v is number => v !== null),
  );

  return {
    answered: answered.length,
    sent: sent.length,
    satisfaction,
    recommend,
    responseRate: sent.length > 0 ? Math.round((answered.length / sent.length) * 100) : null,
    lowRated: low,
    lowOpen: openLowRated(low),
    byDriver: groupAverage(answered, (s) => s.driver),
    byFund: groupAverage(answered, (s) => s.healthFund),
    withComments: answered
      .filter((s) => (s.comment ?? '').trim().length > 0)
      .sort((a, b) => (b.answeredAt ?? '').localeCompare(a.answeredAt ?? '')),
  };
}

/** מספר להצגה: ממוצע בעברית קצרה, או קו כשאין נתון. */
export function formatScore(v: number | null): string {
  return v === null ? '' : v.toFixed(1);
}

/* ─────────────────────────── טיפול וחיפוש ─────────────────────────── */

/**
 * סימון "טופל" על חוות דעת בדירוג נמוך, בשני הכיוונים.
 *
 * 🔴 עובר ב-RPC ולא בעדכון ישיר על הטבלה. מדיניות `update` על
 * `customer_surveys` הייתה פותחת לכל משתמש מחובר גם את הציון ואת ההערה,
 * כלומר את המדידה עצמה. **ושם המסמן נגזר בשרת** מהפרופיל של המשתמש
 * המחובר, כי דפדפן ששולח שם יכול לשלוח כל שם.
 */
export async function setSurveyHandled(
  surveyId: string,
  handled: boolean,
): Promise<{ handledAt: string | null; handledBy: string | null }> {
  const { data, error } = await supabase.rpc('set_survey_handled', {
    p_survey_id: surveyId,
    p_handled: handled,
  });
  if (error) throw error;
  const row = (data ?? {}) as { handled_at?: string | null; handled_by?: string | null };
  return { handledAt: row.handled_at ?? null, handledBy: row.handled_by ?? null };
}

/**
 * חיפוש חוות דעת **בכל ההיסטוריה**, לפי שם הלקוח שכתב אותה.
 *
 * 🔴 **למה בכלל צריך את זה ולא רק סינון של מה שכבר טעון.** המסך מציג את
 * <bdi>90</bdi> הימים האחרונים, ולכן חיפוש שמסתמך עליו בלבד יחזיר "לא
 * נמצא" על לקוח אמיתי שענה לפני ארבעה חודשים, וזו התשובה הגרועה מכולן:
 * היא נראית כמו עובדה ולא כמו גבול של חלון. הפונקציה הזאת רצה רק כשאין
 * התאמה בחלון, ולכן היא לא עולה כלום בשימוש הרגיל.
 *
 * ⚠️ הסינון עצמו נעשה בזיכרון עם `matchesSearch`, כדי שסדר המילים
 * והאותיות הסופיות יתנהגו בדיוק כמו בכל שאר החיפושים במערכת. השרת מחזיר
 * את חוות הדעת שנענו, מהחדשה לישנה, עד <bdi>1000</bdi> שורות.
 */
export async function searchAnsweredSurveys(): Promise<Survey[]> {
  const { data, error } = await supabase
    .from('customer_surveys')
    .select(COLUMNS)
    .eq('is_test', false)
    .not('answered_at', 'is', null)
    .order('answered_at', { ascending: false })
    .limit(1000);

  if (error) throw error;
  return ((data ?? []) as unknown as SurveyRow[]).map(toSurvey);
}
