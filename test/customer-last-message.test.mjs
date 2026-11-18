import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { quoteLine, whenLabel, rowToLastInbound, WA_DOCK_OPEN_EVENT } from '../src/lib/customer-last-message.ts';

/** ההודעה האחרונה של הלקוח על כרטיס הקריאה (עידן, 18/11/2026). */

test('הציטוט: קצר, בלי ירידות שורה, ותמונה בלי טקסט', () => {
  assert.equal(quoteLine({ body: 'אין לי\nאיך לצלם', hasMedia: false }), 'אין לי איך לצלם');
  assert.equal(quoteLine({ body: null, hasMedia: true }), '📷 שלח תמונה');
  const long = 'א'.repeat(80);
  assert.equal(quoteLine({ body: long, hasMedia: false }).length, 60);
  assert.ok(quoteLine({ body: long, hasMedia: false }).endsWith('…'));
});

test('השעה: היום שעה, אחרת תאריך', () => {
  const now = new Date('2026-11-18T10:00:00Z');
  assert.match(whenLabel('2026-11-18T07:14:00Z', now), /09:14/);
  assert.match(whenLabel('2026-11-17T07:14:00Z', now), /17/);
});

test('שורה ממופה, ונקודה כחולה רק כשבאמת לא נקרא', () => {
  const m = rowToLastInbound({ service_call_id: 'c', phone_local: '0501234567', body: 'היי', has_media: null, at: 'x', unread: null });
  assert.equal(m.unread, false);
  assert.equal(m.hasMedia, false);
});

test('תיבת השיחות מאזינה לאותו אירוע שהכרטיס שולח', () => {
  const dock = readFileSync(new URL('../src/components/wa/WaDock.tsx', import.meta.url), 'utf8');
  const footer = readFileSync(new URL('../src/components/service-calls/last-message-footer.tsx', import.meta.url), 'utf8');
  assert.match(dock, /WA_DOCK_OPEN_EVENT/);
  assert.match(footer, /WA_DOCK_OPEN_EVENT/);
  assert.equal(WA_DOCK_OPEN_EVENT, 'wa-dock:open');
});
