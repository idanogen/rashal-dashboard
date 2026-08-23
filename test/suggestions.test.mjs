import test from 'node:test';
import assert from 'node:assert/strict';
import { filterSuggestions } from '../src/lib/suggestion-filter.ts';

/**
 * 🔴 מה שנבדק כאן הוא **הסדר**. רשימה שמציעה "באר שבע" למי שהקליד "רא"
 * לפני "ראשון לציון" גרועה מרשימה ריקה, כי היא מכריחה לקרוא במקום להקליד.
 */

// 🔴 "כרמיאל" מכילה "רמ" באמצע, "רמת גן" פותחת בה. זה בדיוק המקרה.
const CITIES = ['תל אביב', 'כרמיאל', 'רמת גן', 'באר שבע', 'ירושלים', 'רעננה'];

test('בלי הקלדה מוצגות ההצעות הראשונות לפי סדר החשיבות', () => {
  assert.deepEqual(filterSuggestions(CITIES, '', 3), ['תל אביב', 'כרמיאל', 'רמת גן']);
});

test('🔴 התחלת מילה קודמת להתאמה באמצע', () => {
  const r = filterSuggestions(CITIES, 'רמ');
  assert.deepEqual(r, ['רמת גן', 'כרמיאל']);
});

test('הערך שכבר הוקלד במדויק אינו מוצע לעצמו', () => {
  assert.equal(filterSuggestions(CITIES, 'רמת גן').includes('רמת גן'), false);
});

test('רווחים ואותיות גדולות לא שוברים התאמה', () => {
  assert.deepEqual(filterSuggestions(['Q6EDGE BASIC', 'SRQ400M'], '  q6e '), ['Q6EDGE BASIC']);
});

test('אין התאמה, אין רשימה', () => {
  assert.deepEqual(filterSuggestions(CITIES, 'זזזז'), []);
});

test('התקרה נשמרת', () => {
  const many = Array.from({ length: 50 }, (_, i) => `עיר ${i}`);
  assert.equal(filterSuggestions(many, 'עיר', 8).length, 8);
});

test('רשימה ריקה לא מפילה', () => {
  assert.deepEqual(filterSuggestions([], 'משהו'), []);
});
