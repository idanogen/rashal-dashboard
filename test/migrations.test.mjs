import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

/**
 * 🔴🔴 **פונקציה מוגדרת בקובץ מיגרציה אחד בלבד.**
 *
 * נשך באמת ב-25/08/2026. `customer_card` הייתה כתובה בשני קבצים,
 * ובאמצע עבודה על דירוג החיפוש הרצתי מחדש את הקובץ הישן. הפונקציה
 * חזרה לגרסה קודמת, **"מה יש אצל הלקוח" חזר ריק לכל לקוח במערכת**,
 * ולא הייתה שום שגיאה: הפריסה עברה, הבדיקות עברו, והמסך פשוט אמר
 * "לא רשום אצלנו ציוד". עידן מצא את זה, לא אני.
 *
 * ⭐ **הבדיקה סטטית בכוונה.** היא קוראת קבצים ולא נוגעת במסד, ולכן
 * היא רצה בכל בנייה ולא תלויה בסביבה.
 */

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, '..', 'supabase', 'migrations');

/** `create [or replace] function public.name(` → שם הפונקציה. */
const DEF = /create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-z0-9_]+)\s*\(/gi;

test('🔴🔴 אין פונקציה שמוגדרת בשני קבצי מיגרציה', () => {
  const where = new Map();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
    const body = readFileSync(join(dir, f), 'utf8');
    // 🔴 בלי שורות הערה, אחרת אזכור בתיעוד נספר כהגדרה.
    const code = body.split('\n').filter((l) => !l.trimStart().startsWith('--')).join('\n');
    const seen = new Set();
    for (const m of code.matchAll(DEF)) seen.add(m[1].toLowerCase());
    for (const name of seen) {
      if (!where.has(name)) where.set(name, []);
      where.get(name).push(f);
    }
  }
  const dupes = [...where.entries()].filter(([, files]) => files.length > 1);
  assert.deepEqual(
    dupes.map(([n, f]) => `${n}: ${f.join(' + ')}`),
    [],
    '🔴 פונקציה מוגדרת ביותר מקובץ אחד. הרצה מחדש של הקובץ הישן תחזיר גרסה קודמת בלי שום שגיאה.',
  );
});

test('⭐ הבדיקה באמת סורקת ומוצאת הגדרות', () => {
  // 🔴 בקרה חיובית: בדיקה שמחזירה "אין כפילויות" מפני שהיא לא מצאה
  // כלום נראית בדיוק כמו בדיקה שעברה. [[silence_needs_a_positive_control]]
  let found = 0;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
    const body = readFileSync(join(dir, f), 'utf8');
    found += [...body.matchAll(DEF)].length;
  }
  assert.ok(found >= 15, `נמצאו רק ${found} הגדרות פונקציה, הסריקה כנראה שבורה`);
});
