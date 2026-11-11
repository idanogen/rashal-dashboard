// דוח האספקות בערב (11/11/2026): מה כל ריצה של rashal-morning-report שולחת, ובאילו משתנים.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { planRun, deliveryVariables, deliveryRate } from '../supabase/functions/rashal-morning-report/plan.ts';

const cron = (slot, hour, sendHour = slot === 'evening' ? 19 : 7) => planRun({ slot, hour, trigger: 'cron', sendHour });

test('מצב בוקר: הכל יוצא ב-7, חלון הערב לא שולח כלום', () => {
  assert.deepEqual(cron('morning', 6), { delivery: false, reminders: false, reason: 'before 7:00 Israel (now 6)' });
  assert.deepEqual(cron('morning', 7), { delivery: true, reminders: true });
  assert.equal(cron('morning', 19).delivery, false);
  assert.equal(cron('morning', 19).reminders, false);
});

test('מצב ערב: דוח האספקות ב-19 בלבד, דוח התזכורות נשאר בבוקר', () => {
  assert.deepEqual(cron('evening', 7), { delivery: false, reminders: true });
  assert.equal(cron('evening', 18).delivery, false, '18:00 בחורף = חלון 16 UTC, מוקדם מדי');
  assert.deepEqual(cron('evening', 19), { delivery: true, reminders: false });
  assert.deepEqual(cron('evening', 20), { delivery: true, reminders: false });
});

test('ריצה ידנית לא מחכה לשעה, ו-part בוחר חלק', () => {
  const manual = (part) => planRun({ slot: 'evening', hour: 9, trigger: 'manual', sendHour: 19, part });
  assert.deepEqual(manual(undefined), { delivery: true, reminders: true });
  assert.deepEqual(manual('delivery'), { delivery: true, reminders: false });
  assert.deepEqual(manual('reminders'), { delivery: false, reminders: true });
});

const t = { planned: 49, delivered: 34, not_delivered: 11, follow_up: 2, open: 2 };

test('תבנית הבוקר: המשך טיפול נדבק ל-not_delivered, אין משתנה follow_up', () => {
  const v = Object.fromEntries(deliveryVariables('morning', '2026-11-10', 2, t).map((x) => [x.name, x.value]));
  assert.equal(v.not_delivered, '11 עצירות, להמשך טיפול אחרי ביקור 2');
  assert.equal('follow_up' in v, false);
  assert.equal(v.report_day, 'יום שלישי 10/11');
  assert.equal(v.rate, '76%');
  assert.equal(v.report_date, '2026-11-10');
});

test('תבנית הערב: follow_up משתנה משלו ו-not_delivered מספר בלבד', () => {
  const v = Object.fromEntries(deliveryVariables('evening', '2026-11-11', 3, t).map((x) => [x.name, x.value]));
  assert.equal(v.not_delivered, '11');
  assert.equal(v.follow_up, '2');
  assert.equal(v.report_day, 'יום רביעי 11/11');
});

test('המשתנים תואמים לתבניות שאושרו (השמות מהגוף ב-heyy)', () => {
  const morning = ['report_day', 'planned', 'delivered', 'not_delivered', 'open_count', 'rate', 'report_date'];
  const evening = ['report_day', 'planned', 'delivered', 'not_delivered', 'follow_up', 'open_count', 'rate', 'report_date'];
  assert.deepEqual(deliveryVariables('morning', '2026-11-10', 2, t).map((x) => x.name).sort(), [...morning].sort());
  assert.deepEqual(deliveryVariables('evening', '2026-11-10', 2, t).map((x) => x.name).sort(), [...evening].sort());
});

test('אחוז בלי דיווח', () => {
  assert.equal(deliveryRate({ planned: 3, delivered: 0, not_delivered: 0, open: 3 }), 'אין דיווח');
});

test('המיגרציה מזיזה את הקרון לשני החלונות ושומרת את מזהה תבנית הערב', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261111_evening_delivery_report.sql', import.meta.url), 'utf8');
  assert.match(sql, /\*\/10 4-5,16-17 \* \* 0-5/);
  assert.match(sql, /cc64e289-3228-48b1-9cba-05b40850753f/);
});
