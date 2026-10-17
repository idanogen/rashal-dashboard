import test from 'node:test';
import assert from 'node:assert/strict';
import { isStaleBuild } from '../src/lib/app-version.ts';

test('a different build id on the server means the tab is running old code', () => {
  assert.equal(isStaleBuild('af861d8c1234', '15b8ad1e9999'), true);
});

test('the same id is not stale', () => {
  assert.equal(isStaleBuild('af861d8c1234', 'af861d8c1234'), false);
});

/**
 * 🔴 הבדיקה החשובה כאן. "לא הצלחתי לשאול" חייב להיות שקט, אחרת כל גמגום
 * רשת מרים פס רענון והפס מאבד את המשמעות שלו.
 */
test('no answer from the server is never a new version', () => {
  assert.equal(isStaleBuild('af861d8c1234', null), false);
});

test('development never nags', () => {
  assert.equal(isStaleBuild('dev', '15b8ad1e9999'), false);
  assert.equal(isStaleBuild('', '15b8ad1e9999'), false);
});

// ─── רענון לבד ברגע בטוח (13/10/2026) ─────────────────────────────────────
import { autoReloadReason, guardAllows, parseGuard, AUTO_RELOAD_IDLE_MS, AUTO_RELOAD_GUARD_MS } from '../src/lib/app-version.ts';

const base = { hidden: false, idleMs: 0, openDialog: false, draftText: false };

test('לשונית ברקע מתרעננת מיד', () => {
  assert.equal(autoReloadReason({ ...base, hidden: true }), 'hidden');
});

test('🔴 לשונית ברקע עם טיוטה או חלון פתוח לא מתרעננת: חוזרים לטיוטה', () => {
  assert.equal(autoReloadReason({ ...base, hidden: true, draftText: true }), null);
  assert.equal(autoReloadReason({ ...base, hidden: true, openDialog: true }), null);
});

test('מסך גלוי בשימוש לא מתרענן', () => {
  assert.equal(autoReloadReason({ ...base, idleMs: AUTO_RELOAD_IDLE_MS - 1 }), null);
});

test('מסך גלוי שלא נגעו בו שתי דקות מתרענן', () => {
  assert.equal(autoReloadReason({ ...base, idleMs: AUTO_RELOAD_IDLE_MS }), 'idle');
});

test('🔴 חלון פתוח או טיוטה חוסמים רענון גם אחרי שעה בלי פעילות', () => {
  assert.equal(autoReloadReason({ ...base, idleMs: 3600_000, openDialog: true }), null);
  assert.equal(autoReloadReason({ ...base, idleMs: 3600_000, draftText: true }), null);
});

test('🔴 שומר הלולאה: לא מרעננים פעמיים לאותה גרסה בתוך עשר דקות', () => {
  const now = 1_000_000_000;
  assert.equal(guardAllows('v2', null, now), true);
  assert.equal(guardAllows('v2', { build: 'v2', at: now - 1000 }, now), false);
  assert.equal(guardAllows('v2', { build: 'v2', at: now - AUTO_RELOAD_GUARD_MS }, now), true);
  assert.equal(guardAllows('v3', { build: 'v2', at: now - 1000 }, now), true);
});

test('שומר פגום או ריק = אין שומר', () => {
  assert.equal(parseGuard(null), null);
  assert.equal(parseGuard('{oops'), null);
  assert.equal(parseGuard('{"build":1,"at":"x"}'), null);
  assert.deepEqual(parseGuard('{"build":"v2","at":5}'), { build: 'v2', at: 5 });
});
