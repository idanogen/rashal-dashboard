/**
 * מחסנית התבניות של החלונית בפריוריטי.
 *
 * ⭐ אלה תבניות שנוצרו ב-20/08/2026 עבור ערוץ "ר.שעל שירותי עזר לנכים",
 * והן מה שהחלונית שולחת כשחלון 24 השעות סגור.
 *
 * 🔴 **אין ל-heyy API לתבניות.** נבדק חי: ארבעה נתיבים
 * (`message_templates` · `whatsapp_message_templates` · `templates` ·
 * `whatsapp_templates`) מחזירים 404. המזהים למטה נשלפו מכתובת ה-URL של
 * התבנית בממשק, וזו הדרך היחידה להשיג אותם.
 *
 * 🔴 **המשתנים הם לפי שם ולא לפי מיקום**, והשם חייב להתאים תו בתו למה
 * שהוגדר בעורך. שם שגוי מחזיר ערך ריק אצל הלקוח בלי שום שגיאה.
 */

export type OgenTemplateKey = 'service_update' | 'send_document';

export interface OgenTemplate {
  id: string;
  name: string;
  /** התווית שרואים בחלונית. */
  label: string;
  /** קטגוריית מטא. שירות זול יותר ולא כפוף להסכמת שיווק. */
  category: 'utility' | 'marketing';
  /** שמות המשתנים, לפי הסדר שבו הם מופיעים בגוף. */
  variables: string[];
  /** האם התבנית נושאת קובץ בכותרת. */
  hasDocumentHeader: boolean;
  /** הנוסח, לתצוגה מקדימה בלבד. הטקסט האמיתי חי אצל מטא. */
  preview: string;
}

export const OGEN_TEMPLATES: Record<OgenTemplateKey, OgenTemplate> = {
  service_update: {
    id: 'e42a2229-1dca-435b-b774-a4c7be5effc5',
    name: 'ogen_service_update',
    label: 'עדכון ללקוח',
    // 🔴 מטא סיווגה גם אותה **שיווק**, למרות הניסוח שנצמד לעסקה.
    // ראה ההערה על הסיווג בתחתית הקובץ.
    category: 'marketing',
    variables: ['customer_name', 'subject', 'details'],
    hasDocumentHeader: false,
    preview:
      'שלום {{customer_name}}, כאן ר.שעל בע"מ.\n' +
      'עדכון בנוגע ל{{subject}} שלכם: {{details}}\n' +
      'אפשר להשיב להודעה הזאת ונמשיך מכאן.',
  },
  send_document: {
    id: '3977364c-2ade-48e6-8d1d-367a88579cbe',
    name: 'ogen_send_document',
    label: 'שליחת מסמך',
    category: 'utility',
    variables: ['customer_name', 'doc_type', 'doc_number'],
    hasDocumentHeader: true,
    preview:
      'שלום {{customer_name}}, מצורפת {{doc_type}} מספר {{doc_number}} ' +
      'של ר.שעל בע"מ. לשאלות אפשר להשיב להודעה הזאת.',
  },
};

/**
 * 🔴 `ogen_open_conversation` (12:19) קיימת ומאושרת, אבל **מטא סיווגה אותה
 * שיווק** ולכן היא לא נמצאת כאן. הסיבה: הגוף שלה היה גנרי מדי
 * ("בנוגע ל{נושא}: {פרטים}"), ומטא מסווגת לפי כמה הטקסט נצמד לעסקה.
 * `ogen_service_update` היא אותה כוונה בניסוח שנצמד לעסקה
 * ("עדכון בנוגע ל... שלכם"), והיא אכן סווגה שירות.
 *
 * הודעת שיווק יקרה יותר, כפופה להסכמת הנמען ולמכסות פר-לקוח, ולכן אסור
 * שתשמש לפתיחת שיחת שירות. **כשה-service_update תאושר, לכבות אותה ב-heyy.**
 */
export const DEPRECATED_MARKETING_TEMPLATE = 'ogen_open_conversation';

/** בונה את מערך המשתנים לשליחה, בשמות שהעורך של heyy מכיר. */
/**
 * 🔴🔴 **הסיווג של מטא נקבע באישור, לא בהגשה. וגוף עם טקסט חופשי יוצא שיווק.**
 *
 * נמדד על שלוש תבניות באותו יום (20/08/2026):
 *
 * | תבנית | גוף | בהגשה | אחרי אישור |
 * |---|---|---|---|
 * | `ogen_open_conversation` | "בנוגע ל{נושא}: {פרטים}" | שיווק | שיווק |
 * | `ogen_service_update` | "עדכון בנוגע ל{נושא} שלכם: {פרטים}" | **שירות** | **שיווק** |
 * | `ogen_send_document` | "מצורפת {סוג} מספר {מספר}" | שירות | **שירות** |
 *
 * ⭐ **המסקנה, ושווה לכל תבנית שנכתוב מכאן:** זה לא הניסוח ולא המילים
 * "עדכון" ו"שלכם". מה שקובע הוא **האם לתבנית יש חריץ לתוכן חופשי**.
 * תבנית שיכולה לשאת כל טקסט היא מבחינת מטא מוצר דיוור, ולא משנה איך
 * עוטפים אותה. `ogen_send_document` נשארה שירות כי כל משתנה בה מוגבל
 * (סוג מסמך, מספר מסמך), ואין בה מקום לפרוזה.
 *
 * 🔴 **המחיר של שיווק:** תעריף גבוה יותר, כפיפות להסכמת הנמען ולמכסות
 * פר-לקוח, ואפשרות שמטא תחסום אותה למי שביקש לא לקבל דיוור.
 *
 * **הדרך לתבנית פתיחה בקטגוריית שירות: לוותר על החריץ החופשי** ולבנות
 * כמה תבניות צרות, שכל משתנה בהן הוא ערך מובנה (מספר מסמך, תאריך, שעה).
 */

export function buildVariables(
  key: OgenTemplateKey,
  values: Record<string, string>,
): Array<{ name: string; value: string }> {
  return OGEN_TEMPLATES[key].variables.map((name) => ({
    name,
    value: values[name] ?? '',
  }));
}
