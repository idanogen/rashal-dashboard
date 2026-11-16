import test from 'node:test';
import assert from 'node:assert/strict';
import { timelineSourceForStop } from '../src/lib/timeline-source.ts';

/** הודעת מערכת של עצירה נרשמת על ההזמנה, על הקריאה, או על העצירה (16/11/2026). */

test('אספקה עם הזמנה: על ההזמנה', () => {
  assert.deepEqual(timelineSourceForStop({ stopId: 's1', sourceType: 'delivery', sourceId: 'o1' }), { kind: 'order', id: 'o1' });
});

test('שירות: על הקריאה', () => {
  assert.deepEqual(timelineSourceForStop({ stopId: 's1', sourceType: 'service', sourceId: 'c1' }), { kind: 'service', id: 'c1' });
});

test('איסוף, לקוח חדש, בדיקה ומשימה: על העצירה, גם כשיש מזהה מקור', () => {
  for (const sourceType of ['pickup', 'customer', 'inspection', 'task']) {
    assert.deepEqual(timelineSourceForStop({ stopId: 's1', sourceType, sourceId: 'p1' }), { kind: 'stop', id: 's1' }, sourceType);
  }
});

test('אספקה בלי מזהה הזמנה: על העצירה', () => {
  assert.deepEqual(timelineSourceForStop({ stopId: 's1', sourceType: 'delivery', sourceId: null }), { kind: 'stop', id: 's1' });
});
