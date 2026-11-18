import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FUND_SHEET_HEADER, classifyItem, compareSources, conditionLabel, defaultReportPeriod, fundSheetRow, parsePickupsReport,
} from '../src/lib/pickups-report.ts';

/** דוח איסופים לקופה משני מקורות (שלומי 17/11, עידן 18/11/2026). */

const raw = {
  fund: 'מכבי', from: '2026-10-10', to: '2026-11-09',
  priority: [
    {
      rt: 'RT1', name: 'כהן נגה', tz: '46576849', picked: '2026-10-12', part: 'G175',
      item: 'מנוף חשמלי SUNRISE MEDICAL למשקל עד 175 ק"ג', reason: null, warehouse: 'משרד הבריאות', purchased: '2024-10-27',
    },
    { rt: 'RT2', name: 'לוי', tz: '1', picked: '2026-10-13', part: '218RAFPS', item: 'גרדיאן שלמות רוחב 45', reason: null, warehouse: null, purchased: null },
  ],
  app: [
    {
      rt: 'RT1', name: 'כהן נגה', tz: '46576849', picked: '2026-10-12', driver: 'אבי', item: 'מנוף 175', part: 'G175',
      serial: 'S1', reason: 'פטירה', condition: 'ok', has_form: true, purchased: '2024-10-27',
    },
    {
      rt: 'RT3', name: 'גומה', tz: '2', picked: '2026-10-20', driver: null, item: 'כסא שירותים BATHMOBILE', part: null,
      serial: null, reason: null, condition: null, has_form: false, purchased: null,
    },
  ],
};

test('פענוח: דגל טופס וערכים ריקים', () => {
  const r = parsePickupsReport(raw);
  assert.equal(r.priority.length, 2);
  assert.equal(r.app[0].hasForm, true);
  assert.equal(r.app[1].hasForm, false);
  assert.equal(r.priority[0].reason, null);
  assert.deepEqual(parsePickupsReport(null).app, []);
});

test('השוואה לפי מספר תעודה', () => {
  const c = compareSources(parsePickupsReport(raw));
  assert.deepEqual(c.both, ['RT1']);
  assert.deepEqual(c.priorityOnly.map((x) => x.rt), ['RT2']);
  assert.deepEqual(c.appOnly.map((x) => x.rt), ['RT3']);
});

test('תקופה: מה-10 עד ה-9, לפי היום בחודש', () => {
  assert.deepEqual(defaultReportPeriod(new Date(2026, 10, 18)), { from: '2026-10-10', to: '2026-11-09' });
  assert.deepEqual(defaultReportPeriod(new Date(2026, 10, 5)), { from: '2026-09-10', to: '2026-10-09' });
  assert.deepEqual(defaultReportPeriod(new Date(2026, 0, 3)), { from: '2025-11-10', to: '2025-12-09' });
});

test('סיווג פריט בשפה של הקובץ', () => {
  assert.deepEqual(classifyItem('מנוף חשמלי SUNRISE MEDICAL למשקל עד 175 ק"ג', 'G175'), { name: 'מנוף', kind: 'מנוף', model: 'מנוף 175' });
  assert.deepEqual(classifyItem('גב הטיה גרדיאן ר.פ. רוחב 40', '4R16RAFPE'), { name: 'כג רמה 3', kind: 'כג', model: 'גרדיאן גב הטיה' });
  assert.equal(classifyItem('כסא גלגלים 43*46 RUBIX אדום', 'RUBIX43*46R').model, 'רוביקס');
  assert.equal(classifyItem('כסא שירותים BATHMOBILE', null).name, 'כיסא רחצה');
  assert.equal(classifyItem('משהו אחר', 'X1').name, 'משהו אחר');
});

test('שורת קובץ: עמודות כמו בקובץ הקופה, וחסר להשלמה', () => {
  const r = parsePickupsReport(raw);
  const a = fundSheetRow(r.app[0]);
  assert.equal(a.length, FUND_SHEET_HEADER.length);
  assert.deepEqual(a.slice(0, 10), ['כהן נגה', '46576849', 'איסוף', '27/10/2024', '12/10/2026', 'מנוף', 'מנוף', 'מנוף 175', 'S1', 'פטירה']);
  assert.equal(a[12], 'תקין');
  assert.equal(a[14], '');
  assert.equal(fundSheetRow(r.priority[1])[14], 'סריאלי, סיבה, תאריך רכישה');
  assert.equal(conditionLabel('broken'), 'פגום');
});

test('המסד מחזיר את השדות שהקובץ מפענח', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261118_pickups_fund_report.sql', import.meta.url), 'utf8');
  for (const f of ['rt', 'name', 'tz', 'picked', 'part', 'item', 'reason', 'warehouse', 'purchased', 'driver', 'serial', 'condition', 'has_form']) {
    assert.match(sql, new RegExp(`(as|d\\.) ?${f}\\b`), f);
  }
  assert.match(sql, /'priority', /);
  assert.match(sql, /'app', /);
});
