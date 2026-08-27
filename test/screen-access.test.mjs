import test from 'node:test';
import assert from 'node:assert/strict';
import { SCREEN_ACCESS, screenAllow } from '../src/lib/screen-access.ts';

/**
 * 🔴 הבדיקות האלה מקבעות החלטות מדיניות, לא קוד. הן קיימות כדי ששחרור
 * הרשאה יהיה החלטה מודעת ולא תוצאת לוואי של עריכה.
 */

/**
 * 🔴 **הוסב 27/08/2026.** עד אז המסך היה פתוח למנהל מערכת בלבד, ולכן כדי
 * ששלומי יראה אותו הוא קיבל **מנהל מערכת מלא** עם ניהול משתמשים ותבניות.
 * עידן, 26/08: "כל דבר שמדבר על כסף חשוף רק להרשאת הנהלה."
 * ⭐ הבדיקה שומרת על מה שחשוב באמת: **מנהל צוות וסדרן אינם שם**.
 */
test('דשבורד ההנהלה פתוח למי שרואה כסף בלבד', () => {
  assert.deepEqual(screenAllow('/overview'), ['admin', 'management']);
  for (const r of ['team_manager', 'dispatcher', 'viewer', 'driver']) {
    assert.ok(!screenAllow('/overview').includes(r), `${r} אינו אמור לראות כסף`);
  }
});

/**
 * ⭐ ומסך הסקרים הוא ההפך המדויק: פתוח לצוות המשרד ולא להנהלה בלבד,
 * כי שביעות רצון אינה כסף. זו הבקשה של עמי, 26/08.
 */
test('מסך הסקרים פתוח לצוות המשרד, ולא לנהג', () => {
  const allow = screenAllow('/surveys');
  for (const r of ['admin', 'management', 'team_manager', 'dispatcher', 'viewer']) {
    assert.ok(allow.includes(r), `${r} אמור לראות סקרים`);
  }
  assert.ok(!allow.includes('driver'), 'נהג רואה את הנסיעה שלו, לא דוחות');
});

/**
 * 🔴 גיול חובות נולד סגור. הבדיקה קיימת כדי שפתיחה שלו למנהל צוות או
 * לסדרן תהיה החלטה מודעת ולא עריכה שעברה בשקט.
 */
test('מסך גיול החובות פתוח למי שרואה כסף בלבד', () => {
  assert.deepEqual(screenAllow('/collections'), ['admin', 'management']);
  for (const r of ['team_manager', 'dispatcher', 'viewer', 'driver']) {
    assert.ok(!screenAllow('/collections').includes(r), `${r} אינו אמור לראות חובות`);
  }
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
