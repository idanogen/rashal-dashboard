import test from 'node:test';
import assert from 'node:assert/strict';
import { priorityHtmlToText, faultTextFromExpand } from '../api/_lib/priority-text.ts';

/**
 * "תאור התקלה" מפריוריטי לשורות טקסט (כרטיס הקריאה לנהג, 15/09/2026).
 * הדוגמאות הן ה-HTML האמיתי שנקרא מ-SC2603230 ו-SC2603225.
 */

const STYLE = "<style> p,div,li {margin:0cm;font-size:10.0pt;font-family:'Arial';}</style>";

test('שורה אחת עטופה בסגנון ובפסקאות', () => {
  const html = `${STYLE}<p dir=rtl> <p dir="rtl">ברקס בגב הכסא לא נועל</p><p dir="rtl"><br></p>`;
  assert.equal(priorityHtmlToText(html), 'ברקס בגב הכסא לא נועל');
});

test('כמה שורות נשמרות, כולל טלפון בתוך התאור', () => {
  const html = `${STYLE}<p dir="rtl">יש בעיה באלקטרוניקה מאחורה</p><p dir="rtl">יש סרטון בנייד החדש</p><p dir="rtl">0542882423</p>`;
  assert.equal(priorityHtmlToText(html), 'יש בעיה באלקטרוניקה מאחורה\nיש סרטון בנייד החדש\n0542882423');
});

test('nbsp וישויות מפוענחים, ורצף שורות ריקות מתכווץ לאחת', () => {
  const html = `<p>א&nbsp;&amp;&nbsp;ב</p><p><br></p><p><br></p><p>ג &#1488;</p><p><br></p>`;
  assert.equal(priorityHtmlToText(html), 'א & ב\n\nג א');
});

test('ריק או רק עטיפה מחזיר null ולא מחרוזת ריקה', () => {
  assert.equal(priorityHtmlToText(`${STYLE}<p dir="rtl"><br></p>`), null);
  assert.equal(priorityHtmlToText(''), null);
  assert.equal(priorityHtmlToText(null), null);
});

test('🔴 expand: undefined = לא התבקש (לא נוגעים), ריק = null (מנקים)', () => {
  assert.equal(faultTextFromExpand(undefined), undefined);
  assert.equal(faultTextFromExpand(null), null);
  assert.equal(faultTextFromExpand([]), null);
  assert.equal(faultTextFromExpand({ TEXT: '<p>שבור</p>' }), 'שבור');
  assert.equal(faultTextFromExpand([{ TEXT: '<p>שבור</p>' }]), 'שבור');
});
