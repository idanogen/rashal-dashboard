import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStopDetailsPatch, describeStopDetailsChange } from '../src/lib/stop-details.ts';

const cur = { address: 'הרצל 5', city: 'חדרה', phone: '0523694547' };

test('בלי שינוי: לא כותבים כלום', () => {
  const p = buildStopDetailsPatch(cur, { address: ' הרצל  5 ', city: 'חדרה', phone: '0523694547' });
  assert.equal(p.empty, true);
  assert.equal(p.relocate, false);
  assert.deepEqual(p.fields, {});
});

test('כתובת חדשה מאפסת מיקום, טלפון לבד לא', () => {
  const a = buildStopDetailsPatch(cur, { address: 'בית ספר חצב', city: 'חדרה', phone: '0523694547' });
  assert.deepEqual(a.fields, { address: 'בית ספר חצב' });
  assert.equal(a.relocate, true);
  const b = buildStopDetailsPatch(cur, { address: 'הרצל 5', city: 'חדרה', phone: '058-7777777' });
  assert.deepEqual(b.fields, { phone: '058-7777777' });
  assert.equal(b.relocate, false);
  const c = buildStopDetailsPatch(cur, { address: 'הרצל 5', city: 'פרדס חנה', phone: '0523694547' });
  assert.equal(c.relocate, true);
});

test('עצירה בלי כתובת מקבלת אחת, וריקון נשמר כריק', () => {
  const p = buildStopDetailsPatch({ address: null, city: null, phone: null }, { address: 'הרצל 5', city: '', phone: '' });
  assert.deepEqual(p.fields, { address: 'הרצל 5' });
  const q = buildStopDetailsPatch(cur, { address: '', city: 'חדרה', phone: '0523694547' });
  assert.deepEqual(q.fields, { address: '' });
  assert.equal(q.relocate, true);
});

test('תיאור השינוי להערת המערכת', () => {
  const p = buildStopDetailsPatch(cur, { address: 'בית ספר חצב', city: 'חדרה', phone: '' });
  assert.equal(describeStopDetailsChange(cur, p), 'כתובת: הרצל 5 ← בית ספר חצב · טלפון: 0523694547 ← ריק');
});

test('28/10: סיכום התוצאה של stop_details_change לטוסט ולהודעה', async () => {
  const { summarizeStopDetailsResult, SCOPE_OPTIONS, scopeLabel } = await import('../src/lib/stop-details.ts');
  assert.equal(summarizeStopDetailsResult({ changed: false }), 'לא השתנה כלום.');
  const once = summarizeStopDetailsResult({ changed: true, scope: 'once', description: 'טלפון: א ← ב' });
  assert.equal(once, 'טלפון: א ← ב · המשרד קיבל מייל');
  const perm = summarizeStopDetailsResult({
    changed: true, scope: 'permanent', description: 'כתובת: א ← ב', other_stops_updated: 2, priority_contact_added: true,
  });
  assert.ok(perm.includes('עודכנו גם 2 ביקורים'));
  assert.ok(perm.includes('הנייד נוסף לפריוריטי'));
  assert.equal(SCOPE_OPTIONS.map((o) => o.value).join(','), 'once,permanent');
  assert.equal(scopeLabel('permanent'), 'קבוע ללקוח');
  // 🔴 בלי גרש ארוך בטקסטים שמגיעים למסך
  for (const o of SCOPE_OPTIONS) assert.ok(!/[—–]/.test(o.label + o.hint));
});
