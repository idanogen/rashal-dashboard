import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRANE_CHECKLIST, allItemIds, progressOf, canSubmit, VERDICT_LABELS,
} from '../src/lib/crane-checklist.ts';

/**
 * 🔴 זה טופס בטיחות של ציוד הרמה רפואי. מה שנבדק כאן אינו "האם הקוד רץ"
 * אלא **שהטופס לא איבד פריט ושלא ניתן להצהיר "תקין" בלי לבדוק**.
 */

const all = (v = true) => Object.fromEntries(allItemIds().map((id) => [id, v]));

test('הטופס שלם: חמישה פרקים ו-21 פריטים', () => {
  assert.equal(CRANE_CHECKLIST.length, 5);
  assert.equal(allItemIds().length, 21);
  // 🔴 מזהים ייחודיים. כפילות הייתה גורמת לשני פריטים להסתמן יחד.
  assert.equal(new Set(allItemIds()).size, 21);
});

/**
 * 🔴🔴 שבעת פריטי הבטיחות האדומים מהטופס המקורי. אם מישהו ינקה "הדגשה
 * מיותרת" הבדיקה הזאת תיפול, וזו בדיוק הכוונה.
 */
test('🔴 פריטי הבטיחות הקריטיים נשמרו', () => {
  const critical = CRANE_CHECKLIST.flatMap((s) => s.items).filter((i) => i.critical);
  assert.equal(critical.length, 7);
  const text = critical.map((i) => i.text).join(' | ');
  assert.match(text, /עצירת החירום|עצירת חירום/);
  assert.match(text, /הורדת חירום/);
  assert.match(text, /מנשא/);
});

test('🔴 אי אפשר להצהיר "תקין להפעלה" בלי לסמן הכל', () => {
  const partial = { ...all(), e4: false };
  const r = canSubmit(partial, 'ok', 'רות כהן');
  assert.equal(r.ok, false);
  assert.match(r.reason, /בטיחות/);
});

test('הכל מסומן ותקין: מותר להגיש', () => {
  assert.equal(canSubmit(all(), 'ok', 'רות כהן').ok, true);
});

/**
 * ⭐ ההפך המדויק, וזו ההכרעה החשובה: מנוף שנמצא פגום הוא בדיוק המקרה
 * שבו חלק מהבדיקות לא בוצעו. חסימה מוחלטת הייתה מכריחה את הטכנאי לסמן
 * וי על מה שלא בדק, רק כדי שהמערכת תיתן לו לדווח על התקלה.
 */
test('⭐ "הוצא משימוש" מותר להגשה גם עם פריטים לא מסומנים', () => {
  assert.equal(canSubmit({}, 'out_of_service', 'רות כהן').ok, true);
});

test('בלי הכרעה ובלי שם מקבל אי אפשר להגיש', () => {
  assert.equal(canSubmit(all(), null, 'רות כהן').ok, false);
  assert.equal(canSubmit(all(), 'ok', '   ').ok, false);
  assert.match(canSubmit(all(), 'ok', '').reason, /מקבל/);
});

test('ההתקדמות נספרת נכון, וקריטיים חסרים מדווחים בנפרד', () => {
  const p = progressOf({ ...all(), e4: false, b1: false, s1: false });
  assert.equal(p.checked, 18);
  assert.equal(p.total, 21);
  assert.equal(p.missing.length, 3);
  assert.equal(p.missingCritical.length, 2);
});

test('שתי ההכרעות מנוסחות בעברית', () => {
  assert.equal(VERDICT_LABELS.ok, 'תקין להפעלה');
  assert.match(VERDICT_LABELS.out_of_service, /לא תקין/);
});
