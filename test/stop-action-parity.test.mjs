import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 28/10/2026: מחרוזות הסטטוס של המקור חיות בשני מקומות בכוונה: בדשבורד
 * (`stop-source-sync.ts`, המשרד) ובמסד (`stop_action_apply`, האפליקציה).
 * הבדיקה קוראת את שני קבצי המקור האמיתיים, לא עותק מודבק.
 */
const ts = readFileSync(new URL('../src/lib/stop-source-sync.ts', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/20261028_stop_actions.sql', import.meta.url), 'utf8');

const EXPECTED = {
  delivery: { done: 'סופק', waiting: 'ממתין לתאום' },
  service: { done: 'בוצע', waiting: 'קריאה חדשה' },
  pickup: { done: 'נאסף', waiting: 'ממתין לתאום' },
};

test('מחרוזות הסטטוס של המקור זהות בדשבורד ובפונקציה במסד', () => {
  for (const [source, states] of Object.entries(EXPECTED)) {
    const line = ts.split('\n').find((l) => l.trim().startsWith(`${source}:`));
    assert.ok(line, `stop-source-sync.ts: אין שורה ל-${source}`);
    for (const [state, value] of Object.entries(states)) {
      assert.ok(line.includes(`${state}: '${value}'`), `דשבורד ${source}.${state} = ${value}`);
      assert.ok(sql.includes(`'${value}'`), `מסד: חסר '${value}'`);
    }
  }
  // הפונקציה במסד בוחרת done ל-completed ו-waiting אחרת, לכל אחד משלושת המקורות.
  assert.equal((sql.match(/when p_status = 'completed' then '/g) ?? []).length, 3);
});

test('הפונקציה דוחה חזרה ולא זורקת על עצירה שבוטלה או נסגרה', () => {
  assert.ok(sql.includes("select * into v_prev from public.stop_actions where action_id = p_action_id"));
  for (const reason of ['not_yours', 'cancelled', 'already_resolved', 'stop_not_found']) {
    assert.ok(sql.includes(`'${reason}'`), reason);
  }
  assert.ok(sql.includes("exception when others then"), 'טריגר חוסם נרשם כדחייה');
});
