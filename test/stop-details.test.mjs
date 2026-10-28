import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStopDetailsPatch, describeStopDetailsChange, summarizeStopDetailsResult, SCOPE_OPTIONS, scopeLabel,
} from '../src/lib/stop-details.ts';

const cur = { address: 'הרצל 5', city: 'חדרה', phone: '0523694547', phoneExtra: null, originalAddress: null, originalCity: null };

test('בלי שינוי: לא כותבים כלום', () => {
  const p = buildStopDetailsPatch(cur, { address: ' הרצל  5 ', city: 'חדרה', phoneExtra: '' });
  assert.equal(p.empty, true);
  assert.equal(p.relocate, false);
  assert.deepEqual(p.fields, {});
});

test('כתובת חדשה מאפסת מיקום, טלפון נוסף לבד לא', () => {
  const a = buildStopDetailsPatch(cur, { address: 'בית ספר חצב', city: 'חדרה', phoneExtra: '' });
  assert.deepEqual(a.fields, { address: 'בית ספר חצב' });
  assert.equal(a.relocate, true);
  const b = buildStopDetailsPatch(cur, { address: 'הרצל 5', city: 'חדרה', phoneExtra: '058-7777777' });
  assert.deepEqual(b.fields, { phoneExtra: '058-7777777' });
  assert.equal(b.relocate, false);
  const c = buildStopDetailsPatch(cur, { address: 'הרצל 5', city: 'פרדס חנה', phoneExtra: '' });
  assert.equal(c.relocate, true);
});

test('🔴 לא דורסים: טלפון זהה לראשי או לנוסף הקיים אינו שינוי', () => {
  const same = buildStopDetailsPatch(cur, { address: 'הרצל 5', city: 'חדרה', phoneExtra: '0523694547' });
  assert.equal(same.empty, true);
  const dup = buildStopDetailsPatch({ ...cur, phoneExtra: '0501111111' }, { address: 'הרצל 5', city: 'חדרה', phoneExtra: '050 1111111' });
  assert.equal(dup.empty, true);
});

test('חזרה לכתובת המקורית מסומנת restore', () => {
  const c = { ...cur, address: 'עלה שיח 3', originalAddress: 'הרצל 5', originalCity: 'חדרה' };
  const p = buildStopDetailsPatch(c, { address: 'הרצל 5', city: 'חדרה', phoneExtra: '' });
  assert.equal(p.restore, true);
  assert.ok(describeStopDetailsChange(c, p).includes('חזרה למקורית'));
  const q = buildStopDetailsPatch(c, { address: 'הגפן 2', city: 'חדרה', phoneExtra: '' });
  assert.equal(q.restore, false);
});

test('עצירה בלי כתובת מקבלת אחת, וריקון נשמר כריק', () => {
  const p = buildStopDetailsPatch({ address: null, city: null, phone: null }, { address: 'הרצל 5', city: '', phoneExtra: '' });
  assert.deepEqual(p.fields, { address: 'הרצל 5' });
  const q = buildStopDetailsPatch(cur, { address: '', city: 'חדרה', phoneExtra: '' });
  assert.deepEqual(q.fields, { address: '' });
  assert.equal(q.relocate, true);
});

test('תיאור השינוי להערת המערכת', () => {
  const p = buildStopDetailsPatch(cur, { address: 'בית ספר חצב', city: 'חדרה', phoneExtra: '0587777777' });
  assert.equal(describeStopDetailsChange(cur, p),
    'כתובת לניווט: הרצל 5 ← בית ספר חצב (המקורית נשמרת) · טלפון נוסף: 0587777777 (הראשי 0523694547 נשאר)');
});

test('28/10: סיכום התוצאה של stop_details_change לטוסט ולהודעה', () => {
  assert.equal(summarizeStopDetailsResult({ changed: false }), 'לא השתנה כלום.');
  const once = summarizeStopDetailsResult({ changed: true, scope: 'once', description: 'טלפון נוסף: ב' });
  assert.equal(once, 'טלפון נוסף: ב · המשרד קיבל מייל');
  const perm = summarizeStopDetailsResult({
    changed: true, scope: 'permanent', description: 'כתובת: א ← ב', other_stops_updated: 2, priority_contact_added: true,
  });
  assert.ok(perm.includes('עודכנו גם 2 ביקורים'));
  assert.ok(perm.includes('הנייד נוסף לפריוריטי'));
  assert.equal(SCOPE_OPTIONS.map((o) => o.value).join(','), 'once,permanent');
  assert.equal(scopeLabel('permanent'), 'קבוע ללקוח');
  for (const o of SCOPE_OPTIONS) assert.ok(!/[—–]/.test(o.label + o.hint));
});
