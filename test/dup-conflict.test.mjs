import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isOtherDocument, stopRecordId } from '../src/lib/dup-conflict.ts';

/** שני איסופים לאותו לקוח, מנוף וכיסא (עמי, 22/10/2026). */

test('איסוף אחר לאותו לקוח: מותר לשבץ גם אותו', () => {
  assert.equal(isOtherDocument('pickup', 'chair', [{ pickupId: 'crane' }]), true);
});

test('אותו איסוף פעמיים: נחסם', () => {
  assert.equal(isOtherDocument('pickup', 'crane', [{ pickupId: 'crane' }]), false);
});

test('אחד מהקיימים הוא אותו מסמך: נחסם', () => {
  assert.equal(isOtherDocument('delivery', 'o2', [{ orderId: 'o1' }, { orderId: 'o2' }]), false);
});

test('שיבוץ קיים בלי מסמך: נחסם, כמו המדד', () => {
  assert.equal(isOtherDocument('service', 'c1', [{}]), false);
});

test('לקוח חדש: אין מסמך, החסימה נשארת', () => {
  assert.equal(isOtherDocument('customer', '123', [{}]), false);
});

test('מזהה המסמך באותו סדר כמו המדד', () => {
  assert.equal(stopRecordId({ orderId: 'o', pickupId: 'p' }), 'o');
  assert.equal(stopRecordId({ serviceCallId: 's' }), 's');
});

test('המדד במיגרציה כולל את המסמך באותו סדר', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261022_dup_guard_by_source_record.sql', import.meta.url), 'utf8');
  assert.match(sql, /coalesce\(order_id::text, service_call_id::text, pickup_id::text, inspection_id::text, ''\)/);
});
