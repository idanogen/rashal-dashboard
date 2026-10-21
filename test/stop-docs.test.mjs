import test from 'node:test';
import assert from 'node:assert/strict';
import { stopDocChips } from '../src/lib/stop-docs.ts';

/** חיווי מסמך מצורף ביומן (עידן, 21/10/2026). */

const kinds = (s) => stopDocChips(s).map((c) => c.kind);

test('אספקה עם תעודה שעוד לא נחתמה: "תעודה"', () => {
  assert.deepEqual(kinds({ sourceType: 'delivery', noteDocno: 'SH2604192' }), ['note']);
  assert.match(stopDocChips({ sourceType: 'delivery', noteDocno: 'SH2604192' })[0].title, /SH2604192/);
});

test('תעודה שנחתמה מוצגת פעם אחת, כ"נחתם"', () => {
  assert.deepEqual(kinds({ sourceType: 'delivery', noteDocno: 'SH1', signedCount: 1 }), ['signed']);
});

test('חתימה כפולה נספרת (רודי, 21/10: גרינפסט פעמיים)', () => {
  assert.equal(stopDocChips({ sourceType: 'delivery', signedCount: 2 })[0].label, '✍️ נחתם ×2');
});

test('לקוח חדש מקבל תעודה כמו אספקה', () => {
  assert.deepEqual(kinds({ sourceType: 'customer', noteDocno: 'SH2' }), ['note']);
});

test('קריאת שירות: טופס קריאה, וגם טופס תיקון חתום', () => {
  assert.deepEqual(kinds({ sourceType: 'service', hasCallDoc: true }), ['callDoc']);
  assert.deepEqual(kinds({ sourceType: 'service', hasCallDoc: true, signedCount: 1 }), ['signed', 'callDoc']);
});

test('איסוף: רק טופס החזרה חתום. תעודה לא שייכת לאיסוף', () => {
  assert.deepEqual(kinds({ sourceType: 'pickup', noteDocno: 'SH3' }), []);
  assert.deepEqual(kinds({ sourceType: 'pickup', signedCount: 1 }), ['signed']);
});

test('בלי מסמך: אין חיווי', () => {
  assert.deepEqual(kinds({ sourceType: 'delivery' }), []);
  assert.deepEqual(kinds({ sourceType: 'task', hasCallDoc: true }), []);
});
