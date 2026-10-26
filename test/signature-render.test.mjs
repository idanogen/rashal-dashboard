import test from 'node:test';
import assert from 'node:assert/strict';
import { signatureLine, thickenSignature } from '../src/lib/forms/layouts/common.ts';
import { craneTrainingLayout } from '../src/lib/forms/layouts/crane-training.ts';

/**
 * עיבוי החתימה בהדפסה (עמי, 25/10/2026): חתימת SVG נחתמת על מסך מלא
 * ומוקטנת פי 4-5 לתוך קו החתימה, וקו של 2.6 פיקסלים יצא בלתי נראה.
 */

const SIG = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="345" height="200" viewBox="0 0 345 200">' +
  '<path d="M10,10 L50,50" stroke="#1e3a8a" stroke-width="2.6" fill="none"/>' +
  '<path d="M60,10 L90,50" stroke="#1e3a8a" stroke-width="2.6" fill="none"/></svg>');

test('חתימת SVG מתעבה פי 2.5 בכל הקווים', () => {
  const out = decodeURIComponent(thickenSignature(SIG).replace('data:image/svg+xml;utf8,', ''));
  assert.equal((out.match(/stroke-width="6.5"/g) ?? []).length, 2);
  assert.ok(!out.includes('stroke-width="2.6"'));
});

test('עיבוי קו שכבר עבה נעצר בתקרה של 12', () => {
  const fat = SIG.replace(/2\.6/g, '9');
  const out = decodeURIComponent(thickenSignature(fat).replace('data:image/svg+xml;utf8,', ''));
  assert.ok(out.includes('stroke-width="12"'));
});

test('חתימת PNG (הפאד בווב) עוברת כמו שהיא', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  assert.equal(thickenSignature(png), png);
});

test('קו החתימה בטופס מטמיע את החתימה המעובה והגבוהה', () => {
  const html = signatureLine('חתימת המקבל', SIG, 220);
  assert.ok(html.includes('stroke-width%3D%226.5%22'));
  assert.ok(html.includes('max-height:58px'));
});

test('קו חתימה בלי חתימה נשאר קו ריק', () => {
  assert.ok(!signatureLine('חתימה', null).includes('<img'));
});

/** תבנית אישור ההדרכה: גרסה 2, טופס הנייר של ר.שעל (26/10/2026). */

import { TRAINING_SATISFACTION, TRAINING_SECTIONS, TRAINING_TITLE } from '../src/lib/crane-training.ts';

const TRAINING = {
  title: TRAINING_TITLE,
  sections: TRAINING_SECTIONS,
  satisfaction: TRAINING_SATISFACTION,
  customerName: 'אוגוסט נ לוזון',
  customerNumber: '12345',
  craneModel: 'G175',
  craneSerial: '208240305354',
  recipientName: 'נ לוזון',
  recipientIdNumber: '012345678',
  recipientRelation: 'בן/בת',
  sling: { manufacturer: 'sunrise', productionDate: '01/2026', serial: 'SL1' },
  signature: SIG,
  meta: { signedAt: new Date('2026-10-22T10:30:00'), driverName: 'רודי' },
};

test('תבנית ההדרכה: כל הפרטים והנוסח על העמוד', () => {
  const html = craneTrainingLayout(TRAINING);
  for (const s of ['אוגוסט נ לוזון', '208240305354', 'נ לוזון', '012345678', 'בן/בת', 'רודי', '22/10/2026', 'sunrise', 'SL1',
    'sunrise medical', 'לשביעות רצוני', 'פרטי מקבל ההדרכה', 'פרטי מבצע ההדרכה', 'פרטי הערסל שסופק', 'ר.שעל']) {
    assert.ok(html.includes(s), `חסר: ${s}`);
  }
  assert.ok(html.includes('<b>לא יותר ממה שהומלץ</b>'), 'ההדגשה מהטופס המקורי');
  assert.ok(html.includes('stroke-width%3D%226.5%22'), 'החתימה מוטמעת מעובה');
});

test('תבנית ההדרכה: סעיפים 4, 5, 6 ממוספרים אחרי שלושת סעיפי הנוסח', () => {
  const html = craneTrainingLayout(TRAINING);
  assert.ok(html.indexOf('4. ') < html.indexOf('5. ') && html.indexOf('5. ') < html.indexOf('6. '));
});

test('תבנית ההדרכה: טקסט לקוח עובר escaping', () => {
  const html = craneTrainingLayout({ ...TRAINING, recipientName: '<script>alert(1)</script>' });
  assert.ok(!html.includes('<script>'));
});
