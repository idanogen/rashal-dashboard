import test from 'node:test';
import assert from 'node:assert/strict';
import { lastTouchLine, historyHitLine, shortDate } from '../src/lib/history-line.ts';

const base = { visits: 0, lastVisitDate: null, lastVisitDriver: null, lastVisitOutcome: null, deliveries: 0, lastDeliveryDate: null, callsDone: 0, lastCallDate: null, lastCallBy: null };

test('no history at all reads as a new customer', () => {
  assert.equal(lastTouchLine(undefined).tone, 'new');
  assert.equal(lastTouchLine(base).text, 'לקוח חדש, אין ביקורים קודמים');
});

test('a visit from our calendar wins, with driver and outcome, and counts the rest', () => {
  const r = lastTouchLine({ ...base, visits: 3, lastVisitDate: '2026-08-14', lastVisitDriver: 'רודי', lastVisitOutcome: 'completed', deliveries: 3, callsDone: 1 });
  assert.equal(r.text, 'ביקור אחרון 14/08/26 · רודי · בוצע · 3 אספקות קודמות · קריאה קודמת');
  assert.equal(r.tone, 'good');
});

test('a not-completed last visit is red', () => {
  const r = lastTouchLine({ ...base, visits: 1, lastVisitDate: '2026-08-02', lastVisitDriver: 'דוד', lastVisitOutcome: 'not_completed' });
  assert.equal(r.tone, 'bad');
  assert.match(r.text, /לא בוצע/);
});

test('without a visit, the delivery note answers "when were we there"', () => {
  const r = lastTouchLine({ ...base, deliveries: 2, lastDeliveryDate: '2024-01-15' });
  assert.equal(r.text, 'אספקה אחרונה 15/01/24 · 2 אספקות');
});

test('a phone-only customer shows the last call and who closed it', () => {
  const r = lastTouchLine({ ...base, callsDone: 2, lastCallDate: '2026-03-11', lastCallBy: 'ישראל' });
  assert.equal(r.text, 'קריאה אחרונה 11/03/26 · ישראל · 2 קריאות');
});

const hit = {
  customerNumber: '05472701', customerName: 'חייט יעקב', phone: null, city: 'תל אביב',
  lastVisitDate: null, lastVisitDriver: null, lastVisitOutcome: null,
  lastOrderDate: '2026-07-28', lastOrderStatus: 'ממתין לתאום', lastOrderRef: 'SO2602911',
  lastCallDate: null, lastCallStatus: null, lastCallRef: null, lastCallBy: null, lastCallType: null,
  lastNoteDate: null, openOrders: 1, openCalls: 0, deliveries: 0,
};

test('open work is said first, then the latest event', () => {
  const r = historyHitLine(hit);
  assert.equal(r.text, 'הזמנה פתוחה · הזמנה 28/07/26 · ממתין לתאום');
  assert.equal(r.tone, 'bad');
});

test('the newest event wins across sources', () => {
  const r = historyHitLine({ ...hit, openOrders: 0, lastOrderStatus: 'סופק', lastNoteDate: '2026-08-01', lastVisitDate: '2026-08-14', lastVisitDriver: 'רודי', lastVisitOutcome: 'completed' });
  assert.equal(r.text, 'ביקור 14/08/26 · רודי · בוצע');
  assert.equal(r.tone, 'good');
});

/** 🔴 "מי סגר" הוא הטכנאי רק בקריאה פרונטלית; בטלפונית זו עובדת משרד ולא מציגים. */
test('the closer is named as technician only on frontal calls', () => {
  const frontal = historyHitLine({ ...hit, openOrders: 0, lastOrderDate: null, lastCallDate: '2026-03-11', lastCallStatus: 'בוצע', lastCallBy: 'ישראל', lastCallType: 'פרונטלית' });
  assert.match(frontal.text, /טכנאי ישראל/);
  const phone = historyHitLine({ ...hit, openOrders: 0, lastOrderDate: null, lastCallDate: '2026-03-11', lastCallStatus: 'בוצע', lastCallBy: 'שורה', lastCallType: 'טלפונית' });
  assert.doesNotMatch(phone.text, /שורה/);
});

test('short date handles ISO timestamps and empty values', () => {
  assert.equal(shortDate('2026-09-07T13:39:00Z'), '07/09/26');
  assert.equal(shortDate(null), '');
});

/** 🔴 שורה מהייבוא ההיסטורי בלי סטטוס שלנו אינה "פתוחה". */
test('an unknown call status is neither open nor closed', () => {
  const r = historyHitLine({ ...hit, openOrders: 0, lastOrderDate: null, lastCallDate: '2022-08-31', lastCallStatus: null, lastCallBy: 'אלכס', lastCallType: 'פרונטלית' });
  assert.equal(r.text, 'קריאת שירות 31/08/22 · טכנאי אלכס');
  assert.equal(r.tone, 'neutral');
});
