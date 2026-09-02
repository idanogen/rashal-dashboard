import test from 'node:test';
import assert from 'node:assert/strict';
import { displayPhone } from '../supabase/functions/rashal-on-way/phone-display.ts';

/**
 * 🔴 מה שנבדק כאן הוא שהמספר **לא מתעוות**. ההודעה יוצאת ללקוח אמיתי,
 * ומספר שגוי גרוע בהרבה ממספר פחות נוח ללחיצה. לכן חצי מהבדיקות הן על
 * הקלט המוזר, ולא על המקרה התקין.
 */

test('נייד ישראלי עם מקפים, כפי שהוא שמור בטבלת הצוות', () => {
  assert.equal(displayPhone('058-5868780'), '+972-58-586-8780');
  assert.equal(displayPhone('050-8334248'), '+972-50-833-4248');
});

test('נייד בלי מקפים, כמו שמור אצל מוחמד ומיכאל', () => {
  assert.equal(displayPhone('0522906066'), '+972-52-290-6066');
  assert.equal(displayPhone('0584448383'), '+972-58-444-8383');
});

test('מספר שכבר בינלאומי לא נשבר', () => {
  assert.equal(displayPhone('+972585868780'), '+972-58-586-8780');
  assert.equal(displayPhone('972-58-586-8780'), '+972-58-586-8780');
  assert.equal(displayPhone('00972585868780'), '+972-58-586-8780');
});

test('קו נייח עם קידומת בת ספרה אחת', () => {
  assert.equal(displayPhone('03-9123456'), '+972-3-912-3456');
  assert.equal(displayPhone('08-6123456'), '+972-8-612-3456');
});

test('🔴 מספר באורך לא צפוי חוזר כמו שהוא ולא מעוות', () => {
  assert.equal(displayPhone('1-800-123-456'), '1-800-123-456');
  assert.equal(displayPhone('058-586'), '058-586');
  assert.equal(displayPhone('05858687801234'), '05858687801234');
});

test('🔴 מספר זר אינו מתחזה לישראלי', () => {
  assert.equal(displayPhone('+1 415 555 0134'), '+1 415 555 0134');
  assert.equal(displayPhone('+44 20 7946 0958'), '+44 20 7946 0958');
});

test('ריק, רווחים וטקסט אינם מפילים ואינם ממציאים', () => {
  assert.equal(displayPhone(''), '');
  assert.equal(displayPhone(null), '');
  assert.equal(displayPhone(undefined), '');
  assert.equal(displayPhone('   '), '');
  assert.equal(displayPhone('אין טלפון'), 'אין טלפון');
});

test('שלושת מספרי הצוות שנגענו בהם היום', () => {
  assert.equal(displayPhone('058-5868780'), '+972-58-586-8780'); // דוד חסידים
  assert.equal(displayPhone('058-6663737'), '+972-58-666-3737'); // דוד גוזלן
  assert.equal(displayPhone('058-6699369'), '+972-58-669-9369'); // אבי
});
