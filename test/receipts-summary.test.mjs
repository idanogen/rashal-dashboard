import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeReceipts, receiptsFrom, monthKeyOf, receiptKindLabel } from '../src/lib/receipts-summary.ts';

const now = new Date(2026, 8, 3, 12); // 03/09/2026

test('החודש מול חודש קודם, לפי לקוח, ממוין לפי החודש הנוכחי', () => {
  const s = summarizeReceipts([
    { month: '2026-09-01', customerNumber: 'A', customerName: 'לאומית', n: 1, total: 199843 },
    { month: '2026-08-01', customerNumber: 'B', customerName: 'מכבי', n: 2, total: 541835 },
    { month: '2026-08-01', customerNumber: 'C', customerName: 'מאוחדת', n: 1, total: 324491 },
    { month: '2026-09-01', customerNumber: 'C', customerName: 'מאוחדת', n: 1, total: 1000 },
    { month: '2026-07-01', customerNumber: 'B', customerName: 'מכבי', n: 1, total: 999999 }, // מחוץ לחלון
  ], now);
  assert.equal(s.thisMonth, 200843);
  assert.equal(s.thisMonthCount, 2);
  assert.equal(s.prevMonth, 866326);
  assert.deepEqual(s.byCustomer.map((c) => c.customerName), ['לאומית', 'מאוחדת', 'מכבי']);
  assert.equal(s.byCustomer[2].prevMonth, 541835);
});

test('זיכוי שלילי מקטין את הסכום ולא נעלם', () => {
  const s = summarizeReceipts([
    { month: '2026-09-01', customerNumber: 'P', customerName: 'פרטי', n: 1, total: 783 },
    { month: '2026-09-01', customerNumber: 'P', customerName: 'פרטי', n: 1, total: -234 },
  ], now);
  assert.equal(s.thisMonth, 549);
});

test('חלון השליפה מתחיל בחודש הקודם, ומפתח חודש מקומי', () => {
  assert.equal(monthKeyOf(receiptsFrom(now)), '2026-08');
  assert.equal(monthKeyOf(new Date(2026, 0, 31)), '2026-01');
});

test('סוג הקבלה לפי הקידומת, ונפילה לסוג המסמך', () => {
  assert.equal(receiptKindLabel('RC2600173'), 'קבלה');
  assert.equal(receiptKindLabel('OV2600901'), 'חשבונית מס קבלה');
  assert.equal(receiptKindLabel('ON2600058'), 'זיכוי חשבונית מס קבלה');
  assert.equal(receiptKindLabel(null, 'E'), 'חשבונית מס קבלה');
});
