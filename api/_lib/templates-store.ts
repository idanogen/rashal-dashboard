import { supabaseAdmin } from './supabase-admin.js';

/**
 * מחסנית התבניות, נקראת מהטבלה `wa_templates`.
 *
 * 🔴 **היה כאן מרשם קשיח בקוד, וזו הייתה טעות תכנון.** תבנית חדשה דרשה
 * פריסה, ולכן המחסנית קפאה על שתיים בזמן שבחשבון של הלקוח היו שש.
 * הטבלה מסתנכרנת מ-heyy דרך `templates-sync.ts`, ומה שנשאר בידי מנהל
 * הוא ההחלטות בלבד: תווית, אם מוצעת לצוות, סדר והערה.
 *
 * 🔴 **המשתנים מגיעים מ-heyy ולא נגזרים מהנוסח.** בתבנית הסקר המשתנה
 * `token` יושב בכתובת של הכפתור ולא בגוף, וגזירה מהגוף הייתה מפספסת
 * אותו ושולחת ללקוח קישור שבור.
 */

export interface WaTemplate {
  key: string;
  heyyTemplateId: string;
  name: string;
  label: string;
  category: 'utility' | 'marketing';
  bodyPreview: string;
  /** כפי ש-heyy מדווחת, כולל משתנים שיושבים בכפתור ולא בגוף. */
  variables: string[];
  /** 'document' | 'video' | 'image' | 'button' | null */
  attachmentKind: string | null;
  /** מזהה הקובץ המצורף **בתוך התבנית**. נדרש בשליחה. */
  attachmentId: string | null;
  /** קובץ שכבר הועלה ל-heyy. מדיה קבועה נשלחת איתו בלי העלאה מחדש. */
  attachmentFileId: string | null;
  /**
   * 🔴 המדיה משתנה בין נמענים, והקובץ ששמור בתבנית הוא **דוגמה בלבד**.
   * בלי ההבחנה הזאת תעודת הדוגמה שהוגשה למטא הייתה נשלחת ללקוח אמיתי.
   */
  mediaPerMessage: boolean;
  heyyStatus: string | null;
}

interface Row {
  key: string;
  heyy_template_id: string;
  name: string;
  label: string;
  category: string;
  body_preview: string;
  variables: string[] | null;
  attachment_kind: string | null;
  attachment_id: string | null;
  attachment_file_id: string | null;
  media_per_message: boolean | null;
  heyy_status: string | null;
}

function toTemplate(r: Row): WaTemplate {
  return {
    key: r.key,
    heyyTemplateId: r.heyy_template_id,
    name: r.name,
    label: r.label,
    category: r.category === 'marketing' ? 'marketing' : 'utility',
    bodyPreview: r.body_preview,
    variables: Array.isArray(r.variables) ? r.variables : [],
    attachmentKind: r.attachment_kind,
    attachmentId: r.attachment_id,
    attachmentFileId: r.attachment_file_id,
    mediaPerMessage: Boolean(r.media_per_message),
    heyyStatus: r.heyy_status,
  };
}

const COLS =
  'key, heyy_template_id, name, label, category, body_preview, variables, ' +
  'attachment_kind, attachment_id, attachment_file_id, media_per_message, heyy_status';

/** כל התבניות הפעילות, בסדר התצוגה. */
export async function listActiveTemplates(): Promise<WaTemplate[]> {
  const { data, error } = await supabaseAdmin
    .from('wa_templates')
    .select(COLS)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('label', { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => toTemplate(r as unknown as Row));
}

/**
 * תבנית אחת לפי מפתח.
 *
 * 🔴 מוגבלת ל-`active` בכוונה. תבנית שכובתה היא תבנית שהוחלט שלא שולחים
 * בה יותר, ולשונית ישנה שנשארה פתוחה לא אמורה להצליח לשלוח דרכה.
 */
export async function getTemplate(key: string): Promise<WaTemplate | null> {
  if (!key) return null;
  const { data, error } = await supabaseAdmin
    .from('wa_templates')
    .select(COLS)
    .eq('key', key)
    .eq('active', true)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? toTemplate(data as unknown as Row) : null;
}

export interface BuiltVariables {
  variables: Record<string, string>;
  /** שמות המשתנים שנשארו ריקים. */
  missing: string[];
}

/**
 * בונה את מערך המשתנים לשליחה.
 *
 * 🔴 משתנה ריק אינו נדחה על ידי heyy. הוא מגיע ללקוח כחור בטקסט
 * ("עדכון בנוגע ל שלכם:"), ולכן החוסר נתפס כאן ולא אצל הלקוח.
 *
 * 🔴 מחזיר מבנה אחד שטוח ולא איחוד מבדיל, כי הבנייה של פונקציות Vercel
 * רצה **בלי `strict`** ושם צמצום לפי `if (r.ok)` נכשל בקומפילציה.
 *
 * 🔴 ומחזיר **אובייקט שטוח `{שם: ערך}`**, כי זה מה ש-v3 מצפה לו. ב-v2.0
 * זה היה מערך `[{name, value}]`, ושתי הגרסאות חיות אצלנו במקביל.
 */
export function buildVariables(t: WaTemplate, values: Record<string, unknown>): BuiltVariables {
  const variables: Record<string, string> = {};
  const missing: string[] = [];

  for (const name of t.variables) {
    const value = String(values?.[name] ?? '').trim();
    if (!value) missing.push(name);
    variables[name] = value;
  }
  return { variables, missing };
}

/**
 * הטקסט שהלקוח יקרא. אותו מילוי שהחלונית הציגה.
 *
 * 🔴 **התחביר של heyy הוא `{{var.name}}` ולא `{{name}}`.** זה התגלה רק
 * כשהנוסח הגיע מהסנכרון במקום מהקלדה ידנית: ביטוי שתופס `\w+` בלבד לא
 * מתאים לנקודה, ולכן שום ערך לא היה מוחלף והלקוח היה מקבל את שם המשתנה
 * כטקסט. שתי הצורות נתמכות כאן, כי ידני וישן עדיין קיימים.
 */
const VAR_RE = /\{\{\s*(?:var\.)?(\w+)\s*\}\}/g;

export function renderPreview(t: WaTemplate, values: Record<string, unknown>): string {
  return t.bodyPreview.replace(VAR_RE, (_m, name: string) =>
    String(values?.[name] ?? '').trim() || `{${name}}`,
  );
}
