import test from 'node:test';
import assert from 'node:assert/strict';
import {
  classifyPolicy, policyAccess, summarizeTable, exposureRank,
} from '../src/lib/policy-audience.ts';

const p = (expr, cmd = 'SELECT', roles = ['authenticated']) => ({ policy: 'x', cmd, roles, expr });

test('הביטויים האמיתיים של המערכת מסווגים נכון', () => {
  assert.equal(classifyPolicy(p('is_admin_or_dispatcher()')), 'staff');
  assert.equal(classifyPolicy(p('can_manage_team()')), 'managers');
  assert.equal(classifyPolicy(p('is_admin()')), 'admin');
  assert.equal(classifyPolicy(p("(current_user_role() = 'viewer'::text)")), 'viewer');
  assert.equal(classifyPolicy(p('true')), 'anyone');
  assert.equal(classifyPolicy(p('(auth.uid() = id)')), 'self');
  assert.equal(classifyPolicy(p('true', 'ALL', ['service_role'])), 'service');
});

test('🔴 מדיניות של נהג לא נספרת כ"כל מי שמחובר"', () => {
  const real =
    "((current_user_role() = 'driver'::text) AND (EXISTS ( SELECT 1 FROM calendar_stops cs " +
    "WHERE ((cs.order_id = orders.id) AND (cs.driver = current_user_driver())))))";
  assert.equal(classifyPolicy(p(real)), 'driverOwn');
  assert.equal(classifyPolicy(p("((current_user_role() = 'driver'::text) AND (driver = current_user_driver()))")), 'driverOwn');
});

test('🔴 ביטוי שלא מוכר מוחזר כלא-מזוהה, ולא נבלע', () => {
  assert.equal(classifyPolicy(p('(some_future_helper() AND x > 3)')), 'unknown');
  const v = summarizeTable({ tbl: 't', rls_enabled: true, policies: [p('(some_future_helper())')] });
  assert.equal(v.hasUnknown, true);
  assert.equal(v.byAudience.has('unknown'), true);
});

test('ALL פותח קריאה וכתיבה, SELECT רק קריאה, השאר כתיבה', () => {
  assert.deepEqual(policyAccess('ALL'), ['read', 'write']);
  assert.deepEqual(policyAccess('SELECT'), ['read']);
  assert.deepEqual(policyAccess('INSERT'), ['write']);
  assert.deepEqual(policyAccess('DELETE'), ['write']);
});

test('🔴 טבלה בלי אף מדיניות מסומנת כסגורה לבני אדם, ולא נעלמת', () => {
  const v = summarizeTable({ tbl: 'sync_state', rls_enabled: true, policies: [] });
  assert.equal(v.closedToPeople, true);
  assert.equal(exposureRank(v), 9);
});

test('🔴 RLS כבוי הוא החשיפה החמורה ביותר, גם אם יש מדיניות מהודקת', () => {
  const v = summarizeTable({ tbl: 'x', rls_enabled: false, policies: [p('is_admin()')] });
  assert.equal(v.rlsOff, true);
  assert.equal(exposureRank(v), 0);
});

test('סדר החשיפה: כתיבה לכולם לפני קריאה לכולם, ואלה לפני צוות', () => {
  const open  = summarizeTable({ tbl: 'a', rls_enabled: true, policies: [p('true', 'ALL')] });
  const read  = summarizeTable({ tbl: 'b', rls_enabled: true, policies: [p('true', 'SELECT')] });
  const staff = summarizeTable({ tbl: 'c', rls_enabled: true, policies: [p('is_admin_or_dispatcher()', 'ALL')] });
  assert.ok(exposureRank(open) < exposureRank(read));
  assert.ok(exposureRank(read) < exposureRank(staff));
});

test('טבלה עם כמה מדיניויות מאחדת את מה שכל קהל מקבל', () => {
  const v = summarizeTable({
    tbl: 'orders', rls_enabled: true,
    policies: [p('is_admin_or_dispatcher()', 'ALL'), p("(current_user_role() = 'viewer'::text)", 'SELECT')],
  });
  assert.deepEqual([...v.byAudience.get('staff')].sort(), ['read', 'write']);
  assert.deepEqual([...v.byAudience.get('viewer')], ['read']);
});
