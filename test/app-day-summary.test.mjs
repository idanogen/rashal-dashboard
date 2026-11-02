import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agoLabel, blockReasonLabel, sortUsers, unexpectedErrors, userFlag } from '../src/lib/app-day-summary.ts';

/** "מי נתקע היום" (02/11/2026, שלב 3 בתוכנית הלוגים). */

const user = (over = {}) => ({
  name: 'אבי', role: 'driver', app: 'driver', version: 'f52e', device: 'android 36',
  first_seen: '2026-11-02T06:00:00Z', last_seen: '2026-11-02T08:00:00Z',
  sessions: 1, screens: 3, errors: 0, crashes: 0, rejected: 0, image_errors: 0,
  forms_opened: 0, forms_blocked: 0, forms_cancelled: 0, forms_saved: 0, forms_failed: 0, forms_sent: 0,
  problems: 0, error_names: {}, ...over,
});

test('שגיאה צפויה (התראות דחיפה) לא צובעת את המשתמש, שגיאה אחרת כן', () => {
  assert.equal(userFlag(user({ errors: 1, error_names: { registerForPush: 1 } })), 'ok');
  assert.equal(unexpectedErrors(user({ errors: 3, error_names: { registerForPush: 1, queue: 2 } })), 2);
  assert.equal(userFlag(user({ errors: 2, error_names: { queue: 2 } })), 'amber');
});

test('דיווח, קריסה, שמירה שנכשלה ודחייה הם אדום; חסימה וביטול בטופס כתום', () => {
  for (const k of ['problems', 'crashes', 'forms_failed', 'rejected']) assert.equal(userFlag(user({ [k]: 1 })), 'red', k);
  for (const k of ['forms_blocked', 'forms_cancelled', 'image_errors']) assert.equal(userFlag(user({ [k]: 1 })), 'amber', k);
});

test('הסדר: אדום, כתום, תקין, ובתוך כל צבע האחרון שנראה קודם', () => {
  const list = sortUsers([
    user({ name: 'a', last_seen: '2026-11-02T09:00:00Z' }),
    user({ name: 'b', forms_blocked: 1 }),
    user({ name: 'c', problems: 1, last_seen: '2026-11-02T07:00:00Z' }),
    user({ name: 'd', last_seen: '2026-11-02T10:00:00Z' }),
  ]);
  assert.deepEqual(list.map((u) => u.name), ['c', 'b', 'd', 'a']);
});

test('תוויות: סיבת חסימה מוכרת בעברית, לא מוכרת כמו שהיא; זמן יחסי', () => {
  assert.equal(blockReasonLabel('missing_signature'), 'חתימה חסרה');
  assert.equal(blockReasonLabel('xyz'), 'xyz');
  assert.equal(agoLabel(20_000), 'עכשיו');
  assert.equal(agoLabel(5 * 60_000), 'לפני 5 דק׳');
  assert.equal(agoLabel(3 * 3600_000), 'לפני 3 שע׳');
});

test('כל מונה שהמסך קורא קיים בפונקציה במסד', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261102_app_day_summary.sql', import.meta.url), 'utf8');
  for (const col of ['problems', 'crashes', 'forms_failed', 'rejected', 'forms_blocked', 'forms_cancelled', 'image_errors', 'error_names', 'silent']) {
    assert.match(sql, new RegExp(`\\b${col}\\b`), col);
  }
});
