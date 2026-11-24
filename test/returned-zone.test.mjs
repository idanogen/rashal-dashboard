import test from 'node:test';
import assert from 'node:assert/strict';
import { inSelectedZones } from '../src/lib/returned-zone.ts';

/** מיכאל 24/11: סינון לצפון השאיר ב"חזרו מהקו" את כל הארץ. */
const items = [{ id: 'a', zoneId: 'haifa' }, { id: 'b', zoneId: 'negev' }, { id: 'c', zoneId: 'galil' }];

test('אזורים נבחרים מסננים גם את מה שחזר מהקו', () => {
  assert.deepEqual(inSelectedZones(items, ['haifa', 'galil']).map((i) => i.id), ['a', 'c']);
});

test('בלי אזור נבחר רואים הכל', () => {
  assert.equal(inSelectedZones(items, []).length, 3);
});
