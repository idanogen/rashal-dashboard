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
