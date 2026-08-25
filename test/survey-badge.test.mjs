import test from 'node:test';
import assert from 'node:assert/strict';
import { surveyMark, SURVEY_TONE } from '../src/lib/survey-badge.ts';

const at = '2026-08-25T14:42:10.461Z';

test('בלי תשובה אין חיווי בכלל', () => {
  assert.equal(surveyMark(null), null);
  assert.equal(surveyMark(undefined), null);
  // 🔴 נשלח אבל לא נענה אינו "ענה". זה בדיוק ההבדל שהחיווי מודד.
  assert.equal(surveyMark({ score: 5, answeredAt: null }), null);
});

/**
 * 🔴🔴 הבדיקה שמצדיקה את הקובץ. נמדד על 23 התשובות הראשונות: 20 נתנו 5
 * ואחד נתן 2. סמיילי אחיד היה מסתיר בדיוק את היחיד שצריך לטפל בו.
 */
test('🔴 ציון נמוך נראה אחרת מציון גבוה', () => {
  const good = surveyMark({ score: 5, answeredAt: at });
  const bad = surveyMark({ score: 2, answeredAt: at });
  assert.equal(good.tone, 'good');
  assert.equal(bad.tone, 'bad');
  assert.notEqual(good.emoji, bad.emoji);
  assert.notEqual(SURVEY_TONE[good.tone], SURVEY_TONE[bad.tone]);
});

test('🔴 הסף הוא 3 ומטה, ו-4 עדיין מרוצה', () => {
  assert.equal(surveyMark({ score: 4, answeredAt: at }).tone, 'good');
  assert.equal(surveyMark({ score: 3, answeredAt: at }).tone, 'ok');
  assert.equal(surveyMark({ score: 2, answeredAt: at }).tone, 'bad');
  assert.equal(surveyMark({ score: 1, answeredAt: at }).tone, 'bad');
});

test('ענה בלי לדרג אינו נספר כמרוצה ואינו כבעיה', () => {
  const m = surveyMark({ score: null, answeredAt: at });
  assert.equal(m.tone, 'ok');
  assert.match(m.title, /בלי דירוג/);
});

test('הערה מסומנת בכיתוב, כדי שיהיה ברור שיש מה לקרוא', () => {
  assert.match(surveyMark({ score: 5, answeredAt: at, comment: 'שירות מצוין' }).title, /השאיר הערה/);
  assert.doesNotMatch(surveyMark({ score: 5, answeredAt: at, comment: '   ' }).title, /השאיר הערה/);
});

test('התאריך בכיתוב נושא שנה', () => {
  assert.match(surveyMark({ score: 5, answeredAt: at }).title, /25\.8\.2026/);
});

test('תאריך לא תקין לא מייצר NaN על המסך', () => {
  const m = surveyMark({ score: 5, answeredAt: 'לא תאריך' });
  assert.ok(!/NaN/.test(m.title));
});

test('לכל טון יש מחלקת צבע', () => {
  for (const t of ['good', 'ok', 'bad']) assert.ok(SURVEY_TONE[t]);
});
