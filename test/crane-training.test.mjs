import test from 'node:test';
import assert from 'node:assert/strict';
import { CRANE_CHECKLIST } from '../src/lib/crane-checklist.ts';
import {
  TRAINING_TOPICS,
  canSubmitTraining,
  trainingProgress,
} from '../src/lib/crane-training.ts';

/**
 * 🔴 **הטופס הזה נחתם על ידי לקוח, ולכן הוא נבדק בקוד ולא בעיניים.**
 * מה שנחתם עליו הוא הצהרה משפטית שהמשתמש קיבל הדרכה על ציוד הרמה רפואי.
 */

const allChecked = () =>
  Object.fromEntries(TRAINING_TOPICS.map((t) => [t.id, true]));

test('⭐ נושאי ההדרכה נגזרים מפרק הבטיחות ואינם עותק שני', () => {
  const safety = CRANE_CHECKLIST.find((s) => s.id === 'safety');
  assert.ok(safety, 'פרק הבטיחות נעלם מרשימת הבדיקה');
  assert.deepEqual(
    TRAINING_TOPICS.map((t) => t.text),
    safety.items.map((i) => i.text)
  );
});

test('🔴 הרשימה אינה ריקה, ואם היא ריקה אי אפשר להחתים', () => {
  // בקרה חיובית: בדיקה שעוברת על רשימה ריקה נראית בדיוק כמו בדיקה
  // שעברה. [[silence_needs_a_positive_control]]
  assert.ok(TRAINING_TOPICS.length >= 8, `רק ${TRAINING_TOPICS.length} נושאים`);
});

test('🔴🔴 אי אפשר להחתים כשנושא אחד לא סומן', () => {
  const a = allChecked();
  const first = TRAINING_TOPICS[0].id;
  delete a[first];
  const gate = canSubmitTraining(a, 'רותי כהן', 'data:image/png;base64,x');
  assert.equal(gate.ok, false);
  assert.match(gate.reason, /נושא אחד/);
});

test('🔴 ואין כאן "הוצא משימוש": שום ערך אינו פותח מילוי חלקי', () => {
  // בטופס הטכנאי מותר להגיש חלקית כשהמנוף פגום. כאן ההפך המדויק:
  // נושא שלא הוסבר פירושו שהלקוח לא יכול לחתום שקיבל עליו הדרכה.
  const a = { [TRAINING_TOPICS[0].id]: true };
  assert.equal(canSubmitTraining(a, 'רותי כהן', 'sig').ok, false);
});

test('חסר שם חוסם, וחסרה חתימה חוסמת', () => {
  assert.equal(canSubmitTraining(allChecked(), '  ', 'sig').ok, false);
  assert.match(canSubmitTraining(allChecked(), '  ', 'sig').reason, /שם/);
  assert.equal(canSubmitTraining(allChecked(), 'רותי', null).ok, false);
  assert.match(canSubmitTraining(allChecked(), 'רותי', null).reason, /חתימה/);
});

test('הכל מסומן, שם וחתימה: מותר להחתים', () => {
  assert.deepEqual(canSubmitTraining(allChecked(), 'רותי כהן', 'sig'), { ok: true });
});

test('ההתקדמות סופרת נכון', () => {
  const a = { [TRAINING_TOPICS[0].id]: true, [TRAINING_TOPICS[1].id]: true };
  const p = trainingProgress(a);
  assert.equal(p.checked, 2);
  assert.equal(p.total, TRAINING_TOPICS.length);
  assert.equal(p.missing.length, TRAINING_TOPICS.length - 2);
});

test('🔴 סימון פריט שאינו ברשימה אינו נחשב התקדמות', () => {
  // ⭐ מגן על המקרה שבו מזהה בפרק הבטיחות ישתנה: הדיאלוג ימשיך לכתוב
  // מזהים ישנים, והשער יחסום במקום להחתים על רשימה שלא סומנה.
  assert.equal(trainingProgress({ 'לא-קיים': true }).checked, 0);
});
