import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FULL_TRANSFORM, THUMB_TRANSFORM, groupPastMediaByDay, mergePages, nextCursor, parsePastMedia, pastMediaDayTitle, pastMediaKey,
} from '../src/lib/media-history.ts';

/** תמונות עבר של לקוח (עידן, 18/11/2026). */

const raw = {
  total: 3,
  customer_number: '316581214',
  items: [
    { src: 'customer', bucket: 'wa-media', path: 'c/m/a.jpg', type: 'image', at: '2026-11-11T16:04:30+00:00', by: 'הלקוח', ref: null },
    { src: 'tech', bucket: 'timeline-files', path: 's/b.jpg', type: 'image', at: '2026-11-11T09:00:00+00:00', by: 'אבי', ref: 'SC2604136' },
    { src: 'tech', bucket: 'timeline-files', path: 's/c.mp4', type: 'video', at: '2026-10-02T09:00:00+00:00', by: '', ref: '' },
    { bucket: 'x' },
  ],
};

test('פענוח: שורה בלי נתיב נזרקת, ריק הופך ל-null', () => {
  const p = parsePastMedia(raw);
  assert.equal(p.items.length, 3);
  assert.equal(p.total, 3);
  assert.equal(p.customerNumber, '316581214');
  assert.equal(p.items[2].by, null);
  assert.equal(p.items[2].ref, null);
  assert.equal(p.items[2].type, 'video');
  assert.deepEqual(parsePastMedia(null), { items: [], total: 0, customerNumber: null });
});

test('מוקטן תמיד עם רוחב וגובה (render/image חותך בלי גובה)', () => {
  for (const t of [THUMB_TRANSFORM, FULL_TRANSFORM]) assert.ok(t.width > 0 && t.height > 0);
  assert.equal(pastMediaKey({ bucket: 'wa-media', path: 'a/b.jpg' }), 'wa-media/a/b.jpg');
});

test('עמודים: סמן מהאחרון, ובלי כפילויות בגבול', () => {
  const p = parsePastMedia(raw);
  assert.equal(nextCursor(p.items.slice(0, 2), 3), '2026-11-11T09:00:00+00:00');
  assert.equal(nextCursor(p.items, 3), null);
  assert.equal(mergePages(p.items.slice(0, 2), p.items.slice(1)).length, 3);
});

test('קבוצה לכל יום עם מי ואיזו קריאה', () => {
  const g = groupPastMediaByDay(parsePastMedia(raw).items);
  assert.equal(g.length, 2);
  assert.equal(g[0].items.length, 2);
  assert.match(pastMediaDayTitle(g[0]), /^11\/11\/26 · הלקוח, אבי · SC2604136$/);
  assert.match(pastMediaDayTitle(g[1]), /^02\/10\/26 · צוות$/);
});

test('המסד: הפונקציה מחזירה את השדות שהקובץ מפענח, ונהג רואה כל לקוח', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261118_customer_media_history.sql', import.meta.url), 'utf8');
  for (const f of ['src', 'bucket', 'path', 'type', 'at', 'by', 'ref']) assert.match(sql, new RegExp(`'${f}', p\\.`));
  assert.match(sql, /'customer_number', v_num/);
  const policy = readFileSync(new URL('../supabase/migrations/20260915_stop_call_info.sql', import.meta.url), 'utf8');
  assert.match(policy, /wa_media_object_visible[\s\S]*?or public\.current_user_role\(\) = 'driver';/);
});
