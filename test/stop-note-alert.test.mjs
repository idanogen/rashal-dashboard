import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { officeAlertNote } from '../src/lib/stop-note-alert.ts';

/** הערת המשרד באדום לטכנאי (עמי ושלומי, 11/11/2026). */

test('ביקור שירות עם הערה: מוצגת באדום, בלי רווחים בקצוות', () => {
  assert.equal(officeAlertNote({ sourceType: 'service', notes: '  לא בבית, בבית הספר ' }), 'לא בבית, בבית הספר');
  assert.equal(officeAlertNote({ sourceType: 'delivery', notes: 'מסירה לשיקומית' }), 'מסירה לשיקומית');
  assert.equal(officeAlertNote({ sourceType: 'pickup', notes: 'x' }), 'x');
});

test('משימה: notes הוא תיאור המשימה, לא התראה', () => {
  assert.equal(officeAlertNote({ sourceType: 'task', notes: 'מטען לא מטעין' }), null);
  assert.equal(officeAlertNote({ sourceType: 'customer', notes: 'בדיקה' }), null);
});

test('הערה ריקה או רווחים: אין התראה', () => {
  assert.equal(officeAlertNote({ sourceType: 'service', notes: '   ' }), null);
  assert.equal(officeAlertNote({ sourceType: 'service', notes: null }), null);
  assert.equal(officeAlertNote({ sourceType: 'service' }), null);
});

test('דיאלוג התיאום נפתח עם ההערה הקיימת ולא דורס אותה בריק', () => {
  const src = readFileSync(new URL('../src/components/whatsapp/ScheduleCoordinationDialog.tsx', import.meta.url), 'utf8');
  assert.match(src, /setNote\(stop\.notes \?\? ''\)/);
  assert.doesNotMatch(src, /setNote\(''\)/);
});

test('תצוגת היומן מעבירה את notes לדיאלוג', () => {
  const src = readFileSync(new URL('../src/lib/calendar-view.ts', import.meta.url), 'utf8');
  assert.match(src, /\n\s+notes: s\.notes,/);
});
