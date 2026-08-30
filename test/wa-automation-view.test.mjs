import test from 'node:test';
import assert from 'node:assert/strict';
import { engineState, ENGINE_STATE_CLASS, sinceLabel } from '../src/lib/wa-automation-view.ts';

/**
 * חדר הבקרה (30/08/2026). הבדיקה מגנה על ההבחנה שקל למחוק בטעות:
 * מצב יבש אינו "פעיל" ואינו "כבוי", והוא חייב להיראות שונה משניהם,
 * כי מסך שמציג "פעיל" על מנוע שלא שולח הוא בדיוק השקר שנתפס ב-11/08.
 */

test('🔴 שלושה מצבים נבדלים: פעיל, יבש, כבוי', () => {
  assert.deepEqual(engineState(true, false), { label: 'פעיל', tone: 'green' });
  assert.deepEqual(engineState(true, true), { label: 'מצב יבש', tone: 'amber' });
  assert.deepEqual(engineState(false, false), { label: 'כבוי', tone: 'gray' });
});

test('🔴 כבוי מנצח יבש: מנוע כבוי הוא כבוי גם אם דגל היובש דולק', () => {
  assert.equal(engineState(false, true).label, 'כבוי');
});

test('לכל טון יש מחלקת עיצוב', () => {
  for (const s of [engineState(true, false), engineState(true, true), engineState(false, false)]) {
    assert.ok(ENGINE_STATE_CLASS[s.tone]);
  }
});

test('sinceLabel: דקות, שעה, שעות, ותאריך לישן', () => {
  const now = new Date('2026-08-30T14:00:00');
  assert.equal(sinceLabel('2026-08-30T13:59:40', now), 'ממש עכשיו');
  assert.equal(sinceLabel('2026-08-30T13:45:00', now), 'לפני 15 דקות');
  assert.equal(sinceLabel('2026-08-30T13:00:00', now), 'לפני שעה');
  assert.equal(sinceLabel('2026-08-30T09:00:00', now), 'לפני 5 שעות');
  assert.equal(sinceLabel('2026-08-12T09:00:00', now), '12/08/26');
  assert.equal(sinceLabel(null, now), '');
});
