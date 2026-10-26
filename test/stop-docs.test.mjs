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

/** אספקת מנוף בלי אישור הדרכה (עמי, 25/10/2026: לוזון). */

test('אספקת מנוף שנסגרה בלי טופס הדרכה: חיווי אדום', () => {
  const s = { sourceType: 'delivery', completed: true, craneKind: 'training', craneSigned: false };
  assert.deepEqual(kinds(s), ['crane', 'missingTraining']);
  assert.match(stopDocChips(s)[1].label, /בלי הדרכה/);
});

test('החיווי רק אחרי סגירה: עצירה עתידית בלי טופס היא מצב תקין', () => {
  assert.deepEqual(kinds({ sourceType: 'delivery', completed: false, craneKind: 'training', craneSigned: false }), ['crane']);
});

test('טופס הדרכה שמולא מכבה את החיווי', () => {
  assert.deepEqual(kinds({ sourceType: 'delivery', completed: true, craneKind: 'training', craneSigned: true }), ['crane']);
});

test('קריאת שירות על מנוף אינה מקבלת את חיווי ההדרכה (לה יש רשימת בדיקה)', () => {
  assert.deepEqual(kinds({ sourceType: 'service', completed: true, craneKind: 'inspection', craneSigned: false }), ['crane']);
});

test('החיווי מצטרף לחיוויי המסמכים ולא מחליף אותם', () => {
  assert.deepEqual(
    kinds({ sourceType: 'delivery', completed: true, craneKind: 'training', craneSigned: false, signedCount: 1 }),
    ['crane', 'signed', 'missingTraining'],
  );
});

/** 🏗️ מנוף כבר בשיבוץ (עידן, 26/10/2026). */

test('אספקת מנוף מקבלת 🏗️ ראשון, עוד לפני שנסגרה', () => {
  const chips = stopDocChips({ sourceType: 'delivery', craneKind: 'training', craneSigned: false });
  assert.deepEqual(chips.map((c) => c.kind), ['crane']);
  assert.equal(chips[0].label, '🏗️ מנוף');
  assert.match(chips[0].title, /אישור הדרכה/);
});

test('קריאה אצל מנוף מקבלת 🏗️ עם רשימת הבדיקה', () => {
  assert.match(stopDocChips({ sourceType: 'service', craneKind: 'inspection' })[0].title, /רשימת הבדיקה/);
});

test('טופס מנוף שנחתם: 🏗️ מנוף ✓ ובלי "בלי הדרכה"', () => {
  const chips = stopDocChips({ sourceType: 'delivery', completed: true, craneKind: 'training', craneSigned: true });
  assert.deepEqual(chips.map((c) => c.label), ['🏗️ מנוף ✓']);
});

test('בלי מנוף אין 🏗️', () => {
  assert.deepEqual(kinds({ sourceType: 'delivery', craneKind: null }), []);
});
