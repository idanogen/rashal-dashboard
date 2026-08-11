/**
 * מצב הדגמה לוואטסאפ.
 *
 * מטרה: להראות בפגישה שהודעה **באמת** נשלחת, לפני ששתי התבניות האמיתיות
 * (driver_stop_alert · driver_on_the_way) אושרו על ידי מטא.
 *
 * הפתרון: משתמשים בתבנית "בדיקה" שכבר מאושרת בחשבון של רשעל. היא נושאת
 * טקסט קבוע ואין בה משתנים, אז היא לא יכולה להעביר את פרטי הלקוח — אבל היא
 * מוכיחה שהצינור פתוח מקצה לקצה.
 *
 * 🔴 ולכן גם קיימת רשימת ההיתר. תבנית שכתוב בה "זאת הודעת בדיקה" **אסור**
 * שתגיע ללקוח אמיתי. בפגישה מחר ארבע העצירות של רודי הן לקוחות אמיתיים,
 * ובלי החסימה הזו הדגמה אחת של "בדרך אליך" הייתה שולחת להם שטות.
 *
 * כשהתבניות האמיתיות יאושרו: להחליף את שני הקבועים ב-UUID שלהן, ולכבות
 * את `WHATSAPP_DEMO_MODE`. אז רשימת ההיתר מפסיקה לחסום.
 */

export const WHATSAPP_DEMO_MODE = true;

/** התבנית המאושרת "בדיקה" בחשבון של רשעל. טקסט קבוע, בלי משתנים. */
export const DEMO_TEMPLATE_ID = '3ace2306-d29c-4158-94cc-e65cd1e31e85';

/**
 * המספרים היחידים שמותר לשלוח אליהם במצב הדגמה.
 * הוספת נמען לבדיקה = שורה כאן.
 */
export const DEMO_ALLOWED_NUMBERS = [
  '+972523694547', // עידן
  '+972584847477', // עמי
];

function digitsOnly(phone: string): string {
  return String(phone).replace(/\D/g, '');
}

/** השוואה סלחנית: 0523694547 · 972523694547 · +972-52-369-4547 כולם זהים. */
export function isDemoAllowed(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const d = digitsOnly(phone);
  const normalized = d.startsWith('972') ? d : d.startsWith('0') ? '972' + d.slice(1) : d;
  return DEMO_ALLOWED_NUMBERS.some((allowed) => digitsOnly(allowed) === normalized);
}

export interface DemoSendDecision {
  /** לשלוח או לא. */
  send: boolean;
  /** התבנית שתשמש בפועל. */
  templateId: string;
  /** משתנים — ריק במצב הדגמה, כי לתבנית "בדיקה" אין. */
  variables: Array<{ name: string; value: string }>;
  /** למה נחסם, להצגה לנהג. */
  blockedReason?: string;
}

/**
 * מחליט מה לשלוח בפועל. הקורא לא צריך לדעת אם אנחנו במצב הדגמה או לא.
 */
export function decideSend(
  realTemplateId: string,
  realVariables: Array<{ name: string; value: string }>,
  recipientPhone: string | undefined | null,
): DemoSendDecision {
  if (!WHATSAPP_DEMO_MODE) {
    return { send: true, templateId: realTemplateId, variables: realVariables };
  }
  if (!isDemoAllowed(recipientPhone)) {
    return {
      send: false,
      templateId: DEMO_TEMPLATE_ID,
      variables: [],
      blockedReason: 'מצב הדגמה: שליחה מותרת רק למספרי בדיקה',
    };
  }
  return { send: true, templateId: DEMO_TEMPLATE_ID, variables: [] };
}
