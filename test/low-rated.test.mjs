import test from 'node:test';
import assert from 'node:assert/strict';
import { isLowRated, openLowRated, orderLowRated, LOW_RATED_MAX } from '../src/lib/low-rated.ts';
import { surveyWhen } from '../src/lib/survey-when.ts';

/**
 * 🔴 **הבדיקות שמגנות על ההכרעות של "האם טופל" (עידן, 02/09/2026).**
 *
 * הפאנל הזה נוגע בלקוח לא מרוצה, והכשל היחיד שמסוכן כאן הוא רשימה
 * שנראית ריקה בזמן שהעבודה עדיין פתוחה, או להפך: מונה שלא יורד לעולם.
 */

const row = (o = {}) => ({ satisfaction: 1, answeredAt: '2026-08-27T09:00:00Z', handledAt: null, ...o });

test('🔴 הסף הוא 2 ומטה, זהה למנוע ההתראות', () => {
  assert.equal(LOW_RATED_MAX, 2);
  assert.equal(isLowRated(row({ satisfaction: 2 })), true);
  assert.equal(isLowRated(row({ satisfaction: 3 })), false);
  // לקוח שענה בלי לדרג אינו דירוג נמוך, אחרת כל תשובה ריקה נכנסת לרשימה
  assert.equal(isLowRated(row({ satisfaction: null })), false);
});

test('🔴 הפתוחים קודם, וגם כשהמטופל חדש יותר', () => {
  const handledToday = row({ answeredAt: '2026-09-01T09:00:00Z', handledAt: '2026-09-02T08:00:00Z' });
  const openOld = row({ answeredAt: '2026-08-20T09:00:00Z' });
  const ordered = orderLowRated([handledToday, openOld]);
  assert.deepEqual(ordered.map((r) => r.answeredAt), ['2026-08-20T09:00:00Z', '2026-09-01T09:00:00Z']);
});

test('בתוך כל קבוצה, החדש קודם', () => {
  const a = row({ answeredAt: '2026-08-20T09:00:00Z' });
  const b = row({ answeredAt: '2026-08-28T09:00:00Z' });
  assert.deepEqual(orderLowRated([a, b]).map((r) => r.answeredAt), [b.answeredAt, a.answeredAt]);
});

test('🔴 מטופל אינו נמחק מהרשימה, רק יורד', () => {
  const rows = [row({ handledAt: '2026-09-02T08:00:00Z' })];
  assert.equal(orderLowRated(rows).length, 1);
});

test('🔴 המונה סופר פתוחים בלבד, אחרת הוא לא יורד לעולם', () => {
  const rows = [row(), row({ handledAt: '2026-09-02T08:00:00Z' }), row()];
  assert.equal(openLowRated(rows).length, 2);
});

test('המיון אינו משנה את המערך שהתקבל', () => {
  const rows = [row({ answeredAt: '2026-08-20T09:00:00Z' }), row({ answeredAt: '2026-08-28T09:00:00Z' })];
  const before = rows.map((r) => r.answeredAt);
  orderLowRated(rows);
  assert.deepEqual(rows.map((r) => r.answeredAt), before);
});

/* ─────────────────── התאריך שמוצג לצד "טופל" ─────────────────── */

test('🔴 תאריך עם שנה, כי הרשימה מעורבת בין חודשים', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  assert.match(surveyWhen('2026-08-27T09:00:00Z', now), /^27\.8\.2026 /);
});

test('היום מוצג כ"היום" עם שעה', () => {
  const now = new Date('2026-09-02T12:00:00Z');
  assert.match(surveyWhen('2026-09-02T09:00:00Z', now), /^היום /);
});

test('בלי תאריך, ותאריך שבור, מחזירים מחרוזת ריקה ולא NaN', () => {
  assert.equal(surveyWhen(null), '');
  assert.equal(surveyWhen('לא תאריך'), '');
});
