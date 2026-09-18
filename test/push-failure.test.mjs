import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { failureLine, isPermanentRejection, parkReason, priorityErrorText } from '../supabase/functions/rashal-push/push-failure.ts';

/**
 * הכשל שהוליד את הקובץ (18/09/2026): הערת "לא בוצע" על SC2602255, קריאה
 * בסטטוס "סופית", נדחתה ב-400 כל רבע שעה במשך יומיים.
 */
const REAL_400 = JSON.stringify({
  '?xml': { '@version': '1.0', '@encoding': 'utf-8', '@standalone': 'yes' },
  FORM: {
    '@TYPE': 'DOCUMENTS_Q',
    InterfaceErrors: { '@XmlFormat': '0', text: 'שורה 2- מסך טקסט DOCTEXT_Q הינו לקריאה בלבד ולא ניתן לעדכון.' },
  },
});

test('🔴 הנוסח של פריוריטי נשלף מתוך עטיפת ה-XML', () => {
  assert.equal(priorityErrorText(REAL_400), 'שורה 2- מסך טקסט DOCTEXT_Q הינו לקריאה בלבד ולא ניתן לעדכון.');
  assert.equal(priorityErrorText('{"error":{"message":"Not authorized"}}'), 'Not authorized');
  assert.equal(priorityErrorText('<html>502 Bad Gateway</html>'), null);
});

test('דחייה סופית מול תקלה רגעית', () => {
  for (const s of [400, 403, 404, 405, 409, 422]) assert.equal(isPermanentRejection(s), true, `${s} סופי`);
  // 🔴 אלה מסתדרים בלי שינוי בתוכן, ולכן ממשיכים לנסות.
  for (const s of [401, 408, 429, 500, 502, 503]) assert.equal(isPermanentRejection(s), false, `${s} רגעי`);
  assert.equal(isPermanentRejection(null), false, 'תקלת רשת בלי תשובה');
  assert.equal(isPermanentRejection(201), false);
});

test('סיבת העצירה נגזרת מהנוסח', () => {
  assert.equal(parkReason(priorityErrorText(REAL_400)), 'read_only_subform');
  assert.equal(parkReason('לקוח לא קיים'), 'priority_rejected');
  assert.equal(parkReason(null), 'priority_rejected');
});

test('🔴 שורת השגיאה מביאה את המשפט, לא את ה-XML', () => {
  const line = failureLine('call:note:abc', 400, REAL_400);
  assert.ok(line.includes('לקריאה בלבד'), 'הסיבה חייבת להופיע');
  assert.ok(!line.includes('@XmlFormat'), 'בלי עטיפה');
  // החיתוך הישן ל-150 תווים עצר בדיוק לפני המשפט, והמייל אמר "HTTP 400" ותו לא.
  assert.ok(line.slice(0, 150).includes('DOCTEXT_Q'));
  assert.equal(failureLine('call:x', null, 'network down'), 'call:x: ללא תשובה · network down');
});

test('🔴 רשימת הסטטוסים הנעולים במיגרציה אינה רשימת הסגורים שלנו', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260918_call_push_park.sql', import.meta.url), 'utf8');
  const m = /in \(('[^)]+')\) *\n *then 'call_locked'/.exec(sql);
  assert.ok(m, 'הרשימה חייבת להיות בקובץ המיגרציה');
  const locked = m[1].split(',').map((x) => x.trim().replace(/'/g, ''));
  assert.deepEqual(locked, ['סופית', 'מבוטלת', 'טופל טכנאי']);
  // "בוצעה" סגורה אצלנו (`PRIORITY_CALL_CLOSED`) אבל בפריוריטי היא סטטוס
  // פעיל שמאפשר שינויים, ולכן כתיבה אליה מותרת. שתי רשימות, שתי שאלות.
  assert.ok(!locked.includes('בוצעה'));
  assert.ok(!locked.includes('טיוטא'));
});
