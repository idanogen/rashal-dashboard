// הדוח היומי (05/11/2026): הרינדור טהור ונבדק כאן ישירות מה-TS של ה-Edge Function (node 24 מסיר טיפוסים).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderReport, redFlags } from '../supabase/functions/rashal-daily-report/render.ts';

const quiet = {
  date: '2026-11-05',
  sync: [{ job: 'pull-core', last_success: '2026-11-05T16:55:00Z', age_min: 4, runs_today: 140, failed_today: 0, rows_today: 212, last_error: null }],
  alerts: [],
  priority: { status_writes: { done: 9 }, status_errors: 0, pushed_today: 12, failed_today: 0, parked_total: 2, queue_blocked: 1, queue_pending: 0 },
  ops: { stops: { completed: 31, not_completed: 2, planned: 1 }, by_driver: [{ driver: 'אבי', total: 8, done: 7, not_done: 1, open: 0 }], tomorrow: 29, forms_signed: { delivery: 5 }, crane_forms: 1, on_way_notified: 20, leftovers: 0 },
  wa: { in: 40, out: 55, out_failed: 0, reminders: 0, media_pending: 0 },
  app: { users_by_version: [{ version: '4c65', users: 5, names: 'אבי, אולג' }], errors: [{ name: 'registerForPush', n: 12, users: 5, sample: 'no firebase' }], stop_info_open: 60, image_shown: 14, image_load_failed: 0, actions_applied: 50, actions_rejected: 0, stuck: 0 },
  dashboard: { loads: 30, p50_s: 4.3, p95_s: 9.1, max_s: 12.0, slow_over_8s: 3, with_failures: 0, critical: 'pickups' },
  db: { db_size: '512 MB', top_mean: [{ q: 'select 1', calls: 9, mean_ms: 120, max_ms: 300 }], top_total: [] },
};

test('יום שקט: בלי דגלים, הנושא אומר תקין, רעש ידוע לא נצבע אדום', () => {
  const r = renderReport(quiet);
  assert.deepEqual(r.flags, []);
  assert.match(r.subject, /תקין/);
  assert.match(r.subject, /31 ביקורים/);
  assert.ok(r.html.includes('dir="rtl"'));
  assert.ok(r.html.includes('אין Firebase'), 'registerForPush מוסבר כידוע');
  assert.ok(r.html.includes('אבי'));
});

test('דגלים: כשל סנכרון, תמונות שלא נטענו, פעולות שנדחו, שגיאה לא מוכרת, שליפה שנכשלה בדשבורד', () => {
  const bad = structuredClone(quiet);
  bad.sync[0].failed_today = 3;
  bad.sync[0].age_min = 200;
  bad.app.image_load_failed = 2;
  bad.app.actions_rejected = 1;
  bad.app.errors.push({ name: 'TypeError', n: 5, users: 2, sample: 'x' });
  bad.dashboard.with_failures = 1;
  bad.alerts = [{ job: 'heyy-channel', state: 'alerting', since: null, detail: 'webhook disabled' }];
  const flags = redFlags(bad);
  assert.ok(flags.some((f) => f.includes('השומר מתריע')));
  assert.ok(flags.some((f) => f.includes('3 ריצות נכשלו')));
  assert.ok(flags.some((f) => f.includes('לא רצה 3 שעות')));
  assert.ok(flags.some((f) => f.includes('2 תמונות לא נטענו')));
  assert.ok(flags.some((f) => f.includes('פעולות טכנאי נדחו')));
  assert.ok(flags.some((f) => f.includes('TypeError')));
  assert.ok(flags.some((f) => f.includes('שליפה שנכשלה')));
  assert.ok(!flags.some((f) => f.includes('registerForPush')), 'רעש ידוע אינו דגל');
  const r = renderReport(bad);
  assert.match(r.subject, new RegExp(`${flags.length} דגלים`));
});

test('נתונים חסרים לא מפילים את הרינדור', () => {
  const r = renderReport({ date: '2026-11-05' });
  assert.ok(r.html.length > 500);
  assert.deepEqual(r.flags, []);
});

test('HTML מוגן: תו < בשם שגיאה לא הופך לתגית', () => {
  const r = renderReport({ ...quiet, app: { ...quiet.app, errors: [{ name: '<img onerror=x>', n: 1, users: 1, sample: null }] } });
  assert.ok(!r.html.includes('<img onerror'));
});

test('המיגרציה של הדוח קיימת עם הטבלה, הפונקציה והקרון', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261105_daily_report.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes('create table if not exists public.daily_report_log'));
  assert.ok(sql.includes('function public.daily_report_data'));
  assert.ok(sql.includes("cron.schedule('rashal-daily-report', '0 16,17 * * *'"));
});
