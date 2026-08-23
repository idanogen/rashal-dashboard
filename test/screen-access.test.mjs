import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREEN_ACCESS, screenAllow } from '../src/lib/screen-access.ts';

/**
 * 🔴 הבדיקות האלה מקבעות החלטות מדיניות, לא קוד. הן קיימות כדי ששחרור
 * הרשאה יהיה החלטה מודעת ולא תוצאת לוואי של עריכה.
 */

test('דשבורד ההנהלה פתוח למנהל מערכת בלבד', () => {
  assert.deepEqual(screenAllow('/overview'), ['admin']);
});

test('תבניות הוואטסאפ פתוחות למנהל מערכת בלבד', () => {
  assert.deepEqual(screenAllow('/admin/wa-templates'), ['admin']);
});

test('מסכי הניהול של המשתמשים פתוחים גם למנהל צוות, ולא לסדרן', () => {
  for (const p of ['/admin/users', '/admin/team', '/admin/permissions']) {
    assert.deepEqual(screenAllow(p).sort(), ['admin', 'team_manager'], p);
    assert.equal(screenAllow(p).includes('dispatcher'), false, p);
  }
});

test('🔴 נהג לא מגיע לאף מסך של הצוות', () => {
  const staffOnly = SCREEN_ACCESS.filter((s) => s.group !== 'field' && s.path !== '/feedback');
  for (const s of staffOnly) {
    assert.equal(s.allow.includes('driver'), false, s.path);
  }
});

test('מסך הנהג הוא של הנהג בלבד', () => {
  assert.deepEqual(screenAllow('/driver'), ['driver']);
});

test('🔴 נתיב שאינו רשום זורק, ולא מחזיר רשימה ריקה', () => {
  // רשימה ריקה הייתה נראית כמו "אסור לכולם" ומסתירה מסך שנוסף ולא נרשם.
  assert.throws(() => screenAllow('/some/new/screen'), /אינו רשום/);
});

test('לכל מסך יש לפחות תפקיד אחד', () => {
  for (const s of SCREEN_ACCESS) assert.ok(s.allow.length > 0, s.path);
});
