import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CHAIR_DELIVERY_SECTIONS, CHAIR_DELIVERY_DECLARATION, canSubmitChairDelivery, chairDeliveryFileDes, manufacturerFromDesc,
} from '../src/lib/chair-delivery.ts';
import { chairDeliveryLayout } from '../src/lib/forms/layouts/chair-delivery.ts';
import { signedFormLabel } from '../src/lib/signed-docs.ts';

/** טופס ההוראות והבטיחות באספקת כיסא ממונע (עמי ומיכאל 23/11, עידן 24/11). */

test('שתי החתימות חובה, השדות לא', () => {
  assert.equal(canSubmitChairDelivery({ userSignature: null, driverSignature: 'x' }).ok, false);
  assert.equal(canSubmitChairDelivery({ userSignature: 'x', driverSignature: null }).ok, false);
  assert.equal(canSubmitChairDelivery({ userSignature: 'x', driverSignature: 'y' }).ok, true);
});

test('היצרן מתוך תיאור הפריט', () => {
  assert.equal(manufacturerFromDesc('כסא ממונע מדגם Q6-EDGE בסיסי-תוצרת  PRIDE'), 'PRIDE');
  assert.equal(manufacturerFromDesc('כסא ממונע Q400 M תוצרת SUNRISE MEDICAL'), 'SUNRISE MEDICAL');
  assert.equal(manufacturerFromDesc('כסא גלגלים ממונע דגם R-TRAK'), '');
});

test('הנוסח: בלי קו מפריד ארוך, שלושה עמודים, כל הסעיפים 1 עד 7', () => {
  const all = JSON.stringify(CHAIR_DELIVERY_SECTIONS) + CHAIR_DELIVERY_DECLARATION;
  assert.doesNotMatch(all, /[–—]/);
  assert.deepEqual([...new Set(CHAIR_DELIVERY_SECTIONS.map((s) => s.page))], [1, 2, 3]);
  assert.deepEqual(CHAIR_DELIVERY_SECTIONS.filter((s) => !s.sub).map((s) => s.no), ['1', '2', '3', '4', '5', '6', '7']);
  for (const s of CHAIR_DELIVERY_SECTIONS) for (const c of s.clauses) if (c.bold) assert.ok(c.text.includes(c.bold), c.bold);
});

test('ה-PDF: שלושה עמודים, שתי חתימות, שם קובץ קצר', () => {
  const html = chairDeliveryLayout({
    title: 'ת', support: 's', sections: CHAIR_DELIVERY_SECTIONS, declarationTitle: '8', declaration: 'd',
    driverSigLabel: 'מוסר', userSigLabel: 'משתמש', customerName: 'לקוח',
    values: { manufacturer: '', model: 'R-TRAK', serial: '', userName: '', userIdNumber: '', onBehalfOf: '',
      userSignature: 'data:image/png;base64,AA', driverSignature: 'data:image/png;base64,BB' },
    meta: { signedAt: new Date('2026-11-24T10:00:00Z'), driverName: 'מיכאל' },
  });
  assert.equal(html.match(/height:1123px/g).length, 3);
  assert.equal(html.match(/<img /g).length, 2);
  assert.ok(chairDeliveryFileDes('שם לקוח ארוך מאוד '.repeat(5), new Date()).length <= 60);
  assert.equal(signedFormLabel('crane-chair_delivery'), 'הוראות ובטיחות, אספקת כיסא ממונע');
});

test('הכלל במסד מזהה כיסא ולא אביזר', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261110_chair_checklist.sql', import.meta.url), 'utf8');
  const m = sql.match(/~ '(\^\[\^א-ת\]\*\(כסא\|כיסא\)\( גלגלים\)\? ממונע)'/);
  assert.ok(m, 'הביטוי בפונקציה stop_chair_delivery');
  const re = new RegExp(m[1]);
  assert.ok(re.test('כסא גלגלים ממונע דגם R-TRAK'));
  assert.ok(re.test('"כסא ממונע R44 בסיסי - תוצרת פרייד ארה""ב"'));
  assert.ok(!re.test('חגורת אגן- ממונע Q400'));
  assert.ok(!re.test('Tilt חשמלי- ממונע Q6 EDGE'));
});
