import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveDedupGroups } from '../src/lib/dedup-heads.ts';

/**
 * 🔴 מה שנבדק כאן הוא ש**עבודה פתוחה לא יורדת מהמסך יחד עם הראש שלה**.
 * עד 01/09/2026 ההסתרה של כפיל הייתה מוחלטת, ושתי עבודות אמיתיות
 * (SO2601795 · SC2601972) לא היו מוצגות באף מסך אחרי שהראש שלהן נסגר.
 * בדיקה שסופרת רק "כמה ראשים" הייתה עוברת גם אז.
 */

const acc = {
  getId: (r) => r.id,
  getDuplicateOf: (r) => r.head,
  isOpen: (r) => r.open !== false,
  isOpenInPriority: (r) => r.upstream !== false,
};

const ids = (rows) => rows.map((r) => r.id);

test('כפיל מוסתר כל עוד הראש שלו נטען ופתוח', () => {
  const { heads, groupSize, hiddenCount } = resolveDedupGroups(
    [{ id: 'a' }, { id: 'b', head: 'a' }],
    acc
  );
  assert.deepEqual(ids(heads), ['a']);
  assert.equal(groupSize.get('a'), 2);
  assert.equal(hiddenCount, 1);
});

test('הראש נסגר והכפיל פתוח: הכפיל עולה לרשימה', () => {
  const { heads, groupSize, hiddenCount } = resolveDedupGroups(
    [{ id: 'SO2601794', open: false }, { id: 'SO2601795', head: 'SO2601794' }],
    acc
  );
  assert.deepEqual(ids(heads), ['SO2601794', 'SO2601795']);
  // 🔴 בלי זה הבאדג' מבטיח כרטיס שני שכבר קיים בפני עצמו ברשימה.
  assert.equal(groupSize.get('SO2601794'), undefined);
  assert.equal(hiddenCount, 0);
});

test('הראש כלל לא נטען (אורכב או נפל מהחלון): הכפיל עולה לרשימה', () => {
  const { heads } = resolveDedupGroups([{ id: 'SC2601972', head: 'SC2601971' }], acc);
  assert.deepEqual(ids(heads), ['SC2601972']);
});

test('כפיל סגור שהראש שלו סגור נשאר מוסתר, ולא מזיז מונים היסטוריים', () => {
  const { heads, groupSize, hiddenCount } = resolveDedupGroups(
    [{ id: 'a', open: false }, { id: 'b', head: 'a', open: false }],
    acc
  );
  assert.deepEqual(ids(heads), ['a']);
  assert.equal(groupSize.get('a'), 2);
  assert.equal(hiddenCount, 1);
});

test('כפיל סגור בלי ראש נטען אינו מייצר באדג׳ לראש רפאים', () => {
  const { heads, groupSize, hiddenCount } = resolveDedupGroups(
    [{ id: 'b', head: 'ghost', open: false }],
    acc
  );
  assert.deepEqual(ids(heads), []);
  assert.equal(groupSize.size, 0);
  assert.equal(hiddenCount, 1);
});

test('רק חלק מהכפילים עולים, והבאדג׳ סופר את מי שנשאר מתחת', () => {
  const { heads, groupSize } = resolveDedupGroups(
    [
      { id: 'head' },
      { id: 'open-dup', head: 'head' },
      { id: 'closed-dup', head: 'head', open: false },
    ],
    acc
  );
  // הראש פתוח, ולכן שני הכפילים נשארים מתחתיו
  assert.deepEqual(ids(heads), ['head']);
  assert.equal(groupSize.get('head'), 3);

  const closedHead = resolveDedupGroups(
    [
      { id: 'head', open: false },
      { id: 'open-dup', head: 'head' },
      { id: 'closed-dup', head: 'head', open: false },
    ],
    acc
  );
  assert.deepEqual(ids(closedHead.heads), ['head', 'open-dup']);
  assert.equal(closedHead.groupSize.get('head'), 2);
  assert.equal(closedHead.hiddenCount, 1);
});

test('סדר הרשימה נשמר, וכפיל שהועלה יושב במקומו המקורי', () => {
  const { heads } = resolveDedupGroups(
    [{ id: 'x', open: false }, { id: 'y', head: 'x' }, { id: 'z' }],
    acc
  );
  assert.deepEqual(ids(heads), ['x', 'y', 'z']);
});

test('🔴 כפיל יתום שכבר סגור בפריוריטי אינו עולה לרשימה', () => {
  // נמדד 01/09/2026: בלי התנאי הזה 14 הזמנות ש"בוצעה" בפריוריטי, כלומר
  // סופקו דרך הראש, היו נוחתות על הסדרן כעבודה חדשה.
  const { heads, hiddenCount } = resolveDedupGroups(
    [{ id: 'a', open: false }, { id: 'b', head: 'a', upstream: false }],
    acc
  );
  assert.deepEqual(ids(heads), ['a']);
  assert.equal(hiddenCount, 1);
});

test('🔴 שארית ה-webhook הישן בלי סטטוס פריוריטי נשארת מוסתרת', () => {
  const legacyAcc = { ...acc, isOpenInPriority: (r) => !!r.pstatus };
  const { heads } = resolveDedupGroups(
    [{ id: 'a', open: false }, { id: 'b', head: 'a' }],
    legacyAcc
  );
  assert.deepEqual(ids(heads), ['a']);
});
