import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  AGING_BUCKETS,
  bucketOf,
  bucketTotals,
  overdueTotal,
  shekel,
} from '../src/lib/aging.ts';

/**
 * 🔴 **הבדיקות שמגנות על מסך שמדבר על כסף.**
 *
 * מסך גיול שמציג מספר שגוי גרוע ממסך שלא קיים, כי מתקשרים לפיו ללקוח.
 * לכן נבדקים כאן גם הגבולות של הדליים (שם נופלות שגיאות off-by-one),
 * וגם ההכרעה שאינה חישוב: מאיזה ותק מתחילים לקרוא לזה פיגור.
 */

const row = (b) => ({
  buckets: { b0_30: 0, b31_60: 0, b61_90: 0, b91_120: 0, b120_plus: 0, ...b },
});

test('גבולות הדליים: 30, 60, 90 ו-120 שייכים לדלי הנמוך', () => {
  assert.equal(bucketOf(0), 'b0_30');
  assert.equal(bucketOf(30), 'b0_30');
  assert.equal(bucketOf(31), 'b31_60');
  assert.equal(bucketOf(60), 'b31_60');
  assert.equal(bucketOf(61), 'b61_90');
  assert.equal(bucketOf(90), 'b61_90');
  assert.equal(bucketOf(91), 'b91_120');
  assert.equal(bucketOf(120), 'b91_120');
  assert.equal(bucketOf(121), 'b120_plus');
});

test('🔴 ותק שלילי נופל לדלי הראשון ולא נעלם', () => {
  // חשבונית בתאריך עתידי קיימת בנתונים. שורה שאינה נכנסת לשום דלי פשוט
  // לא מופיעה בסכום, והסכום הכולל מפסיק להסתדר בלי שגיאה.
  assert.equal(bucketOf(-5), 'b0_30');
  assert.equal(bucketOf(Number.NaN), 'b0_30');
});

test('🔴 סכום הדליים שווה לסכום שנצבר', () => {
  const rows = [
    row({ b0_30: 100, b61_90: 250 }),
    row({ b120_plus: 400 }),
    row({ b31_60: 1000 }),
  ];
  const totals = bucketTotals(rows);
  assert.equal(
    AGING_BUCKETS.reduce((s, b) => s + totals[b], 0),
    1750
  );
  assert.equal(totals.b0_30, 100);
  assert.equal(totals.b31_60, 1000);
  assert.equal(totals.b61_90, 250);
  assert.equal(totals.b120_plus, 400);
});

test('🔴 החוב שבפיגור נספר מ-61 יום ומעלה בלבד', () => {
  // ⭐ ההכרעה עצמה, ולא החישוב: עד 60 יום זה מחזור עסקים רגיל אצל קופות
  // החולים, וספירה משם הייתה מציגה כמעט את כל החוב כפיגור.
  const rows = [row({ b0_30: 1000, b31_60: 500, b61_90: 300, b120_plus: 200 })];
  assert.equal(overdueTotal(rows), 500);
});

test('זיכוי שלילי מקזז ואינו מתעלמים ממנו', () => {
  // נמדד: לכללית יש -8,215 בדלי מעל 120.
  assert.equal(overdueTotal([row({ b120_plus: -8215 })]), -8215);
});

test('🔴 אפס מוצג כאפס ולא כמינוס אפס', () => {
  assert.equal(shekel(-0.2), '₪0');
  assert.equal(shekel(0), '₪0');
});

/**
 * 🔴🔴 **שמירת הזהות בין המתמטיקה שבמסד למתמטיקה שבדפדפן.**
 *
 * הצבירה נעשית ב-SQL (`debt_aging`), אבל `bucketOf` צובע כל חשבונית
 * בודדת במסך. אלה שני מימושים של אותה החלטה, ושניים כאלה מתפצלים בשקט:
 * מישהו ישנה גבול בצד אחד, השורה תיצבע בכתום והסכום ייספר בירוק.
 * [[dual_implementation_needs_byte_identical_guard]]
 */
test('🔴 גבולות הדליים ב-SQL זהים ל-bucketOf', () => {
  const sql = readFileSync(
    new URL('../supabase/migrations/20260827_debt_aging.sql', import.meta.url),
    'utf8'
  );
  const thresholds = [...sql.matchAll(/age_days\s*<=\s*(\d+)/g)].map((m) => Number(m[1]));
  assert.deepEqual([...new Set(thresholds)], [30, 60, 90, 120]);

  // 🔴 והדלי האחרון הוא "גדול מ-120", ואין אחריו כלום.
  assert.match(sql, /age_days\s*>\s*120/);
});

/**
 * 🔴 ההסתייגות היא חלק מהמסך, לא נימוס. הנתון שלנו נבדק מול הדוח והוא
 * קירוב מצוין, אבל משרד הביטחון אצלנו 390 אלף ובדוח 264 אלף. מסך שמציג
 * מספר כספי בלי לומר מאיפה הוא בא הוא מסך שמישהו יגבה לפיו.
 */
test('🔴 מסך הגבייה אומר במפורש שהמספר אינו מפריוריטי', () => {
  const page = readFileSync(new URL('../src/pages/CollectionsPage.tsx', import.meta.url), 'utf8');
  assert.match(page, /לסכום המחייב עובדים מול פריוריטי/);
});

test('🔴 המינוס לפני סימן המטבע, כדי שזיכוי לא ייראה כתקלת רינדור', () => {
  assert.equal(shekel(-8215.24), '-₪8,215');
  assert.equal(shekel(8215), '₪8,215');
});
