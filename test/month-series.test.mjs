import test from 'node:test';
import assert from 'node:assert/strict';
import { ordersVsNotesByMonth, seriesFrom, monthKey } from '../src/lib/month-series.ts';

/**
 * 🔴 מה שנבדק כאן הוא ש"הוזמנו" נספר מהספירה במסד (כולל ארכיון) ולא
 * מרשימת ההזמנות שהמסך טוען, ושסופקו נספר מתעודות משלוח ולא מעצירות.
 * שלומי, 03/09/2026: אפריל הראה 83 כשבפריוריטי נפתחו 255.
 */
const now = new Date(2026, 8, 3, 12); // 03/09/2026

test('שישה חודשים: אפריל עד ספטמבר, בסדר עולה, אפס ולא חור', () => {
  const s = ordersVsNotesByMonth([], [], 6, now);
  assert.deepEqual(s.map((x) => x.label), ['אפר', 'מאי', 'יונ', 'יול', 'אוג', 'ספט']);
  assert.ok(s.every((x) => x.a === 0 && x.b === 0));
  assert.equal(monthKey(seriesFrom(6, now)), '2026-04');
});

test('הוזמנו = נפתחו פחות מבוטלות, מהספירה במסד, גם אם ההזמנות עצמן בארכיון', () => {
  const s = ordersVsNotesByMonth(
    [
      { month: '2026-04-01', opened: 653, cancelled: 31 },
      { month: '2026-08-01', opened: 465, cancelled: 44 },
      { month: '2025-12-01', opened: 999, cancelled: 0 }, // מחוץ לחלון
    ],
    [],
    6,
    now,
  );
  assert.equal(s[0].a, 622);
  assert.equal(s[4].a, 421);
  assert.equal(s.reduce((n, x) => n + x.a, 0), 622 + 421);
});

test('סופקו = תעודות משלוח לפי תאריך התעודה, בלי מבוטלות ובלי חסרות תאריך', () => {
  const s = ordersVsNotesByMonth(
    [],
    [
      { status: 'סופית', docDate: '2026-07-14' },
      { status: 'טיוטא', docDate: '2026-07-30' },
      { status: 'מבוטלת', docDate: '2026-07-02' },
      { status: 'סופית', docDate: null },
      { status: 'סופית', docDate: '2026-09-01' },
    ],
    6,
    now,
  );
  assert.equal(s[3].b, 2); // יולי: סופית + טיוטא
  assert.equal(s[5].b, 1); // ספטמבר
});

test('חודש שמגיע כ-timestamp של חצות UTC לא זולג לחודש הקודם', () => {
  const s = ordersVsNotesByMonth([{ month: '2026-06-01T00:00:00+00:00', opened: 10, cancelled: 0 }], [], 6, now);
  assert.equal(s[2].a, 10); // יוני
});
