/**
 * הליבה הטהורה של בחירת השפה (08/09/2026): זיהוי לחיצה על כפתור שפה
 * ומילוי נוסח מתורגם. בלי שום ייבוא, ולכן נבדקת ביחידה
 * (`test/wa-lang.test.mjs`). הצד שנוגע במסד וב-heyy יושב ב-`wa-lang.ts`.
 */
export const LANGS = ['he', 'en', 'ar', 'ru', 'th'] as const;
export type Lang = (typeof LANGS)[number];

/** מה שכפתור השפה מחזיר (הכיתוב שלו), וגם קיצורים למי שמקליד. */
const LANG_WORDS: Record<string, Lang> = {
  english: 'en', en: 'en',
  'العربية': 'ar', 'عربي': 'ar', 'عربية': 'ar', ar: 'ar',
  'русский': 'ru', 'по-русски': 'ru', ru: 'ru',
  'ไทย': 'th', 'ภาษาไทย': 'th', th: 'th',
  'עברית': 'he', hebrew: 'he', he: 'he',
};

export function isLang(x: unknown): x is Lang {
  return typeof x === 'string' && (LANGS as readonly string[]).includes(x);
}

/** הודעה נכנסת שהיא בחירת שפה, ולא כלום אחר. */
export function detectLanguageReply(text: string | null | undefined): Lang | null {
  if (!text) return null;
  const t = text.trim().toLowerCase().replace(/[.!?،؟\s]+$/u, '');
  if (!t || t.length > 12) return null;
  return LANG_WORDS[t] ?? null;
}

const VAR_RE = /\{\{\s*(?:var\.)?(\w+)\s*\}\}/g;

/**
 * מילוי נוסח מתורגם. הערכים שמגיעים במשתנים הם עבריים (מטרת הביקור,
 * "טכנאי"/"נהג", יום בשבוע, "09:00 עד 13:00"), ולכן כל ערך עובר קודם
 * דרך מילון הרשימות הסגורות של השפה ('v:<ערך עברי>' → תרגום).
 */
export function renderTranslated(
  body: string,
  values: Record<string, string>,
  dict: Record<string, string>,
  lang: Lang,
): string {
  const tr = (v: string): string => {
    const s = v.trim();
    if (!s) return s;
    if (dict[`v:${s}`]) return dict[`v:${s}`];
    // "שני, 7.9.2026" → יום מתורגם + התאריך, בצורה של כל שפה.
    const m = s.match(/^(ראשון|שני|שלישי|רביעי|חמישי|שישי|שבת),?\s*(.+)$/);
    if (m && dict[`v:${m[1]}`]) {
      const wd = dict[`v:${m[1]}`];
      if (lang === 'th') return `${wd}ที่ ${m[2]}`;
      if (lang === 'ar') return `${wd} ${m[2]}`;
      return `${wd}, ${m[2]}`;
    }
    // "09:00 עד 13:00"
    // 🔴 `\b` אינו מזהה גבול מילה באותיות עבריות, ולכן רווחים מפורשים.
    if (/(^|\s)עד(\s|$)/.test(s) && dict['v:עד']) return s.replace(/\s*(^|\s)עד(\s|$)\s*/, ` ${dict['v:עד']} `);
    return s;
  };
  return body.replace(VAR_RE, (_m, name: string) => tr(values[name] ?? ''));
}

export function paramsToValues(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(raw)) {
    raw.forEach((p, i) => {
      if (p && typeof p === 'object' && 'name' in p) {
        const np = p as { name: unknown; value?: unknown };
        out[String(np.name)] = String(np.value ?? '');
      }
      else out[String(i + 1)] = String(p ?? '');
    });
  } else if (raw && typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = String(v ?? '');
  }
  return out;
}

