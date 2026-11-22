import test from 'node:test';
import assert from 'node:assert/strict';
import { activeFilters, countFromToday, filterSignature, filterSummary, filterTelemetry } from '../src/lib/active-filters.ts';

/** פס "המסך מסונן" במסך הסדרן (22/11/2026): עמי לא זיהה איזה סינון פעיל אצלו. */
const none = { search: '', zoneLabels: [], fundLabel: null, hiddenTypeLabels: [], calendarSearch: '' };

test('בלי סינון אין פס', () => {
  assert.deepEqual(activeFilters(none), []);
  assert.deepEqual(activeFilters({ ...none, search: '   ', calendarSearch: ' ' }), []);
});

test('כל סינון מקבל צ׳יפ, והנזכרים בדפדפן ראשונים', () => {
  const list = activeFilters({
    search: 'כהן', zoneLabels: ['חיפה'], fundLabel: 'מכבי', hiddenTypeLabels: ['איסופים', 'משימות'], calendarSearch: 'לוי',
  });
  assert.deepEqual(list.map((f) => f.key), ['fund', 'types', 'zones', 'search', 'calendarSearch']);
  assert.equal(list[0].label, 'קופה: מכבי');
  assert.equal(list[1].label, 'מוסתרים ביומן: איסופים, משימות');
  assert.equal(list[3].label, 'חיפוש: "כהן"');
});

test('הרבה אזורים מתקצרים, וחיפוש ארוך נחתך', () => {
  const list = activeFilters({ ...none, zoneLabels: ['חיפה', 'קריות', 'שרון', 'גוש דן'], search: 'א'.repeat(40) });
  assert.equal(list[0].label, 'אזור: חיפה, קריות ועוד 2');
  assert.equal(list[1].label, `חיפוש: "${'א'.repeat(18)}…"`);
});

test('שורת המספרים מציגה רק את מה שהסינון הפעיל משפיע עליו', () => {
  const counts = { pendingShown: 212, pendingTotal: 1540, calendarHidden: 31 };
  const fund = activeFilters({ ...none, fundLabel: 'מכבי' });
  assert.equal(filterSummary(fund, counts), 'ממתינים: 212 מתוך 1,540 · ביומן מוסתרות 31 עצירות מהיום והלאה');
  const types = activeFilters({ ...none, hiddenTypeLabels: ['איסופים'] });
  assert.equal(filterSummary(types, { ...counts, calendarHidden: 1 }), 'ביומן מוסתרת עצירה אחת מהיום והלאה');
  const zones = activeFilters({ ...none, zoneLabels: ['חיפה'] });
  assert.equal(filterSummary(zones, counts), 'ממתינים: 212 מתוך 1,540');
  assert.equal(filterSummary(types, { ...counts, calendarHidden: 0 }), '');
});

test('ללוגים נרשם איזה סינון פעיל, בלי טקסט החיפוש', () => {
  const t = filterTelemetry({ ...none, fundLabel: 'מכבי', search: 'כהן דוד 0521234567', calendarSearch: 'לוי' });
  assert.deepEqual(t, { fund: 'מכבי', hiddenTypes: [], zones: [], search: true, calendarSearch: true });
  assert.equal(JSON.stringify(t).includes('כהן'), false);
});

test('שינוי בטקסט החיפוש לא נחשב שינוי במצב הסינון, הדלקה וכיבוי כן', () => {
  const a = filterSignature({ ...none, search: 'כה' });
  assert.equal(a, filterSignature({ ...none, search: 'כהן' }));
  assert.notEqual(a, filterSignature(none));
});

test('ספירת עצירות מהיום והלאה מדלגת על מבוטלות ועל עבר', () => {
  const stops = [
    { status: 'planned', deliveryDate: '2026-11-21', sourceType: 'service' },
    { status: 'planned', deliveryDate: '2026-11-22', sourceType: 'service' },
    { status: 'cancelled', deliveryDate: '2026-11-22', sourceType: 'service' },
    { status: 'planned', deliveryDate: '2026-11-23', sourceType: 'pickup' },
  ];
  assert.equal(countFromToday(stops, '2026-11-22'), 2);
  assert.equal(countFromToday(stops, '2026-11-22', (s) => s.sourceType !== 'pickup'), 1);
});
