import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseCounts,
  parseCallInfo,
  hasCallInfo,
  infoChipLabel,
  splitPhones,
  emptyMediaLine,
} from '../src/lib/call-info.ts';

/**
 * כרטיס הקריאה לנהג (15/09/2026). הצורות הן מה שהחזירה stop_call_info
 * בפועל על SC2603230 (קוסקס) כשנקראה בהרשאות של הנהג אבי.
 */

test('ספירות: שורה "יש מה לראות" לפי מה שיש', () => {
  const counts = parseCounts([
    { stop_id: 'a', has_fault: true, images: 5, videos: 0, texts: 5 },
    { stop_id: 'b', has_fault: false, images: 3, videos: 1, texts: 0 },
    { stop_id: 'c', has_fault: false, images: 0, videos: 0, texts: 0 },
  ]);
  assert.equal(infoChipLabel(counts.a), '📋 תאור תקלה · 📷 5 תמונות');
  assert.equal(infoChipLabel(counts.b), '📷 3 תמונות · ▶ סרטון');
  assert.equal(hasCallInfo(counts.c), false);
  assert.equal(infoChipLabel(counts.c), '');
});

test('רק הודעות בלי קבצים עדיין פותחות את הכרטיס', () => {
  const [c] = Object.values(parseCounts([{ stop_id: 'x', has_fault: false, images: 0, videos: 0, texts: 2 }]));
  assert.equal(hasCallInfo(c), true);
  assert.equal(infoChipLabel(c), '💬 הודעות מהלקוח');
});

test('הכרטיס: תמונות, הודעות, הערת משרד ובקשת תמונה', () => {
  const info = parseCallInfo({
    stop_id: 's1',
    call: { id: 'c1', docno: 'SC2603230', fault_text: 'ברקס בגב הכסא לא נועל', device_serial: 'A180606718' },
    media: [
      { message_id: 'm1', i: 0, at: '2026-09-14T07:33:49+00:00', type: 'image', path: 'conv/x/1.jpg', content_type: 'image/jpeg' },
      { message_id: 'm2', i: 0, at: '2026-09-14T07:34:00+00:00', type: 'document', path: 'conv/x/2.pdf' },
      { message_id: 'm3', i: 0, at: '2026-09-14T07:35:00+00:00', type: 'video', path: '' },
    ],
    texts: [{ message_id: 't1', at: '2026-09-14T07:39:24+00:00', body: 'נראה לי צד שמאל' }, { message_id: 't2', body: '' }],
    office_note: { user_name: 'עמי גז', content: 'ברקס בגב הכסא לא נועל', at: '2026-09-14T14:41:33Z' },
    media_request: { state: 'media_received', sent_at: '2026-09-14T07:30:13Z', received_at: '2026-09-14T07:33:55Z' },
  });
  assert.equal(info.call.faultText, 'ברקס בגב הכסא לא נועל');
  assert.equal(info.media.length, 1, 'רק תמונה/סרטון/הקלטה עם נתיב');
  assert.equal(info.texts.length, 1);
  assert.equal(info.officeNote.userName, 'עמי גז');
});

test('עצירה בלי קריאה, או תשובה ריקה, לא מפילות', () => {
  assert.equal(parseCallInfo(null), null);
  const info = parseCallInfo({ stop_id: 's', call: null, media: null, texts: undefined });
  assert.equal(info.call, null);
  assert.deepEqual(info.media, []);
  assert.deepEqual(info.texts, []);
});

test('טלפון בתוך התאור הופך ללחיץ, בכל הכתיבות', () => {
  const parts = splitPhones('יש סרטון בנייד החדש\n0542882423');
  assert.deepEqual(parts.at(-1), { text: '0542882423', tel: 'tel:0542882423' });
  assert.equal(splitPhones('התקשר 054-549-8033 אחרי 5').find((p) => p.tel)?.tel, 'tel:0545498033');
  assert.equal(splitPhones('+972 54 549 8033').length, 1);
  assert.equal(splitPhones('ברקס בגב הכסא לא נועל').some((p) => p.tel), false);
  assert.equal(splitPhones('מס סידורי A180606718').some((p) => p.tel), false, 'מספר סידורי אינו טלפון');
});

test('גיליון בלי קבצים אומר למה', () => {
  const t = (iso) => iso.slice(11, 16);
  assert.match(emptyMediaLine({ sentAt: '2026-09-15T09:12:00Z' }, t), /נשלחה 09:12/);
  assert.match(emptyMediaLine(null, t), /לא שלח/);
});
