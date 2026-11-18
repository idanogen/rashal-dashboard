import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  orderArchiveReasonLabel, rowToArchivedOrder, ORDERS_ARCHIVE_FILTER, ORDER_ARCHIVE_MANUAL, ORDER_ARCHIVE_RESTORED,
} from '../src/lib/orders-archive-rules.ts';
import { matchesArchiveSearch } from '../src/lib/calls-archive-rules.ts';

/** ארכיון ההזמנות (עידן, 18/11/2026). */

const row = {
  id: 'o1', priority_order_id: 'SO2601234', customer_name: 'מורביה נעומי', customer_number: '031234567',
  phone: '050-1234567', city: 'חיפה', priority_status: 'בוצעה', created_at: '2026-04-20T08:00:00Z',
  archived_at: '2026-11-18T07:00:00Z', archived_reason: 'rule:billed-30d',
};

test('סיבה במילים של המשרד', () => {
  assert.match(orderArchiveReasonLabel('rule:billed-30d', 'שולמה'), /שולמה בפריוריטי, מעל 30 יום/);
  assert.match(orderArchiveReasonLabel('rule:approved-90d', 'מאושרת לבצוע'), /מעל 90 יום/);
  assert.equal(orderArchiveReasonLabel(ORDER_ARCHIVE_MANUAL, null), 'הועברה ידנית');
});

test('אותו חיפוש כמו בארכיון הקריאות: מספר הזמנה, שם בכל סדר, טלפון בלי מקפים', () => {
  const o = rowToArchivedOrder(row);
  assert.ok(matchesArchiveSearch(o, 'SO2601234'));
  assert.ok(matchesArchiveSearch(o, 'נעומי מורביה'));
  assert.ok(matchesArchiveSearch(o, '0501234567'));
  assert.ok(!matchesArchiveSearch(o, 'באר שבע'));
});

test('המסך מציג רק את הכלל והידני, לא את הארכיון הישן מאוגוסט', () => {
  assert.match(ORDERS_ARCHIVE_FILTER, /rule:\*/);
  assert.match(ORDERS_ARCHIVE_FILTER, /manual/);
  assert.doesNotMatch(ORDERS_ARCHIVE_FILTER, /webhook|backfill/);
});

test('הכלל במסד מדלג על הזמנה שהוחזרה, ולא נוגע בהזמנה ששובצה ביומן', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261118_orders_archive_rule.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes(`is distinct from '${ORDER_ARCHIVE_RESTORED}'`));
  assert.match(sql, /not exists \(select 1 from calendar_stops cs where cs\.order_id = o\.id\)/);
  assert.match(sql, /interval '30 days'/);
  assert.match(sql, /interval '90 days'/);
});
