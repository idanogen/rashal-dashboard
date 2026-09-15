import test from 'node:test';
import assert from 'node:assert/strict';
import { israelStamp, repairLine, callSubformUrl, photoDes } from '../api/_lib/call-repair-text.ts';

/**
 * מלל ותמונות של הטכנאי לקריאת השירות בפריוריטי (עידן, 15/09/2026).
 * הדוגמאות אמיתיות מ-15/09 ומ-14/09.
 */

test('🔴 השעה בשעון ישראל, לא UTC', () => {
  assert.equal(israelStamp('2026-09-15T10:12:38Z'), '15/09/26 13:12');
  assert.equal(israelStamp('2026-09-14T21:30:00Z'), '15/09/26 00:30', 'אחרי חצות בישראל זה כבר היום הבא');
  assert.equal(israelStamp('2026-09-15T10:12:38Z', false), '15/09/26');
  assert.equal(israelStamp('לא תאריך'), '');
});

test('הערת צ\'אט של טכנאי', () => {
  assert.equal(
    repairLine({ kind: 'comment', user_name: 'אבי', content: 'הוחלף גב 40/50חדש', at: '2026-09-15T10:12:38Z' }),
    '[אבי · 15/09/26 13:12] הוחלף גב 40/50חדש',
  );
});

test('סיבה מסימון הביקור מקבלת את שם הסימון, ושורות מתחברות', () => {
  assert.equal(
    repairLine({ kind: 'note', user_name: 'אולג', content: 'חסר חלק, צריך להזמין', at: '2026-09-14T15:02:00Z', resolution_kind: 'follow_up' }),
    '[אולג · 14/09/26 18:02 · להמשך טיפול] חסר חלק, צריך להזמין',
  );
  assert.equal(
    repairLine({ kind: 'note', user_name: 'ישראל', content: 'בגלל צום סיימו לומדים מוקדם.\nאין אף אחד\n', at: '2026-09-14T12:00:00Z', resolution_kind: 'not_done' }),
    '[ישראל · 14/09/26 15:00 · לא בוצע] בגלל צום סיימו לומדים מוקדם. / אין אף אחד',
  );
});

test('מלל ריק לא נכתב', () => {
  assert.equal(repairLine({ kind: 'comment', user_name: 'אבי', content: '  \n ', at: '2026-09-15T10:00:00Z' }), null);
});

test('כתובת תת-הטופס במפתח המורכב, ושם נספח', () => {
  assert.equal(
    callSubformUrl('https://x/odata', 'SC2603230', 'DOCTEXT_Q_SUBFORM'),
    "https://x/odata/DOCUMENTS_Q(DOCNO='SC2603230',TYPE='Q')/DOCTEXT_Q_SUBFORM",
  );
  assert.equal(photoDes('SC2603230', '2026-09-15T10:11:49Z', 1, 'jpeg'), 'SC2603230 טכנאי 15.09.26 (1).jpeg');
});
