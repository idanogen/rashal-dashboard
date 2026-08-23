import test from 'node:test';
import assert from 'node:assert/strict';
import { checkUserAdminPolicy } from '../api/_lib/user-admin-policy.ts';

/**
 * 🔴 הבדיקות האלה שומרות על הגבול בין "מנהל צוות" ל"מנהל מערכת". שתי
 * הדרכים להסלמה הן איפוס סיסמה למנהל מערכת, והענקת התפקיד לעצמך.
 */

const ADMIN = 'admin-1';
const MANAGER = 'mgr-1';

const asManager = (o) => checkUserAdminPolicy({ callerRole: 'team_manager', callerId: MANAGER, ...o });
const asAdmin = (o) => checkUserAdminPolicy({ callerRole: 'admin', callerId: ADMIN, ...o });

test('סדרן ונהג אינם מנהלי משתמשים כלל', () => {
  for (const role of ['dispatcher', 'driver', 'viewer', '', 'Admin']) {
    const r = checkUserAdminPolicy({ callerRole: role, callerId: 'x', action: 'create' });
    assert.equal(r.ok, false, role);
    assert.equal(r.status, 403);
  }
});

test('מנהל מערכת עובר הכל, כולל מחיקה והענקת מנהל מערכת', () => {
  assert.equal(asAdmin({ action: 'delete', targetId: 'u', targetRole: 'admin' }).ok, true);
  assert.equal(asAdmin({ action: 'set_role', targetId: 'u', newRole: 'admin' }).ok, true);
});

test('🔴 מנהל צוות לא מוחק משתמש', () => {
  const r = asManager({ action: 'delete', targetId: 'u', targetRole: 'viewer' });
  assert.equal(r.ok, false);
  assert.match(r.error, /להשבית/);
});

test('🔴 מנהל צוות לא נוגע במנהל מערכת, בשום פעולה', () => {
  for (const action of ['set_password', 'set_role', 'set_disabled', 'set_username', 'set_linked_driver']) {
    const r = asManager({ action, targetId: 'admin-9', targetRole: 'admin' });
    assert.equal(r.ok, false, action);
    assert.equal(r.status, 403);
  }
});

test('🔴 מנהל צוות לא מעניק "מנהל מערכת", גם לא לעצמו', () => {
  assert.equal(asManager({ action: 'set_role', targetId: 'u', targetRole: 'viewer', newRole: 'admin' }).ok, false);
  assert.equal(asManager({ action: 'set_role', targetId: MANAGER, targetRole: 'team_manager', newRole: 'admin' }).ok, false);
  assert.equal(asManager({ action: 'create', newRole: 'admin' }).ok, false);
});

test('מנהל צוות כן פותח משתמשים ומשייך תפקידים שאינם מנהל מערכת', () => {
  assert.equal(asManager({ action: 'create', newRole: 'driver' }).ok, true);
  assert.equal(asManager({ action: 'create', newRole: 'team_manager' }).ok, true);
  assert.equal(asManager({ action: 'set_role', targetId: 'u', targetRole: 'viewer', newRole: 'dispatcher' }).ok, true);
  assert.equal(asManager({ action: 'set_password', targetId: 'u', targetRole: 'driver' }).ok, true);
  assert.equal(asManager({ action: 'set_linked_driver', targetId: 'u', targetRole: 'driver' }).ok, true);
});

test('מנהל צוות שהוא במקרה גם היעד לא ננעל מחוץ לחשבון שלו', () => {
  assert.equal(asManager({ action: 'set_password', targetId: MANAGER, targetRole: 'team_manager' }).ok, true);
});
