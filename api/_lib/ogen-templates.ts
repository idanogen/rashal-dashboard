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
    category: 'utility',
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

export function isTemplateKey(v: unknown): v is OgenTemplateKey {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(OGEN_TEMPLATES, v);
}

/**
 * בונה את מערך המשתנים לשליחה.
 *
 * 🔴 משתנה ריק אינו נדחה על ידי heyy. הוא פשוט מגיע ללקוח כחור בטקסט
 * ("עדכון בנוגע ל שלכם:"), ולכן החוסר נתפס כאן ולא אצל הלקוח.
 */
export function buildVariables(
  key: OgenTemplateKey,
  values: Record<string, unknown>,
): { ok: true; variables: Array<{ name: string; value: string }> } | { ok: false; missing: string[] } {
  const spec = OGEN_TEMPLATES[key];
  const variables: Array<{ name: string; value: string }> = [];
  const missing: string[] = [];

  for (const name of spec.variables) {
    const value = String(values?.[name] ?? '').trim();
    if (!value) missing.push(name);
    variables.push({ name, value });
  }

  return missing.length ? { ok: false, missing } : { ok: true, variables };
}

/** הטקסט שהלקוח יקרא, לתצוגה בחלונית ולתיעוד. אותו מילוי שהשרת שולח. */
export function renderPreview(key: OgenTemplateKey, values: Record<string, unknown>): string {
  return OGEN_TEMPLATES[key].preview.replace(/\{\{(\w+)\}\}/g, (_m, name: string) =>
    String(values?.[name] ?? '').trim() || `{${name}}`,
  );
}
