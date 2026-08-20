/**
 * מרשם התבניות של החלונית בפריוריטי. **זה מקור האמת.**
 *
 * 🔴 קיים עותק קדמי ב-`src/lib/heyy/ogen-templates.ts`, כי הבנייה של
 * `api/` ושל `src/` מופרדות (`tsconfig.api.json` כולל רק `api`).
 * **הטסט `test/template-registry-parity.test.mjs` נועל את השניים.**
 * שני מרשמים שמתפצלים בשקט = החלונית מציגה תבנית אחת והשרת שולח אחרת.
 *
 * 🔴 **החלונית שולחת `templateKey`, לעולם לא מזהה תבנית.** מזהה שמגיע
 * מהדפדפן פירושו שכל מי שמחזיק טוקן יכול לשלוח כל תבנית שקיימת בחשבון
 * של הלקוח, כולל תבניות שיווק. השרת הוא זה שמתרגם מפתח למזהה.
 */

export type OgenTemplateKey = 'service_update' | 'send_document';

export interface OgenTemplate {
  id: string;
  name: string;
  label: string;
  category: 'utility' | 'marketing';
  variables: string[];
  hasDocumentHeader: boolean;
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

export function isTemplateKey(v: unknown): v is OgenTemplateKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(OGEN_TEMPLATES, v);
}

/**
 * בונה את מערך המשתנים לשליחה.
 *
 * 🔴 משתנה ריק אינו נדחה על ידי heyy. הוא פשוט מגיע ללקוח כחור בטקסט
 * ("עדכון בנוגע ל שלכם:"), ולכן החוסר נתפס כאן ולא אצל הלקוח.
 */
export interface BuiltVariables {
  ok: boolean;
  variables: Array<{ name: string; value: string }>;
  /** שמות המשתנים שנשארו ריקים. ריק כש-`ok`. */
  missing: string[];
}

/**
 * בונה את מערך המשתנים לשליחה.
 *
 * 🔴 משתנה ריק אינו נדחה על ידי heyy. הוא פשוט מגיע ללקוח כחור בטקסט
 * ("עדכון בנוגע ל שלכם:"), ולכן החוסר נתפס כאן ולא אצל הלקוח.
 *
 * 🔴 **מחזיר מבנה אחד ולא איחוד מבדיל.** הבנייה של פונקציות Vercel רצה
 * **בלי `strict`**, ושם צמצום לפי `if (r.ok)` לא עובד והקומפיילר נופל על
 * `Property 'missing' does not exist`. זו מלכודת מוכרת בפרויקט הזה
 * (ראה `api/admin-users.ts`), ו-`tsc` המקומי לא תופס אותה כי הוא כן strict.
 */
export function buildVariables(
  key: OgenTemplateKey,
  values: Record<string, unknown>,
): BuiltVariables {
  const spec = OGEN_TEMPLATES[key];
  const variables: Array<{ name: string; value: string }> = [];
  const missing: string[] = [];

  for (const name of spec.variables) {
    const value = String(values?.[name] ?? '').trim();
    if (!value) missing.push(name);
    variables.push({ name, value });
  }

  return { ok: missing.length === 0, variables, missing };
}

/** הטקסט שהלקוח יקרא, לתצוגה בחלונית ולתיעוד. אותו מילוי שהשרת שולח. */
export function renderPreview(key: OgenTemplateKey, values: Record<string, unknown>): string {
  return OGEN_TEMPLATES[key].preview.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
    String(values?.[name] ?? '').trim() || `{${name}}`,
  );
}
