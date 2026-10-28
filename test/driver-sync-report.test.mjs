import test from 'node:test';
import assert from 'node:assert/strict';
import { describeSyncReport } from '../src/lib/driver-sync.ts';
import { stuckReports } from '../supabase/functions/rashal-watchdog/stuck-actions-check.ts';

const now = new Date('2026-10-28T09:00:00Z');
const base = { profile_id: 'p', driver_name: 'רודי', device: 'android', app_label: '63f7', pending: 0, rejected: 0, oldest_pending_at: null, online: true };

test('שורת הנהג במסך הצוות', () => {
  assert.equal(describeSyncReport(undefined).text, 'עוד לא דיווח');
  const r = describeSyncReport({ ...base, last_sync_at: '2026-10-28T08:35:00Z', pending: 2, online: false }, now);
  assert.equal(r.text, 'דיווח לפני 25 דק׳ · 2 ממתינות · 📵 בלי קליטה · גרסה 63f7');
  assert.equal(r.tone, 'warn');
  const stuck = describeSyncReport({ ...base, last_sync_at: '2026-10-28T08:55:00Z', pending: 1, oldest_pending_at: '2026-10-28T06:00:00Z' }, now);
  assert.equal(stuck.tone, 'bad');
});

test('הפעמון: מכשיר שסנכרן ועדיין מחזיק פעולה בת שעתיים, ולא נהג בלי קליטה', () => {
  const rows = [
    { ...base, last_sync_at: '2026-10-28T08:50:00Z', pending: 1, oldest_pending_at: '2026-10-28T06:30:00Z' }, // תקוע
    { ...base, driver_name: 'מוהנד', last_sync_at: '2026-10-28T06:00:00Z', pending: 3, oldest_pending_at: '2026-10-28T05:00:00Z' }, // בלי קליטה
    { ...base, driver_name: 'אולג', last_sync_at: '2026-10-28T08:58:00Z', pending: 1, oldest_pending_at: '2026-10-28T08:30:00Z' }, // טרי
  ];
  assert.deepEqual(stuckReports(rows, now).map((r) => r.driver_name), ['רודי']);
});
