import test from 'node:test';
import assert from 'node:assert/strict';
import {
  pickDocument,
  DOC_PREFIX_BY_FORM,
  DOC_TYPE_BY_PREFIX,
  DOC_TYPE_BY_FORM,
} from '../api/_lib/doc-prefill.ts';

/**
 * 🔴 **הקובץ הזה מייבא את המימוש עצמו ולא מעתיק אותו.**
 * `phone-parity.test.mjs` שכן מחזיק עותק ידני, וזה מוצדק שם כי הצד השני
 * הוא SQL. כאן אין צד שני, ולכן עותק היה רק הופך את הבדיקה לשומרת על
 * עצמה. ראה [[dual_implementation_needs_byte_identical_guard]].
 *
 * מה נבדק כאן: מה שנכתב ללקוח על המסמך שמצורף לו. זו הנקודה היחידה
 * במוצר שבה טעות שקטה יוצאת החוצה בשם החברה.
 */

// שורה אמיתית של תעודת משלוח, כפי שהתוסף שולח אותה: כל מה שנראה בשורה.
const DELIVERY_ROW = ['227738572', 'נסים וישנבצקי', 'SH2603398', 'SO2603044', '3', '2026-08-22'];

test('תעודת משלוח: התעודה מנצחת את ההזמנה שממנה נוצרה', () => {
  const d = pickDocument('DOCUMENTS_D', DELIVERY_ROW);
  assert.equal(d.doc_number, 'SH2603398');
  assert.equal(d.doc_type, 'תעודת משלוח');
  assert.equal(d.subject, 'תעודת המשלוח');
});

test('הזמנת מכר באותה שורה בוחרת את ההזמנה ולא את התעודה', () => {
  assert.equal(pickDocument('ORDERS', DELIVERY_ROW).doc_number, 'SO2603044');
});

test('חשבונית מס: המספר והכיתוב מגיעים לבד', () => {
  const d = pickDocument('AINVOICES', ['101143', 'גונן יעל', 'IN2600030', '5795']);
  assert.equal(d.doc_number, 'IN2600030');
  assert.equal(d.doc_type, 'חשבונית מס');
  assert.equal(d.subject, 'החשבונית');
});

test('🔴 חשבונית זיכוי אינה חשבונית מס, למרות שהיא באותו מסך', () => {
  // נמדד 22/08/2026: 23 שורות `IK` ב-`AINVOICES`, כולן בסכום שלילי,
  // כולן `IVTYPE='A'` בדיוק כמו `IN`. לפי המסך לבדו הן זהות.
  const d = pickDocument('AINVOICES', ['101143', 'גונן יעל', 'IK2600023', '-9000']);
  assert.equal(d.doc_number, 'IK2600023');
  assert.equal(d.doc_type, 'חשבונית זיכוי', 'ללקוח נכתב "חשבונית מס" על מסמך זיכוי');
});

test('🔴 חשבונית וזיכוי באותה שורה: ריק, כי אין דרך לדעת מי מהם', () => {
  const d = pickDocument('AINVOICES', ['101143', 'IN2600030', 'IK2600023']);
  assert.equal(d.doc_number, '', 'נבחר מספר בניחוש במקום להשאיר שדה שהעובד ימלא');
  // בלי מספר, הכיתוב חוזר למסך. הוא עדיין נכון ברוב המקרים, והעובד רואה
  // אותו בתצוגה המקדימה לפני שהוא שולח.
  assert.equal(d.doc_type, 'חשבונית מס');
});

test('חשבונית מרכזת: הקידומת שלה מנצחת את מסמך המקור שבשורה', () => {
  // `CINVOICES.DOCNO` הוא מסמך המקור (`SH` או `SC`), לא מספר החשבונית.
  const d = pickDocument('CINVOICES', ['101143', 'SI26602993', 'SH2603393']);
  assert.equal(d.doc_number, 'SI26602993');
  assert.equal(d.doc_type, 'חשבונית מרכזת');
});

test('קריאת שירות: `SC` נשאר קריאת שירות ולא נגרר לחשבוניות', () => {
  const d = pickDocument('SERVCALLS', ['101143', 'SC2602764']);
  assert.equal(d.doc_number, 'SC2602764');
  assert.equal(d.doc_type, 'קריאת שירות');
});

test('🔴 טיוטה לא מקבלת מספר, ולכן לא יוצאת ללקוח בלחיצה אחת', () => {
  // בפריוריטי מסמך בטיוטה מקבל אות אחת ומספר רץ: `T14388` בחשבונית,
  // `T20` בתעודת משלוח, `T57247` בחשבונית מרכזת. שלושתם נמדדו במחסן.
  for (const [form, draft] of [
    ['AINVOICES', 'T14388'],
    ['DOCUMENTS_D', 'T20'],
    ['CINVOICES', 'T57247'],
  ]) {
    assert.equal(pickDocument(form, ['101143', draft]).doc_number, '', `${draft} נבחר כמספר מסמך`);
  }
});

test('מסך שלא מיפינו: מסומן לגילוי, ומספר יחיד עדיין נבחר', () => {
  const one = pickDocument('SOMETHING_NEW', ['101143', 'IR2600007']);
  assert.equal(one.needs_measure, true);
  assert.equal(one.doc_number, 'IR2600007');
  assert.equal(one.doc_type, '', 'הומצא כיתוב למסמך שלא ראינו מעולם');
  assert.equal(one.subject, 'הפנייה');

  const two = pickDocument('SOMETHING_NEW', ['101143', 'IR2600007', 'SH2603398']);
  assert.equal(two.doc_number, '', 'נבחר אחד משניים בלי שום בסיס');
});

/**
 * 🔴 **חשבונית מס קבלה היא המקרה שבו יש כיתוב אבל אין מדידה.**
 * שם הטופס `EINVOICES` נמסר על ידי עידן (22/08/2026), אבל המסך סגור
 * ל-OData אצל ר.שעל ואין לו טבלה במחסן, ולכן הקידומת של המסמכים שם
 * לא נמדדה. מסך כזה **חייב** להמשיך להירשם לגילוי, אחרת הכיתוב היה
 * מסתיר את העובדה שהמפה שם עדיין חלקית.
 */
test('🔴 חשבונית מס קבלה: יש כיתוב, ועדיין נרשמת לגילוי', () => {
  const d = pickDocument('EINVOICES', ['101143', 'גונן יעל', 'EI2600014']);
  assert.equal(d.doc_type, 'חשבונית מס קבלה');
  assert.equal(d.subject, 'החשבונית');
  assert.equal(d.doc_number, 'EI2600014', 'מספר יחיד בשורה נבחר גם בלי קידומת שנמדדה');
  assert.equal(d.needs_measure, true, 'מסך בלי מדידה סומן כמופה, והקידומת שלו לא תגיע אלינו לעולם');
});

test('מסך שנמדד אינו נרשם לגילוי, ושם הטופס אינו רגיש לאותיות', () => {
  assert.equal(pickDocument('ainvoices', ['IN2600030']).doc_number, 'IN2600030');
  assert.equal(pickDocument('DOCUMENTS_D', []).needs_measure, false);
  assert.equal(pickDocument('', []).needs_measure, true);
  assert.equal(pickDocument(null, []).subject, 'הפנייה');
});

test('מספר לקוח וכמות לא נתפסים כמספר מסמך', () => {
  const d = pickDocument('AINVOICES', ['101143', '26014267', '0523694547', '3']);
  assert.equal(d.doc_number, '');
});

/**
 * 🔴 **התבנית המאושרת פותחת ב"מצורפת", והנוסח שלה קפוא אצל מטא.**
 * שינוי מילה בתבנית דורש הגשה מחדש ו-24 עד 48 שעות המתנה, ולכן סוג מסמך
 * בלשון זכר ("מצורפת מסמך") הוא תקלה שאי אפשר לתקן בו ביום.
 * הבדיקה נועלת את המשפט המלא, ולא רק את המילה.
 */
const APPROVED_SENTENCES = new Set([
  'מצורפת הזמנה',
  'מצורפת תעודת משלוח',
  'מצורפת קריאת שירות',
  'מצורפת חשבונית מס',
  'מצורפת חשבונית זיכוי',
  'מצורפת חשבונית מרכזת',
  'מצורפת חשבונית מס קבלה',
  'מצורפת הזמנת רכש',
]);

test('🔴 כל סוג מסמך מתחבר ל"מצורפת" למשפט תקין', () => {
  for (const t of [...Object.values(DOC_TYPE_BY_FORM), ...Object.values(DOC_TYPE_BY_PREFIX)]) {
    assert.ok(
      APPROVED_SENTENCES.has('מצורפת ' + t),
      `"מצורפת ${t}" לא נבדק. אם המשפט תקין, הוסף אותו לרשימה המאושרת`,
    );
  }
});

test('כל קידומת שממופה למסך יודעת גם מה שמה', () => {
  for (const [form, prefixes] of Object.entries(DOC_PREFIX_BY_FORM)) {
    for (const p of prefixes) {
      assert.ok(DOC_TYPE_BY_PREFIX[p], `לקידומת ${p} (${form}) אין כיתוב`);
    }
  }
});
