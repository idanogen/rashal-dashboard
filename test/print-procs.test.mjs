import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLearnedProc, procsToMap } from '../api/_lib/print-procs.ts';

/**
 * 🔴🔴 מה שנשמר כאן **מורץ מול פריוריטי אצל כל העובדים**, והוא מגיע
 * מהדפדפן. אלה הבדיקות ששומרות שלא ייכנס לשם ערך שלא הוכיח את עצמו.
 */

const good = {
  form: 'DOCUMENTS_D',
  ename: 'WWWSHOWDOC_D',
  table: 'DOCUMENTS',
  avoidmessages: 'true',
  printArgs: { format: '-3', mode: '1', pdf: 'true' },
};

test('פרוצדורה תקינה עוברת, ומוחזרת מנורמלת', () => {
  const r = normalizeLearnedProc(good);
  assert.equal(r.ok, true);
  assert.equal(r.value.form, 'DOCUMENTS_D');
  assert.equal(r.value.ename, 'WWWSHOWDOC_D');
  assert.deepEqual(r.value.printArgs, { mode: '1', format: '-3', pdf: 'true' });
});

test('אותיות קטנות מנורמלות לגדולות, כמו בפריוריטי', () => {
  const r = normalizeLearnedProc({ ...good, form: 'documents_d', ename: 'wwwshowdoc_d' });
  assert.equal(r.value.form, 'DOCUMENTS_D');
  assert.equal(r.value.ename, 'WWWSHOWDOC_D');
});

test('🔴 שם שאינו מזהה של פריוריטי נדחה, ולא "מנוקה"', () => {
  for (const ename of ['', ' ', 'DROP TABLE', 'a', 'WWW-SHOW', 'שלום', 'WWW SHOW', '1WWW', 'W'.repeat(80)]) {
    const r = normalizeLearnedProc({ ...good, ename });
    assert.equal(r.ok, false, JSON.stringify(ename));
    assert.equal(r.value, null);
  }
});

test('🔴 פרמטר שאינו ברשימה הסגורה פשוט לא נשמר', () => {
  const r = normalizeLearnedProc({ ...good, printArgs: { format: '-1', evil: 'rm -rf', extra: '1' } });
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r.value.printArgs), ['format']);
});

test('🔴 ערך ארוך או מוזר בפרמטר מפיל את כל הפרוצדורה', () => {
  assert.equal(normalizeLearnedProc({ ...good, printArgs: { format: 'x'.repeat(20) } }).ok, false);
  assert.equal(normalizeLearnedProc({ ...good, printArgs: { format: '"; drop' } }).ok, false);
  assert.equal(normalizeLearnedProc({ ...good, printArgs: { format: {} } }).ok, false);
});

test('avoidmessages מקבל רק true או false, כל השאר הופך לריק', () => {
  assert.equal(normalizeLearnedProc({ ...good, avoidmessages: 'TRUE' }).value.avoidmessages, 'true');
  assert.equal(normalizeLearnedProc({ ...good, avoidmessages: 'maybe' }).value.avoidmessages, null);
  assert.equal(normalizeLearnedProc({ ...good, avoidmessages: '' }).value.avoidmessages, null);
});

test('קלט שאינו אובייקט נדחה בלי לזרוק', () => {
  for (const v of [null, undefined, 'x', 5, []]) {
    const r = normalizeLearnedProc(v);
    assert.equal(r.ok, Array.isArray(v) ? false : false, JSON.stringify(v));
  }
});

test('⭐ שורות המסד מקבלות בדיוק את השמות שהתוסף מכיר', () => {
  // 🔴 `table_name` במסד מול `table` בתוסף. שם אחר בצד אחד פירושו
  // פרוצדורה שנראית קיימת ולא מופעלת.
  const m = procsToMap([
    { form: 'DOCUMENTS_D', ename: 'WWWSHOWDOC_D', table_name: 'DOCUMENTS', avoidmessages: 'true', print_args: { format: '-3' } },
    { form: 'AINVOICES', ename: 'WWWSHOWINV', table_name: 'AINVOICES', avoidmessages: null, print_args: null },
  ]);
  assert.deepEqual(Object.keys(m), ['DOCUMENTS_D', 'AINVOICES']);
  assert.deepEqual(m.DOCUMENTS_D, { ename: 'WWWSHOWDOC_D', table: 'DOCUMENTS', avoidmessages: 'true', printArgs: { format: '-3' } });
  assert.deepEqual(m.AINVOICES.printArgs, {});
});

test('רשימה ריקה או חסרה אינה שגיאה', () => {
  assert.deepEqual(procsToMap(null), {});
  assert.deepEqual(procsToMap([]), {});
});
