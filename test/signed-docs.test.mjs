import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSbUrl, signedAtLabel, signedDocRows, signedFormLabel } from '../src/lib/signed-docs.ts';

/**
 * 26/10/2026, עידן: "נחתם ×2" פתח רק את התעודה, ובצ'אט "טופס נחתם" לא נפתח.
 * המקרה האמיתי: ארבליי אביאור, טופס מכבי 09:44:27 ואחריו התעודה 09:44:49.
 */

test('sb:// מתפענח לדלי ונתיב, וכל השאר לא', () => {
  assert.deepEqual(parseSbUrl('sb://signed-forms/abc/מכבי - אספקה.pdf'), { bucket: 'signed-forms', path: 'abc/מכבי - אספקה.pdf' });
  assert.equal(parseSbUrl('https://x.y/z.pdf'), null);
  assert.equal(parseSbUrl('sb://signed-forms/'), null);
  assert.equal(parseSbUrl(null), null);
});

test('🔴 השמות שהמשרד מכיר, לא מפתחות', () => {
  assert.equal(signedFormLabel('maccabi-delivery'), 'טופס מכבי אספקה');
  assert.equal(signedFormLabel('moh-repair'), 'טופס משרד הבריאות תיקון');
  assert.equal(signedFormLabel('delivery_note'), 'תעודת משלוח חתומה');
  assert.equal(signedFormLabel('crane-training'), 'אישור הדרכה למנוף');
  assert.equal(signedFormLabel('crane-inspection'), 'רשימת בדיקה למנוף');
  assert.equal(signedFormLabel('something-new'), 'something-new');
});

test('שעת החתימה בשעון ישראל', () => {
  // שעון החורף נכנס ב-25/10/2026 בלילה, ולכן 07:44 UTC = 09:44 בישראל.
  assert.equal(signedAtLabel('2026-10-25T07:44:27Z'), '25/10 09:44');
  assert.equal(signedAtLabel('not a date'), '');
});

test('⭐ הרשימה: החדש ראשון, ושני המסמכים של אותו ביקור שניהם בה', () => {
  const rows = signedDocRows([
    { pdfPath: 's/maccabi.pdf', formKey: 'maccabi-delivery', signedAt: '2026-10-25T07:44:27Z' },
    { pdfPath: 's/dn.pdf', formKey: 'delivery_note', signedAt: '2026-10-25T07:44:49Z' },
  ]);
  assert.deepEqual(rows.map((r) => r.label), ['תעודת משלוח חתומה', 'טופס מכבי אספקה']);
  assert.equal(rows[1].when, '25/10 09:44');
});
