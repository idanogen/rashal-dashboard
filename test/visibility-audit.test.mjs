import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DATA_WINDOW_DAYS,
  ORDER_CLOSED,
  CALL_CLOSED,
  PICKUP_CLOSED,
  BUSINESS_FLOOR_DATE,
} from '../src/lib/constants.ts';

/**
 * 🔴 גלאי התצוגה (visibility_audit במסד) משחזר את מסנני הטעינה של המסך.
 * הקבועים חיים בשני צדדים — constants.ts בדפדפן והמיגרציה במסד — וסטייה
 * ביניהם הופכת את הגלאי לשקרן: הוא יכריז "נקי" על רשומות שהמסך באמת מפיל,
 * או יצפצף על רשומות שמוצגות. כמו test/aging.test.mjs, הבדיקה קוראת את
 * קובץ המיגרציה עצמו ומוודאת שהם זהים.
 */

const sql = readFileSync(
  new URL('../supabase/migrations/20260830_visibility_audit.sql', import.meta.url),
  'utf8',
);

test('חלון הנתונים במיגרציה זהה ל-DATA_WINDOW_DAYS', () => {
  assert.match(sql, new RegExp(`interval '${DATA_WINDOW_DAYS} days'`));
});

test('רצפת האיסופים במיגרציה זהה ל-BUSINESS_FLOOR_DATE', () => {
  assert.ok(sql.includes(`>= '${BUSINESS_FLOOR_DATE}'`), 'רצפת התאריך העסקי לא תואמת');
});

test('רשימות הסגורים במיגרציה זהות לרשימות של המסך', () => {
  const inList = (list) => `not in (${[...list].map((s) => `'${s}'`).join(',')})`;
  assert.ok(sql.includes(inList(ORDER_CLOSED)), 'ORDER_CLOSED לא תואם');
  assert.ok(sql.includes(inList(CALL_CLOSED)), 'CALL_CLOSED לא תואם');
  assert.ok(sql.includes(inList(PICKUP_CLOSED)), 'PICKUP_CLOSED לא תואם');
});

test('הפונקציה נעולה: ההרשאות נשללות מ-anon ומ-authenticated', () => {
  assert.match(sql, /revoke all on function public\.visibility_audit\(\) from public, anon, authenticated/);
});

test('שלושת סוגי הממצאים קיימים בשאילתה', () => {
  for (const reason of ['not_loaded', 'null_status', 'hidden_dup']) {
    assert.ok(sql.includes(`'${reason}'`), `חסר סוג ממצא: ${reason}`);
  }
});
