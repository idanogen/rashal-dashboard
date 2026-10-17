import test from 'node:test';
import assert from 'node:assert/strict';
import {
  FORM_DEFINITIONS, findForm, noFormReason, formKindForStop, getFormByKey,
} from '../src/lib/forms/registry.ts';
import {
  buildContext, buildInitialValues, missingRequired, isValidIsraeliId, invalidIds, missingPhotos, splitAddress,
} from '../src/lib/forms/prefill.ts';

/**
 * 🔴 טופס קופה שגוי מול לקוח = טופס שהקופה דוחה, וחיוב שלא משולם. לכן
 * הבחירה לפי הקופה נבדקת על הערכים האמיתיים שבמסד (נמדדו 16/10/2026:
 * "כללית הנדסה", "מכבי", "מאוחדת", "לאומית", "משרד הבריאות", "משרד הבטחון",
 * ובכרטיס הלקוח "קופת חולים לאומית" וכו').
 */

const key = (fund, kind) => findForm(fund, kind)?.key ?? null;

test('אספקה: כל קופה לטופס שלה, כללית לצילום הפורטל', () => {
  assert.equal(key('כללית הנדסה', 'delivery'), 'clalit-delivery');
  assert.equal(key('כללית', 'delivery'), 'clalit-delivery');
  assert.equal(key('מכבי', 'delivery'), 'maccabi-delivery');
  assert.equal(key('לאומית', 'delivery'), 'leumit-delivery');
  assert.equal(key('קופת חולים לאומית', 'delivery'), 'leumit-delivery');
  assert.equal(key('מאוחדת', 'delivery'), 'meuhedet-delivery');
  assert.equal(getFormByKey('clalit-delivery').photoOnly, true);
});

test('החזרה: כללית ומאוחדת בטופס משרד הבריאות, מכבי ולאומית בשלהן', () => {
  assert.equal(key('כללית הנדסה', 'return'), 'moh-return');
  assert.equal(key('מאוחדת', 'return'), 'moh-return');
  assert.equal(key('מכבי', 'return'), 'maccabi-return');
  assert.equal(key('לאומית', 'return'), 'leumit-return');
  // ⏸️ הנחה עד אישור עמי: מטופל של משרד הבריאות מחזיר בטופס של המשרד.
  assert.equal(key('משרד הבריאות', 'return'), 'moh-return');
});

test('תיקון: טופס אחד לכל הקופות, גם כשהקופה לא ידועה', () => {
  for (const f of ['כללית הנדסה', 'מכבי', 'משרד הבטחון', '', null]) {
    assert.equal(key(f, 'repair'), 'moh-repair');
  }
});

test('אין טופס: הסבר במקום שקט', () => {
  assert.equal(key('משרד הבטחון', 'delivery'), null);
  assert.match(noFormReason('משרד הבטחון', 'delivery'), /אין טופס אספקה/);
  assert.match(noFormReason('', 'return'), /לא רשומה/);
  assert.equal(noFormReason('מכבי', 'delivery'), null);
});

test('סוג העצירה קובע את סוג הטופס', () => {
  assert.equal(formKindForStop('delivery'), 'delivery');
  assert.equal(formKindForStop('customer'), 'delivery');
  assert.equal(formKindForStop('service'), 'repair');
  assert.equal(formKindForStop('pickup'), 'return');
  assert.equal(formKindForStop('task'), null);
});

test('ההגדרות שלמות: מפתחות ייחודיים, ושדה חובה אחד לפחות בכל טופס עם שדות', () => {
  const keys = FORM_DEFINITIONS.map((d) => d.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(keys.length, 8);
  for (const d of FORM_DEFINITIONS) {
    const fieldKeys = d.sections.flatMap((s) => s.fields.map((f) => f.key));
    // 🔴 מפתח כפול בטופס = שני שדות שנכתבים לאותו ערך.
    assert.equal(new Set(fieldKeys).size, fieldKeys.length, `${d.key}: מפתח שדה כפול`);
    if (d.photoOnly) {
      assert.ok(d.photos.some((p) => p.required), `${d.key}: טופס צילום בלי צילום חובה`);
    } else {
      assert.ok(d.sections.some((s) => s.fields.some((f) => f.required)), d.key);
      assert.ok(d.signatures.some((s) => s.required), `${d.key}: אין חתימת חובה`);
    }
  }
});

test('שטר חוב לא נחתם על המסך: בלאומית ובמאוחדת הוא צילום של נייר', () => {
  for (const k of ['leumit-delivery', 'meuhedet-delivery']) {
    const d = getFormByKey(k);
    assert.ok(d.photos.some((p) => p.key === 'promissoryNote'), k);
    const labels = d.sections.flatMap((s) => s.fields.map((f) => f.label)).join(' ');
    assert.doesNotMatch(labels, /עושה השטר/, `${k}: שדות השטר לא אמורים להיות בטופס הדיגיטלי`);
  }
});

const call = {
  customerName: 'כהן משה', phone: '0501234567', address: 'הרצל 12', city: 'רחובות',
  customerNumber: '123', healthFund: 'מכבי', docNumber: 'SC2603612',
  deviceName: 'RUBIX52*48R', deviceDesc: 'כיסא גלגלים רוביקס', deviceSerial: 'S-1',
  installDate: '2025-03-04T00:00:00', faultDesc: 'גלגל שבור',
  lines: [{ name: 'כיסא גלגלים רוביקס', serial: 'S-1', catalog: 'RUBIX52*48R' }],
};

test('מילוי מוקדם מקריאה: שם, כתובת, מכשיר, תאריך מקומי', () => {
  const now = new Date(2026, 9, 16, 23, 30); // 23:30 מקומי, כבר מחר ב-UTC של חלק מהאזורים
  const ctx = buildContext(call, 'דוד גוזלן', now);
  assert.equal(ctx.lastName, 'כהן');
  assert.equal(ctx.firstName, 'משה');
  assert.equal(ctx.address, 'הרצל');
  assert.equal(ctx.houseNumber, '12');
  assert.equal(ctx.fullAddress, 'הרצל 12, רחובות');
  assert.equal(ctx.callNumber, 'SC2603612');
  assert.equal(ctx.today, '2026-10-16');
  const def = getFormByKey('moh-repair');
  const v = buildInitialValues(def, ctx, call.lines);
  assert.equal(v.deviceSerial, 'S-1');
  assert.equal(v.fault1, 'גלגל שבור');
  assert.equal(v.supplierName, 'ר.שעל');
  // ת"ז לא קיימת אצלנו, ולכן היא חובה שעדיין ריקה
  assert.ok(missingRequired(def, v).includes('מספר הזהות'));
});

test('שורות האיסוף ממלאות את טבלת המכשירים בטופס ההחזרה', () => {
  const lines = [
    { name: 'מיטה חשמלית', serial: 'B-7', catalog: 'BED1' },
    { name: 'מזרן', serial: '', catalog: 'MAT' },
  ];
  const v = buildInitialValues(getFormByKey('maccabi-return'), buildContext({ customerName: 'לוי דנה', lines }, 'x'), lines);
  assert.equal(v.dev1Name, 'מיטה חשמלית');
  assert.equal(v.dev1Serial, 'B-7');
  assert.equal(v.dev2Name, 'מזרן');
  assert.equal(v.dev3Name, '');
});

test('ת"ז: ספרת ביקורת, ריק אינו שגוי', () => {
  assert.equal(isValidIsraeliId('000000018'), true);
  assert.equal(isValidIsraeliId('18'), true); // ריפוד אפסים
  assert.equal(isValidIsraeliId('123456789'), false);
  assert.equal(isValidIsraeliId(''), true);
  assert.equal(isValidIsraeliId('1234567890'), false);
  const def = getFormByKey('maccabi-delivery');
  assert.deepEqual(invalidIds(def, { idNumber: '123456789' }), ['מספר תעודת הזהות']);
});

test('צילום חובה חסר נתפס', () => {
  const d = getFormByKey('clalit-delivery');
  assert.equal(missingPhotos(d, {}).length, 1);
  assert.equal(missingPhotos(d, { portalForm: 'data:image/jpeg;base64,x' }).length, 0);
});

test('כתובת בלי מספר נשארת שלמה', () => {
  assert.deepEqual(splitAddress('מושב בית עוזיאל'), { street: 'מושב בית עוזיאל', houseNumber: '' });
  assert.deepEqual(splitAddress('הרב קוק 5א'), { street: 'הרב קוק', houseNumber: '5א' });
});
