import test from 'node:test';
import assert from 'node:assert/strict';
import { isPendingPickup } from '../src/lib/pending-pickup.ts';

test('ממתין לתאום, גם בלי סטטוס אצלנו', () => {
  assert.equal(isPendingPickup({ pickupStatus: 'ממתין לתאום' }), true);
  assert.equal(isPendingPickup({}), true);
});

test('כפילות, נאסף, או סגור/מבוטל בפריוריטי: לא ממתין', () => {
  assert.equal(isPendingPickup({ duplicateOf: 'x' }), false);
  assert.equal(isPendingPickup({ pickupStatus: 'נאסף' }), false);
  assert.equal(isPendingPickup({ priorityStatus: 'סופית' }), false);
  assert.equal(isPendingPickup({ priorityStatus: 'מבוטלת' }), false);
});
