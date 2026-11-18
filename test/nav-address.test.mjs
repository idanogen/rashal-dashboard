import test from 'node:test';
import assert from 'node:assert/strict';
import { addressHasNumber, cleanNavAddress, wazeUrlFor } from '../src/lib/nav-address.ts';

/** הכתובת לוויז (אבי, 18/11/2026). */

test('ניקוי דירה, קומה, כניסה וסוגריים', () => {
  assert.equal(cleanNavAddress('מעפילי אגוז 48   (דירה 17)'), 'מעפילי אגוז 48');
  assert.equal(cleanNavAddress('הרצל 5 דירה 3 קומה 2'), 'הרצל 5');
  assert.equal(cleanNavAddress('ויצמן 12, כניסה ב'), 'ויצמן 12');
  assert.equal(cleanNavAddress('העמל 6'), 'העמל 6');
});

test('מספר בית', () => {
  assert.ok(addressHasNumber('העמל 6'));
  assert.ok(!addressHasNumber('וונצואלה'));
  assert.ok(!addressHasNumber('בית חולים (דירה 4)'));
});

test('וויז: כתובת עם מספר נשלחת כטקסט גם כשיש נקודה; בלי מספר הנקודה מנצחת', () => {
  const coords = { lat: 32.092784, lng: 34.818237 };
  const a = wazeUrlFor({ address: 'העמל 6', city: 'רמת גן', coordinates: coords });
  assert.equal(a, `https://waze.com/ul?q=${encodeURIComponent('העמל 6, רמת גן')}&navigate=yes`);
  assert.match(wazeUrlFor({ address: 'בית לוינשטיין', city: 'רעננה', coordinates: coords }), /ll=32\.092784,34\.818237/);
  assert.match(wazeUrlFor({ address: 'וונצואלה', city: 'תל-אביב-יפו' }), /q=/);
  assert.equal(wazeUrlFor({}), null);
});
