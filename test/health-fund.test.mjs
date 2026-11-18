import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { countByFund, healthFundKey, HEALTH_FUND_ORDER } from '../src/lib/health-fund.ts';

/** סינון לפי קופה במסך הסדרן (עידן, 04/11/2026). */

test('הערכים הלא אחידים של פריוריטי מתנרמלים למפתח אחד לכל קופה', () => {
  assert.equal(healthFundKey('כללית הנדסה'), 'clalit');
  assert.equal(healthFundKey('כללית הנדסה רפואית בעמ'), 'clalit');
  assert.equal(healthFundKey('כללית'), 'clalit');
  assert.equal(healthFundKey('מכבי'), 'maccabi');
  assert.equal(healthFundKey('קופת חולים לאומית'), 'leumit');
  assert.equal(healthFundKey('קופת חולים מאוחדת'), 'meuhedet');
  assert.equal(healthFundKey('משרד הבריאות'), 'moh');
  assert.equal(healthFundKey('לשכת בריאות רחובות'), 'moh');
  assert.equal(healthFundKey('משרד הבטחון'), 'mod');
});

test('🔴 ריק הוא "ללא קופה" ולא נעלם; לא מזוהה הוא "אחר"', () => {
  assert.equal(healthFundKey(''), 'none');
  assert.equal(healthFundKey(null), 'none');
  assert.equal(healthFundKey('  '), 'none');
  assert.equal(healthFundKey('ביטוח לאומי פעלות איבה'), 'other');
  assert.equal(healthFundKey('שירותים'), 'other');
});

test('הספירה שומרת על הסדר הקבוע ומשמיטה קופות ריקות', () => {
  const out = countByFund(['moh', 'clalit', 'clalit', 'none', 'maccabi']);
  assert.deepEqual(out, [{ key: 'clalit', count: 2 }, { key: 'maccabi', count: 1 }, { key: 'moh', count: 1 }, { key: 'none', count: 1 }]);
  assert.equal(HEALTH_FUND_ORDER[0], 'clalit');
});

test('הקופה של רשומה: המשלם קודם, סוג הלקוח רק כשאין משלם (18/11/2026)', async () => {
  const { recordFund } = await import('../src/lib/health-fund.ts');
  assert.equal(recordFund('כללית הנדסה רפואית בעמ', 'משרד הבריאות'), 'clalit');
  assert.equal(recordFund('קופת חולים מכבי מחוז השפלה', null), 'maccabi');
  assert.equal(recordFund(null, 'לאומית'), 'leumit');
  assert.equal(recordFund('', 'משרד הבריאות'), 'moh');
  assert.equal(recordFund(null, null), 'none');
});

test('הסנכרון מושך את המשלם בקריאה ובהזמנה', () => {
  const sync = readFileSync(new URL('../supabase/functions/rashal-sync/index.ts', import.meta.url), 'utf8');
  const inbox = readFileSync(new URL('../api/priority-sync.ts', import.meta.url), 'utf8');
  assert.match(sync, /TOPP_PAYCUSTDES/);
  assert.equal((sync.match(/Y_151_0_ESHB,MARK_PAYCUSTDES/g) ?? []).length, 3);
  assert.match(inbox, /payer_fund: s\(r\.TOPP_PAYCUSTDES\)/);
  assert.match(inbox, /payer_fund: s\(r\.MARK_PAYCUSTDES\)/);
});
