import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * 🔴🔴 **מצב ריק שקרי, וזה מה שעמי ראה.**
 *
 * <bdi>27/08/2026</bdi>: "אתמול עד שעות הערב לא היה אספקות במערכת", עם
 * צילום שבו כתוב **"אין הזמנות ממתינות לתיאום"** בזמן שבמסד יושבות
 * <bdi>829</bdi> הזמנות ממתינות, וההרשאה שלו מחזירה את כולן.
 *
 * השורש: בטאב "הכל" ארבע הרשימות נטענות במקביל, ומצבי הטעינה והשגיאה
 * **נמחקו במפורש** (`tab === 'all' ? null : tabState`). רשימה שעדיין
 * נטענת, או שהשליפה שלה נכשלה, ציירה את הטקסט הריק של עצמה.
 * ⭐ **ולכן זה גם "הסתדר לבד לקראת הערב":** טעינה שהסתיימה מאוחר נראית
 * בדיוק כמו תקלה שנעלמה. [[empty_state_must_speak]]
 *
 * הבדיקה סטטית, כי היא מגנה על החלטה ולא על חישוב.
 */

const RAW = readFileSync(new URL('../src/pages/DispatchPage.tsx', import.meta.url), 'utf8');

/**
 * 🔴 בלי שורות הערה. התיעוד של התקלה מצטט את הקוד השבור מילה במילה,
 * ובדיקה שסופרת מחרוזות הייתה נופלת על ההסבר של עצמה.
 */
const SRC = RAW.split('\n')
  .filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l))
  .join('\n');

test('🔴🔴 בטאב "הכל" אף רשימה אינה מציירת מצב ריק כשהיא נטענת או נכשלה', () => {
  const suppressed = [...SRC.matchAll(/tab === 'all' \? null : tabState/g)].length;
  assert.equal(
    suppressed,
    0,
    '🔴 מצב הטעינה והשגיאה מבוטלים בטאב "הכל", ורשימה שנכשלה תיראה כמו רשימה ריקה'
  );
});

test('🔴 לכל אחת מארבע הרשימות יש מצב משלה בטאב "הכל"', () => {
  for (const [loading, err] of [
    ['ordersLoading', 'ordersError'],
    ['callsLoading', 'callsError'],
    ['pickupsLoading', 'pickupsError'],
    ['customersLoading', 'customersError'],
  ]) {
    const re = new RegExp(`panelState\\(${loading},\\s*${err}`);
    assert.match(SRC, re, `🔴 אין מצב נפרד ל-${loading}`);
  }
});

test('⭐ המצב מבדיל בין "נטען" לבין "נכשל", ואומר את שניהם', () => {
  const fn = SRC.slice(SRC.indexOf('const panelState ='), SRC.indexOf('const renderTabState'));
  assert.match(fn, /if \(loading\)/, 'אין ענף טעינה');
  assert.match(fn, /if \(err\)/, 'אין ענף שגיאה');
  assert.match(fn, /הרשימה לא נטענה/, '🔴 השגיאה חייבת להיאמר במילים, לא רק באייקון');
  assert.match(fn, /err\.message/, 'הסיבה עצמה חייבת להופיע על המסך');
});

test('🔴 מצב הטאב אינו נגזר מרשימה אחרת בטאב "הכל"', () => {
  // קודם `tabError` נפלה ל-`customersError` בטאב הזה, כלומר תיארה
  // רשימה אחרת לגמרי מזו שהמשתמש הסתכל עליה.
  const block = SRC.slice(SRC.indexOf('const tabError ='), SRC.indexOf('const renderTabState'));
  assert.match(block, /tab === 'all'\s*\?\s*null/, '🔴 tabError אינה מנוטרלת בטאב "הכל"');
});
