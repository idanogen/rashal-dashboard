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

/**
 * 04/11/2026: "בוצע" מנקה סיבת "לא בוצע" קודמת בשני הכותבים. יאמן סלאח: אתמול
 * "טכנאי לא עבד", היום בוצע במלואו, והכרטיס עדיין הציג את הסיבה הישנה.
 */
const lib = readFileSync(new URL('../src/lib/calendar-stops.ts', import.meta.url), 'utf8');

test('🔴 "בוצע" כותב הערה וסוג סגירה תמיד, גם null, בדשבורד ובמסד', () => {
  assert.ok(lib.includes("row.resolution_note = notes ?? null;"), 'דשבורד: ההערה נכתבת תמיד');
  assert.ok(lib.includes("row.resolution_kind = status === 'not_completed' ? (kind ?? 'not_done') : null;"), 'דשבורד: הסוג מתאפס על בוצע');
  assert.ok(sql.includes("resolution_note = p_note,"), 'מסד: ההערה נכתבת תמיד');
  assert.ok(sql.includes("resolution_kind = v_kind"), 'מסד: הסוג מ-v_kind (null על בוצע)');
  assert.ok(sql.includes("v_kind := case when p_status = 'not_completed' then coalesce(p_resolution_kind, 'not_done') end;"));
});

test('🔴 העברה ליום אחר מנקה את סיבת הסגירה של הסיבוב הקודם', () => {
  const fn = lib.slice(lib.indexOf('export async function moveStopToNewDay'));
  const body = fn.slice(0, fn.indexOf('.eq(\'id\', stopId)'));
  assert.ok(body.includes("resolution_note: null,"), 'ההערה מתנקה');
  assert.ok(body.includes("resolution_kind: null,"), 'הסוג מתנקה');
});
