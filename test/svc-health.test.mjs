import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, classifyFailure, decideStream, STREAMS, TRANSIENT_THRESHOLD } from '../supabase/functions/rashal-watchdog/svc-health.ts';

// חוזה הדופק (11/11/2026): חסימה מדווחת מהריצה הראשונה, חולף רק מהשלישית, כותרת יציבה, ok סוגר.

test('חסימה: 401 מפריוריטי מדווח מהריצה הראשונה, עם הכדור אצל הלקוח', () => {
  const r = buildReport('pull-core', 'orders: HTTP 401: {"error":"Unauthorized"}', 1);
  assert.equal(r.verdict, 'fail');
  assert.equal(r.severity, 'S2');
  assert.equal(r.check, 'sync:priority-core');
  assert.match(r.detail, /הכדור אצל ר\.שעל/);
  assert.match(r.detail, /Unauthorized/);
});

test('סיווג: הרשאה וסיסמה הן חסימה, 500 ו-timeout חולפים', () => {
  assert.equal(classifyFailure('HTTP 403: Forbidden'), 'blocked');
  assert.equal(classifyFailure('Invalid password for user'), 'blocked');
  assert.equal(classifyFailure('אין הרשאה למסך'), 'blocked');
  assert.equal(classifyFailure('HTTP 502: Bad Gateway'), 'transient');
  assert.equal(classifyFailure('signal timed out'), 'transient');
  assert.equal(classifyFailure('HTTP 4010 row'), 'transient');
});

test('חולף מתחת לסף לא נשלח, ומהסף נשלח', () => {
  const err = 'pickups: HTTP 503: Service Unavailable';
  assert.equal(buildReport('pull-pickups', err, TRANSIENT_THRESHOLD - 1), null);
  const r = buildReport('pull-pickups', err, TRANSIENT_THRESHOLD);
  assert.equal(r.verdict, 'fail');
  assert.match(r.detail, /3 ריצות כושלות ברצף/);
});

test('כותרת יציבה: אותה תקלה עם פרטים שונים נותנת אותה כותרת', () => {
  const a = buildReport('push-chat', 'write call:SC2603724 HTTP 401: x', 1);
  const b = buildReport('push-chat', 'write call:SC2609999 HTTP 401: y', 1);
  assert.equal(a.title, b.title);
  assert.doesNotMatch(a.title, /\d/);
});

test('ok סוגר, עם הקצב הצפוי של הזרם', () => {
  const r = buildReport('pull-core', null, 0);
  assert.deepEqual(r, {
    system: 'rashal-dashboard', check: 'sync:priority-core', verdict: 'ok', kind: 'guard', source: 'guard',
    expected_every_minutes: 1260,
  });
});

test('כתיבת סטטוס קריאה רצה רק כשיש ממתינים: בלי קצב צפוי', () => {
  const r = buildReport('call-status-live', null, 0);
  assert.equal(r.expected_every_minutes, undefined);
});

test('job שלא מנוטר (backfill, probe) לא מדווח', () => {
  assert.equal(buildReport('backfill', null, 0), null);
  assert.equal(buildReport('call-status-dry', 'HTTP 401', 1), null);
});

test('כל זרם עם בדיקה ייחודית בתבנית sync:*', () => {
  const checks = Object.values(STREAMS).map((s) => s.check);
  assert.equal(new Set(checks).size, checks.length);
  for (const c of checks) assert.match(c, /^sync:priority-[a-z-]+$/);
});

const NOW = new Date('2026-11-11T09:05:00Z');
const SINCE = new Date(NOW.getTime() - 65 * 60000);
const run = (status, finished, err = null) => ({ job: 'pull-core', status, started_at: finished, finished_at: finished, error_summary: err });

test('הכרעה: אין ריצה חדשה בחלון = לא שולחים כלום', () => {
  assert.equal(decideStream([run('success', '2026-11-11T07:00:00Z')], SINCE), null);
  assert.equal(decideStream([], SINCE), null);
});

test('הכרעה: ריצה אחרונה מוצלחת = ok, גם אם קודמות נכשלו', () => {
  const d = decideStream([run('success', '2026-11-11T09:00:00Z'), run('error', '2026-11-11T08:55:00Z', 'x')], SINCE);
  assert.deepEqual(d, { error: null, consecutive: 0 });
});

test('הכרעה: סופרת כשלים רצופים עד ההצלחה האחרונה, partial נחשב כשל, ריצה פתוחה מדולגת', () => {
  const runs = [
    { ...run('running', null), finished_at: null },
    run('error', '2026-11-11T09:00:00Z', 'HTTP 503'),
    run('partial', '2026-11-11T08:55:00Z', 'y'),
    run('error', '2026-11-11T08:50:00Z', 'z'),
    run('success', '2026-11-11T08:45:00Z'),
    run('error', '2026-11-11T08:40:00Z', 'old'),
  ];
  assert.deepEqual(decideStream(runs, SINCE), { error: 'HTTP 503', consecutive: 3 });
});
