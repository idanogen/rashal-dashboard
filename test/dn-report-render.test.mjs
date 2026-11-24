import test from 'node:test';
import assert from 'node:assert/strict';
import { renderDnReport, fundLabel, money } from '../supabase/functions/rashal-dn-report/render.ts';

/** הדוח השבועי "תעודות שסופקו ועדיין לא נסגרו" (עידן 24/11/2026). */
const row = (docno, days, total, fund = 'מכבי שירותי בריאות') => ({
  docno, customer_name: 'לקוח ' + docno, city: 'חולון', fund, order_no: 'SO1',
  delivered_at: '2026-11-10T08:00:00Z', driver: 'רודי', days, total,
});
const opts = { date: '2026-11-27', minDays: 7, showAmounts: true };

test('שמות קופה קצרים', () => {
  assert.equal(fundLabel('מכבי שירותי בריאות'), 'מכבי');
  assert.equal(fundLabel('כללית הנדסה רפואית בעמ'), 'כללית');
  assert.equal(fundLabel(null), 'ללא קופה');
  assert.equal(fundLabel('משרד הבריאות'), 'משרד הבריאות');
});

test('הוותיקה ראשונה, ספירה וסכום', () => {
  const r = renderDnReport([row('SH2', 9, 1000), row('SH1', 29, 1972.4)], opts);
  assert.equal(r.count, 2);
  assert.ok(r.html.indexOf('SH1') < r.html.indexOf('SH2'));
  assert.ok(r.html.includes(money(2972.4)));
  assert.ok(r.subject.includes('2 תעודות'));
  assert.ok(r.html.includes('27/11/2026'));
});

test('בלי סכומים לא מופיע ₪', () => {
  const r = renderDnReport([row('SH1', 10, 500)], { ...opts, showAmounts: false });
  assert.ok(!r.html.includes('₪'));
});

test('שבוע ריק: מייל קצר שאומר שאין', () => {
  const r = renderDnReport([], opts);
  assert.equal(r.count, 0);
  assert.ok(r.html.includes('אין השבוע תעודות'));
  assert.ok(r.subject.includes('אין תעודות'));
});

test('בלי גרש ארוך ושמות מוגנים מ-HTML', () => {
  const r = renderDnReport([{ ...row('SH1', 10, 1), customer_name: 'א<b>ב' }], opts);
  assert.ok(!/[–—]/.test(r.html));
  assert.ok(r.html.includes('א&lt;b&gt;ב'));
});
