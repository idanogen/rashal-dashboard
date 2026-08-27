/**
 * ציון נמוך בסקר: מי מקבל התרעה, ומה כתוב בה.
 *
 * ⭐ **הבקשה של שלומי הייתה לשלוח הודעה ללקוח**, ומדידה לפני הבנייה שינתה
 * את הצורה. מתוך 35 חוות דעת שנענו מאז <bdi>16/08/2026</bdi> יש שלוש
 * בציון 3 ומטה, ו**בכל שלוש הלקוח כבר כתב הערה שמסבירה למה**. הודעה
 * אוטומטית ששואלת "למה אתה מרגיש ככה" למי שהרגע ענה על זה היא ההודעה
 * שמוכיחה שאיש לא קרא.
 *
 * 🔴 **ומתוך השלוש, שתיים היו בדיקות שלנו, והלקוחה האמיתית היחידה נתנה
 * את הציון הנמוך ביותר וכתבה מחמאה על שירות מהיר.** כלומר מנגנון ששולח
 * התנצלות לפי הציון בלבד היה מתנצל בפני לקוחה מרוצה.
 *
 * ⭐ לכן השכבה הראשונה היא **פנימית**: אדם מקבל את הציון, את ההערה ואת
 * שם הנהג, ומחליט אם להרים טלפון. ההודעה ללקוח תבוא אחריה, בנוסח שמאשר
 * ולא חוקר, וכשעידן יאשר.
 *
 * 🔴 **הקובץ טהור ובלי שום ייבוא**, ולכן הוא נבדק ב-node.
 */

/** ⭐ הסף שעידן נתן: 2 ומטה. שלוש הוא מקום שאפשר לחיות איתו בלי טלפון. */
export const LOW_RATING_MAX = 2;

export interface SurveyAnswer {
  id: string;
  customerName: string | null;
  driver: string | null;
  q1: number | null;
  q2: number | null;
  comment: string | null;
  answeredAt: string | null;
  isTest: boolean | null;
  alertedAt: string | null;
}

export type SkipReason =
  | 'not_answered'
  | 'not_low'
  | 'test_row'
  | 'already_alerted';

export type AlertDecision =
  | { alert: true }
  | { alert: false; reason: SkipReason };

/**
 * האם השורה הזאת מצדיקה התרעה.
 *
 * 🔴 **הציון הקובע הוא שביעות הרצון בלבד** (`q1`), ולא ההמלצה. נמדד:
 * לקוח נתן שביעות רצון 3 והמלצה 4, כלומר שתי השאלות אינן מודדות את אותו
 * דבר, וספירה של שתיהן הייתה מרחיבה את ההתרעה בלי סיבה.
 *
 * 🔴 **ורשומות בדיקה אינן מתריעות.** שתיים משלוש התוצאות הנמוכות שהיו
 * עד היום הן בדיקות פנימיות, כלומר בלי השער הזה ההתרעה הראשונה שהצוות
 * היה מקבל הייתה על עצמו. [[demo_placeholder_makes_loop_look_closed]]
 */
export function shouldAlert(s: SurveyAnswer): AlertDecision {
  if (!s.answeredAt) return { alert: false, reason: 'not_answered' };
  if (s.isTest) return { alert: false, reason: 'test_row' };
  if (s.alertedAt) return { alert: false, reason: 'already_alerted' };
  if (s.q1 == null || s.q1 > LOW_RATING_MAX) return { alert: false, reason: 'not_low' };
  return { alert: true };
}

const esc = (v: unknown) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export interface AlertMail {
  subject: string;
  html: string;
}

/**
 * המייל עצמו.
 *
 * ⭐ **ההערה של הלקוח היא הכותרת של הגוף ולא הערת שוליים.** מי שקורא את
 * ההתרעה צריך לדעת תוך שנייה אם להרים טלפון, והמשפט שהלקוח כתב הוא
 * הדבר היחיד שבאמת עונה על זה. הציון לבדו אינו אומר כמעט כלום, כפי
 * שהמקרה של הציון 1 עם מחמאה הראה.
 *
 * 🔴 וכשאין הערה זה נאמר במפורש, ולא נשאר שדה ריק שנראה כמו תקלה.
 * [[empty_state_must_speak]]
 */
export function buildAlertMail(s: SurveyAnswer, dashboardUrl: string): AlertMail {
  const name = (s.customerName ?? '').trim() || 'לקוח';
  const comment = (s.comment ?? '').trim();
  const driver = (s.driver ?? '').trim();

  const subject = `דירוג נמוך בסקר: ${name} נתן ${s.q1} מתוך 5`;

  const html = `
<div dir="rtl" style="font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:15px;line-height:1.7;color:#14223a;max-width:560px">
  <p style="margin:0 0 4px;font-size:13px;color:#6b7a92">ר.שעל · סקר שביעות רצון</p>
  <h2 style="margin:0 0 14px;font-size:20px">${esc(name)} נתן <span style="color:#b91c1c">${esc(s.q1)}</span> מתוך 5</h2>

  <div style="background:${comment ? '#fdf6ec' : '#f4f7fb'};border:1px solid ${comment ? '#e6c893' : '#e3e9f2'};border-radius:10px;padding:14px 16px;margin:0 0 16px">
    ${
      comment
        ? `<p style="margin:0 0 4px;font-size:12px;color:#6b7a92">מה שהוא כתב</p>
           <p style="margin:0;font-size:16px;font-weight:600">${esc(comment)}</p>`
        : `<p style="margin:0;color:#6b7a92">הלקוח לא הוסיף הערה, ולכן הציון הוא כל מה שיש.</p>`
    }
  </div>

  <table style="border-collapse:collapse;font-size:14px;margin:0 0 18px">
    <tr><td style="padding:3px 0;color:#6b7a92;width:110px">שביעות רצון</td><td style="padding:3px 0;font-weight:700">${esc(s.q1)} מתוך 5</td></tr>
    <tr><td style="padding:3px 0;color:#6b7a92">ימליץ לאחרים</td><td style="padding:3px 0">${s.q2 == null ? 'לא ענה' : `${esc(s.q2)} מתוך 5`}</td></tr>
    <tr><td style="padding:3px 0;color:#6b7a92">מי ביצע</td><td style="padding:3px 0">${driver ? esc(driver) : 'לא רשום'}</td></tr>
  </table>

  <p style="margin:0 0 18px;color:#3d4d68">שיחת טלפון מכם היום שווה יותר מכל הודעה אוטומטית.</p>

  <a href="${esc(dashboardUrl)}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-weight:700;font-size:14px">פתח את מסך הסקרים</a>
</div>`.trim();

  return { subject, html };
}
