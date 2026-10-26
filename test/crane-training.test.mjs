import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TRAINING_RELATIONS,
  TRAINING_SATISFACTION,
  TRAINING_SECTIONS,
  TRAINING_VERSION,
  canSubmitTraining,
  idLooksValid,
} from '../src/lib/crane-training.ts';

/**
 * 🔴 הטופס הזה נחתם על ידי לקוח, ולכן הוא נבדק בקוד ולא בעיניים.
 * גרסה 2 (26/10/2026): טופס הנייר של ר.שעל. סעיף 4 וסעיף 6 חובה.
 */

const full = () => ({
  recipientName: 'רותי כהן',
  recipientIdNumber: '012345678',
  recipientRelation: 'בן/בת',
  signature: 'data:image/png;base64,x',
  sling: { manufacturer: 'sunrise', productionDate: '01/2026', serial: 'SL1003' },
});

test('הכל מלא: מותר לשמור', () => {
  assert.deepEqual(canSubmitTraining(full()), { ok: true });
});

test('🔴 סעיף 4: כל אחד מארבעת השדות חוסם לבד', () => {
  for (const [k, re] of [['recipientName', /שם/], ['recipientIdNumber', /זהות/], ['recipientRelation', /קרבה/]]) {
    const g = canSubmitTraining({ ...full(), [k]: '  ' });
    assert.equal(g.ok, false, k);
    assert.match(g.reason, re);
  }
  const noSig = canSubmitTraining({ ...full(), signature: null });
  assert.equal(noSig.ok, false);
  assert.match(noSig.reason, /חתימה/);
});

test('🔴 סעיף 6: יצרן, תאריך ייצור ומס"ד חובה (עידן: "סעיף 6 לחייב")', () => {
  for (const k of ['manufacturer', 'productionDate', 'serial']) {
    const g = canSubmitTraining({ ...full(), sling: { ...full().sling, [k]: '' } });
    assert.equal(g.ok, false, k);
    assert.match(g.reason, /ערסל/);
  }
});

test('תעודת זהות: לפחות 5 תווים, ודרכון עם אותיות עובר', () => {
  assert.equal(idLooksValid('1234'), false);
  assert.equal(idLooksValid('12-34'), false);
  assert.equal(idLooksValid('012345678'), true);
  assert.equal(idLooksValid('AB123456'), true);
});

test('⭐ הנוסח: שני סעיפים עם תתי הסעיפים של הטופס, וסעיף 3 בשורה אחת', () => {
  assert.equal(TRAINING_VERSION, 2);
  assert.deepEqual(TRAINING_SECTIONS.map((s) => s.no), [1, 2]);
  assert.deepEqual(TRAINING_SECTIONS[0].clauses.map((c) => c.mark), ['א', 'ב', 'ג', 'ד', 'ה', 'ו']);
  assert.equal(TRAINING_SECTIONS[0].clauses.find((c) => c.mark === 'ה').sub.length, 2);
  assert.deepEqual(TRAINING_SECTIONS[1].clauses.map((c) => c.mark), ['א', 'ב', 'ג', 'ד', 'ה']);
  assert.match(TRAINING_SATISFACTION, /לשביעות רצוני/);
});

test('🔴 כל קטע מודגש באמת מופיע בתוך הטקסט שלו', () => {
  const all = TRAINING_SECTIONS.flatMap((s) => s.clauses.flatMap((c) => [c, ...(c.sub ?? [])]));
  for (const c of all.filter((x) => x.bold)) assert.ok(c.text.includes(c.bold), c.text);
});

test('יחס קרבה: רשימה שמתחילה בזכאי עצמו ונגמרת ב"אחר"', () => {
  assert.equal(TRAINING_RELATIONS[0], 'הזכאי עצמו');
  assert.equal(TRAINING_RELATIONS.at(-1), 'אחר');
});
