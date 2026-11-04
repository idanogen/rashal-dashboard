import test from 'node:test';
import assert from 'node:assert/strict';
import { stopSearchText, matchDatesByDay } from '../src/lib/calendar-view.ts';
import { matchesSearch } from '../src/lib/search-match.ts';

/** שורת החיפוש שמעל היומן (עידן, 04/11/2026): מסננת את המשובצים, לא את הממתינים. */
const stop = (over = {}) => ({
  id: 's1', deliveryDate: '2026-11-03', driver: 'רודי', sequence: 1, sourceType: 'service', status: 'planned',
  customerName: 'כהן דוד', customerNumber: '12345', phone: '052-1234567', address: 'הרצל 5', city: 'חולון',
  notes: 'החלפת מנוף', created: '', updated: '', ...over,
});

test('שם בסדר הפוך, מספר לקוח, טלפון חלקי, עיר, עובד והערה נמצאים', () => {
  const hay = stopSearchText(stop());
  for (const q of ['דוד כהן', '12345', '0521234', 'חולון', 'רודי', 'מנוף']) {
    assert.equal(matchesSearch(hay, q), true, q);
  }
  assert.equal(matchesSearch(hay, 'לוי'), false);
});

test('שדות ריקים לא מוסיפים רווחים ולא מפילים', () => {
  assert.equal(stopSearchText(stop({ notes: undefined, phone: '   ', customerNumber: undefined })), 'כהן דוד הרצל 5 חולון רודי');
});

test('הכתובת המקורית מפריוריטי נמצאת גם כשהניווט שונה', () => {
  const hay = stopSearchText(stop({ address: 'דרך השלום 1', originalAddress: 'הרצל 5' }));
  assert.equal(matchesSearch(hay, 'הרצל'), true);
});

test('ימי התוצאות ממוינים, נספרים, ובלי מבוטלות', () => {
  const dates = matchDatesByDay([
    stop({ id: 'a', deliveryDate: '2026-11-05' }),
    stop({ id: 'b', deliveryDate: '2026-11-03' }),
    stop({ id: 'c', deliveryDate: '2026-11-03' }),
    stop({ id: 'd', deliveryDate: '2026-11-02', status: 'cancelled' }),
  ]);
  assert.deepEqual(dates, [{ date: '2026-11-03', count: 2 }, { date: '2026-11-05', count: 1 }]);
});

test('צ\'יפי הימים: היום והבאים קודם, אחר כך העבר מהקרוב לרחוק', async () => {
  const { orderMatchDates } = await import('../src/lib/calendar-view.ts');
  const d = (date) => ({ date, count: 1 });
  const out = orderMatchDates([d('2026-04-23'), d('2026-11-05'), d('2026-11-02'), d('2026-11-04'), d('2026-06-01')], '2026-11-04');
  assert.deepEqual(out.map((x) => x.date), ['2026-11-04', '2026-11-05', '2026-11-02', '2026-06-01', '2026-04-23']);
});
