import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  rowToArchivedCall, archiveReasonLabel, matchesArchiveSearch, ARCHIVE_SCREEN_FILTER,
} from '../src/lib/calls-archive-rules.ts';

/** ארכיון קריאות השירות (עידן, 18/11/2026). */

const row = (over = {}) => ({
  id: 'c1', priority_call_id: 'SC2601398', customer_name: 'שבו יהודה', customer_number: '017516057',
  phone: '052-3116815', city: 'עיילבון', priority_status: 'שובצה', created_at: '2026-05-11T08:00:00Z',
  archived_at: '2026-11-18T05:00:00Z', archived_reason: 'cleanup-20261118:status', ...over,
});

test('סיבת הארכיון במילים של המשרד', () => {
  assert.equal(archiveReasonLabel('cleanup-20261118:status', 'שובצה'), 'סטטוס בפריוריטי: שובצה');
  assert.equal(archiveReasonLabel('rule:טופל טכנאי', null), 'סטטוס בפריוריטי: טופל טכנאי');
  assert.equal(archiveReasonLabel('cleanup-20261118:legacy', 'לביצוע'), 'קריאה ישנה שלא שובצה אצלנו');
  assert.equal(archiveReasonLabel('cleanup-20261118:no-sc', null), 'בלי מספר קריאה (מערכת קודמת)');
});

test('חיפוש: שם בכל סדר, מספר קריאה, טלפון בלי מקפים', () => {
  const c = rowToArchivedCall(row());
  assert.equal(matchesArchiveSearch(c, ''), true);
  assert.equal(matchesArchiveSearch(c, 'יהודה שבו'), true);
  assert.equal(matchesArchiveSearch(c, 'sc2601398'), true);
  assert.equal(matchesArchiveSearch(c, '0523116815'), true);
  assert.equal(matchesArchiveSearch(c, 'כהן'), false);
});

test('המסך והמיגרציה מדברים על אותן סיבות ארכיון', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261118_calls_archive_rule.sql', import.meta.url), 'utf8');
  assert.match(sql, /'rule:' \|\| new\.priority_status/);
  assert.match(sql, /'cleanup-20261118:/);
  assert.match(ARCHIVE_SCREEN_FILTER, /rule:\*/);
  assert.match(ARCHIVE_SCREEN_FILTER, /cleanup-20261118\*/);
});
