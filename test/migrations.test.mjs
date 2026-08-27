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

/**
 * 🔴🔴 **לכל טבלה שהקוד קורא לה יש קובץ מיגרציה שיוצר אותה.**
 *
 * נשך ב-27/08/2026: `crane_forms` הוחלה במסד דרך הכלי ו**מעולם לא
 * נשמרה כקובץ**. הקוד עבד מצוין, הבדיקות עברו, והמאגר פשוט הפסיק לתאר
 * את הסכימה. סביבה חדשה שהייתה נבנית מהמיגרציות הייתה חסרה טבלה שלמה,
 * ואיש לא היה יודע עד לרגע הראשון של שמירת טופס.
 *
 * ⭐ הבדיקה סורקת `supabase.from('X')` בקוד ומחפשת `create table` תואם.
 */
test('🔴🔴 כל טבלה שהקוד ניגש אליה נוצרת באיזשהו קובץ מיגרציה', () => {
  const roots = [join(here, '..', 'src'), join(here, '..', 'api')];
  const files = [];
  const walk = (p) => {
    for (const e of readdirSync(p, { withFileTypes: true })) {
      const full = join(p, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name)) files.push(full);
    }
  };
  for (const r of roots) walk(r);

  const used = new Set();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\.from\(\s*['"]([a-z0-9_]+)['"]/g)) {
      used.add(m[1]);
    }
  }

  const created = new Set();
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
    const body = readFileSync(join(dir, f), 'utf8');
    // ⭐ גם `materialized view`: מבחינת הקוד שקורא ממנה היא טבלה לכל דבר.
    const RE = /create\s+(?:table|(?:materialized\s+)?view)\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-z0-9_]+)/gi;
    for (const m of body.matchAll(RE)) {
      created.add(m[1].toLowerCase());
    }
  }

  // ⭐ טבלאות שנולדו לפני שהמאגר החזיק מיגרציות בכלל, ולכן אין להן קובץ
  // ומעולם לא היה. הרשימה סגורה בכוונה: כל טבלה חדשה חייבת קובץ.
  const LEGACY = new Set([
    'orders', 'service_calls', 'routes', 'order_documents', 'profiles',
    'calendar_stops', 'cranes', 'crane_inspections', 'crane_sync_history',
    'timeline_events', 'priority_customers', 'pickups', 'delivery_notes',
    'invoices', 'consolidated_invoices', 'sync_state', 'sync_runs',
    'sync_events', 'sync_alerts', 'sync_debug', 'reconcile_runs',
    'whatsapp_messages_outbound', 'whatsapp_messages_inbound',
  ]);

  const missing = [...used].filter((t) => !created.has(t) && !LEGACY.has(t)).sort();
  assert.deepEqual(
    missing,
    [],
    '🔴 טבלה שהקוד קורא לה ואין קובץ מיגרציה שיוצר אותה. סביבה חדשה תיבנה בלעדיה.',
  );
});
