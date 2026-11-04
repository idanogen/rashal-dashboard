import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decideTechnician, usersRefreshDue, VISIT_STATUSES } from '../supabase/functions/rashal-call-status/technician.ts';

/** "לטיפול" בפריוריטי בסיום הביקור (עידן, 04/11/2026). */
const map = new Map([['אולג', 'אולג'], ['דוד גוזלן', 'גוזלן'], ['מוהנד', null]]);
const known = new Set(['אולג', 'גוזלן', 'אילונה']);

test('שם ממופה שקיים בפריוריטי נכתב', () => {
  assert.deepEqual(decideTechnician('אולג', map, known), { login: 'אולג' });
  assert.deepEqual(decideTechnician('דוד גוזלן', map, known), { login: 'גוזלן' });
});

test('🔴 דילוג עם סיבה: בלי טכנאי, בלי מיפוי (מוהנד), או שם שלא קיים בפריוריטי', () => {
  assert.match(decideTechnician(null, map, known).skip, /אין טכנאי/);
  assert.match(decideTechnician('מוהנד', map, known).skip, /מוהנד.*אין שם משתמש/);
  assert.match(decideTechnician('מישהו', map, known).skip, /אין שם משתמש/);
  assert.match(decideTechnician('דוד גוזלן', map, new Set(['אולג'])).skip, /"גוזלן".*לא קיים/);
});

test('רשימת משתמשים לא זמינה: סומכים על המיפוי ועל הקריאה החוזרת', () => {
  assert.deepEqual(decideTechnician('דוד גוזלן', map, null), { login: 'גוזלן' });
});

test('🔴 משיכת המשתמשים: פעם ביום, ראשון עד חמישי בלבד, לפי שעון ישראל', () => {
  const sun = new Date('2026-11-08T05:00:00Z');
  assert.equal(usersRefreshDue(sun, null), true);
  assert.equal(usersRefreshDue(sun, new Date('2026-11-05T10:00:00Z')), true, 'נמשך בחמישי, היום ראשון');
  assert.equal(usersRefreshDue(sun, new Date('2026-11-08T04:00:00Z')), false, 'כבר נמשך היום');
  assert.equal(usersRefreshDue(new Date('2026-11-06T09:00:00Z'), new Date('2026-11-05T10:00:00Z')), false, 'שישי');
  assert.equal(usersRefreshDue(new Date('2026-11-07T09:00:00Z'), null), false, 'שבת, גם בלי מטמון');
  // 22:30 UTC בחמישי הוא כבר 00:30 שישי בישראל
  assert.equal(usersRefreshDue(new Date('2026-11-05T22:30:00Z'), null), false);
});

test('הסטטוסים שבהם נכתב מי טיפל: בוצעה ולהמשך טיפול', () => {
  assert.deepEqual(VISIT_STATUSES, ['בוצעה', 'להמשך טיפול']);
});

test('🔴 USERS חסום ל-API אצל ר.שעל: בלי מטמון אין משיכה יומית, רק ידנית', () => {
  const src = readFileSync(new URL('../supabase/functions/rashal-call-status/index.ts', import.meta.url), 'utf8');
  assert.ok(src.includes('if (!force && !lastSeen) return { refreshed: false };'));
});
