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
  for (const action of ['set_password', 'set_role', 'set_disabled', 'set_username', 'set_linked_driver', 'send_reset_link', 'set_phone']) {
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

/**
 * 🔴🔴 **שני המסלולים החדשים הם דלת הסלמה בדיוק כמו `set_password`.**
 * מי ששולח קישור איפוס למנהל מערכת מקבל את החשבון שלו, ומי שקובע לו את
 * הטלפון קובע לאן הקישור הזה יגיע. שניהם חייבים ליפול תחת אותו איסור,
 * ולכן הם נבדקים במפורש ולא נשענים על כך ש"הפונקציה מטפלת בהכל".
 */
test('🔴🔴 מנהל צוות לא שולח קישור איפוס למנהל מערכת ולא קובע לו טלפון', () => {
  for (const action of ['send_reset_link', 'set_phone']) {
    const r = checkUserAdminPolicy({
      callerRole: 'team_manager',
      callerId: MANAGER,
      action,
      targetId: ADMIN,
      targetRole: 'admin',
    });
    assert.equal(r.ok, false, action);
    assert.equal(r.status, 403, action);
  }
});

test('מנהל צוות כן שולח קישור איפוס לסדרן ולנהג', () => {
  for (const targetRole of ['dispatcher', 'driver', 'viewer', 'team_manager']) {
    const r = checkUserAdminPolicy({
      callerRole: 'team_manager',
      callerId: MANAGER,
      action: 'send_reset_link',
      targetId: 'u-9',
      targetRole,
    });
    assert.equal(r.ok, true, targetRole);
  }
});

test('⭐ מנהל צוות שולח לעצמו איפוס גם אם הוא במקרה מנהל מערכת', () => {
  // אחרת אדם ננעל מחוץ לחשבון של עצמו, וזה בדיוק המצב שהכפתור נועד לפתור.
  const r = checkUserAdminPolicy({
    callerRole: 'team_manager',
    callerId: MANAGER,
    action: 'send_reset_link',
    targetId: MANAGER,
    targetRole: 'admin',
  });
  assert.equal(r.ok, true);
});
