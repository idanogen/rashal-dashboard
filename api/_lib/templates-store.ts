import { supabaseAdmin } from './supabase-admin.js';

/**
 * מחסנית התבניות, נקראת מהטבלה `wa_templates`.
 *
 * 🔴 **היה כאן מרשם קשיח בקוד, וזו הייתה טעות תכנון.** תבנית חדשה דרשה
 * פריסה, ולכן המחסנית קפאה על שתי תבניות בזמן שבחשבון של הלקוח היו שש.
 * ל-heyy אין API לתבניות (נבדק: ארבעה נתיבים מחזירים 404), אז ממילא אי
 * אפשר למשוך את הרשימה משם. הטבלה היא המקום היחיד, ומנהל מוסיף שורה.
 *
 * ⭐ **המשתנים נגזרים מהנוסח.** אין שדה נפרד שמונה אותם. שני שדות
 * שמתארים את אותו דבר מתפצלים בשקט, ואז החלונית מבקשת שדה שהתבנית לא
 * מכירה, heyy לא מתלוננת, והערך מגיע ללקוח כחור בטקסט.
 */

export interface WaTemplate {
  key: string;
  heyyTemplateId: string;
  name: string;
  label: string;
  category: 'utility' | 'marketing';
  bodyPreview: string;
  hasDocumentHeader: boolean;
  /** נגזר מ-`bodyPreview`, לפי סדר ההופעה, בלי כפילויות. */
  variables: string[];
}

/** שולף את שמות המשתנים מתוך הנוסח, לפי סדר ההופעה. */
export function variablesOf(bodyPreview: string): string[] {
  const seen: string[] = [];
  for (const m of String(bodyPreview ?? '').matchAll(/\{\{(\w+)\}\}/g)) {
    if (!seen.includes(m[1])) seen.push(m[1]);
  }
  return seen;
}

interface Row {
  key: string;
  heyy_template_id: string;
  name: string;
  label: string;
  category: string;
  body_preview: string;
  has_document_header: boolean;
}

function toTemplate(r: Row): WaTemplate {
  return {
    key: r.key,
    heyyTemplateId: r.heyy_template_id,
    name: r.name,
    label: r.label,
    category: r.category === 'marketing' ? 'marketing' : 'utility',
    bodyPreview: r.body_preview,
    hasDocumentHeader: Boolean(r.has_document_header),
    variables: variablesOf(r.body_preview),
  };
}

const COLS = 'key, heyy_template_id, name, label, category, body_preview, has_document_header';

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
  variables: Array<{ name: string; value: string }>;
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
 */
export function buildVariables(t: WaTemplate, values: Record<string, unknown>): BuiltVariables {
  const variables: Array<{ name: string; value: string }> = [];
  const missing: string[] = [];

  for (const name of t.variables) {
    const value = String(values?.[name] ?? '').trim();
    if (!value) missing.push(name);
    variables.push({ name, value });
  }
  return { variables, missing };
}

/** הטקסט שהלקוח יקרא. אותו מילוי שהחלונית הציגה. */
export function renderPreview(t: WaTemplate, values: Record<string, unknown>): string {
  return t.bodyPreview.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
    String(values?.[name] ?? '').trim() || `{${name}}`,
  );
}
