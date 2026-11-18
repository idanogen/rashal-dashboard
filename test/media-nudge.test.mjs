import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  latestNudgeByCall, canStartNudge, nudgeBlockedReason, nudgeLine, NUDGE_TOTAL,
} from '../src/lib/media-nudge.ts';

/** "שלח תזכורת לתמונה" מכרטיס אדום (עידן, 18/11/2026). */

const row = (over = {}) => ({
  service_call_id: 'c1', state: 'active', sent_count: 1, sent_1_at: '2026-11-18T08:00:00Z', sent_2_at: null,
  sent_3_at: null, next_due_at: '2026-11-19T08:00:00Z', stop_reason: null, started_by_name: 'עמי',
  created_at: '2026-11-18T08:00:00Z', ...over,
});
const day = () => '18/11';

test('הרצף האחרון לכל קריאה קובע (השורות מהחדשה לישנה)', () => {
  const m = latestNudgeByCall([row({ state: 'active' }), row({ state: 'done', sent_count: 3 })]);
  assert.equal(m.get('c1').state, 'active');
});

test('מתי הכפתור לחיץ', () => {
  const m = latestNudgeByCall([row()]);
  assert.equal(canStartNudge(m.get('c1'), 'no_response'), false, 'רצף פעיל');
  assert.equal(canStartNudge(undefined, 'no_response'), true);
  assert.equal(canStartNudge(undefined, 'failed'), false, 'לא בוואטסאפ');
  assert.equal(canStartNudge(undefined, 'no_phone'), false, 'אין נייד');
  assert.match(nudgeBlockedReason('no_phone'), /להתקשר/);
  const done = latestNudgeByCall([row({ state: 'done', sent_count: 3 })]);
  assert.equal(canStartNudge(done.get('c1'), 'no_response'), true, 'רצף שהסתיים אפשר להתחיל מחדש');
});

test('השורה על הכרטיס', () => {
  assert.equal(nudgeLine(latestNudgeByCall([row()]).get('c1'), day), `תזכורת 1 מתוך ${NUDGE_TOTAL} נשלחה 18/11`);
  assert.equal(nudgeLine(latestNudgeByCall([row({ sent_count: 0, sent_1_at: null })]).get('c1'), day), 'תזכורת לתמונה יוצאת עכשיו');
  assert.match(nudgeLine(latestNudgeByCall([row({ state: 'stopped', stop_reason: 'התקבלה תמונה' })]).get('c1'), day), /התקבלה תמונה/);
});

test('המסד: שלוש הודעות, שבת וגם שישי זזים לראשון, עצירה על תמונה', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261118_media_nudges.sql', import.meta.url), 'utf8');
  assert.match(sql, /check \(sent_count between 0 and 3\)/);
  assert.match(sql, /when 5 then .* \+ 3/);
  assert.match(sql, /when 6 then .* \+ 2/);
  assert.match(sql, /time '10:00'/);
  assert.match(sql, /'התקבלה תמונה'/);
  // ההודעה השלישית מחכה לתבנית המאושרת
  assert.match(sql, /n\.sent_count < 2 or cfg\.template_nudge_final_id is not null/);
});

test('המנוע שולח בשם שהשרת מזהה כאוטומטי (מספר מושהה מדולג)', () => {
  const fn = readFileSync(new URL('../supabase/functions/rashal-media-request/index.ts', import.meta.url), 'utf8');
  const un = readFileSync(new URL('../api/_lib/unreachable.ts', import.meta.url), 'utf8');
  assert.match(fn, /triggeredBy: `media-request-nudge-/);
  assert.match(un, /'media-request-'/);
});
