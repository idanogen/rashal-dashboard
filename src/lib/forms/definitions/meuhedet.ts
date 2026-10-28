import type { FormDefinition, FormField } from '../types.ts';

/**
 * ✅ טופס האספקה של מאוחדת ("נוסח מעודכן"), הועתק מ"אספקה מאוחדת.pdf"
 * (עמי, 04/08/2026, אילונה אישרה ב-15/10/2026). ארבעה עמודים במקור:
 *   1. אישור קבלת ציוד שיקום / ניידות
 *   2-3. כתב התחייבות להחזרת ציוד, עם פרטי הערב
 *   4. שטר חוב לא סחיר + ערבות אוואל
 * עמודים 1-3 נחתמים כאן. 🔴 עמוד 4 (השטר) נחתם על נייר ומצולם, כמו בלאומית.
 *
 * מאוחדת מחזירה ציוד בטופס של משרד הבריאות (`moh-return`), לפי עמי.
 */

const BRAND = '#E4002B';

function personFields(prefix: string, prefillFromCustomer: boolean, relation: boolean): FormField[] {
  const p = (k: FormField['prefill']) => (prefillFromCustomer ? k : undefined);
  const fields: FormField[] = [
    { key: `${prefix}LastName`, label: 'שם משפחה', type: 'text', prefill: p('lastName') },
    { key: `${prefix}FirstName`, label: 'שם פרטי', type: 'text', prefill: p('firstName') },
    { key: `${prefix}IdNumber`, label: 'מספר זהות', type: 'id', prefill: p('idNumber') },
  ];
  if (relation) fields.push({ key: `${prefix}Relation`, label: 'יחס קרבה לזכאי', type: 'text' });
  if (prefillFromCustomer) fields.push({ key: `${prefix}Phone`, label: 'מספר טלפון', type: 'tel', prefill: 'phone' });
  fields.push(
    { key: `${prefix}Mobile`, label: 'מספר טלפון נייד', type: 'tel', prefill: p('phone') },
    { key: `${prefix}PhoneAlt`, label: 'מספר טלפון נוסף', type: 'tel', prefill: p('phoneAlt') },
    { key: `${prefix}Street`, label: 'שם הרחוב', type: 'text', prefill: p('address') },
    { key: `${prefix}HouseNumber`, label: 'מספר הבית', type: 'text', prefill: p('houseNumber') },
    { key: `${prefix}City`, label: 'שם הישוב', type: 'text', prefill: p('city') },
    { key: `${prefix}Zip`, label: 'מיקוד', type: 'text', prefill: p('zipCode') },
  );
  return fields;
}

function equipmentRows(rows: number): FormField[] {
  const out: FormField[] = [];
  for (let i = 0; i < rows; i++) {
    const n = i + 1;
    const first = i === 0;
    out.push(
      { key: `eq${n}Catalog`, label: `${n}. מספר קטלוגי`, type: 'text', fromLine: { index: i, prop: 'catalog' } },
      { key: `eq${n}Desc`, label: 'תיאור הציוד', type: 'text', fromLine: { index: i, prop: 'name' } },
      { key: `eq${n}Serial`, label: 'מספר סידורי (סיריאלי)', type: 'text', fromLine: { index: i, prop: 'serial' } },
      { key: `eq${n}SupplyDate`, label: 'תאריך אספקה', type: 'date', prefill: first ? 'today' : undefined },
      { key: `eq${n}Cost`, label: 'עלות הציוד בש"ח', type: 'money', span: 2 },
    );
  }
  return out;
}

export const meuhedetDelivery: FormDefinition = {
  key: 'meuhedet-delivery',
  kind: 'delivery',
  healthFundMatches: ['מאוחדת'],
  fundLabel: 'מאוחדת',
  title: 'אישור קבלת ציוד שיקום / ניידות',
  subtitle: 'נוסח מעודכן',
  brandColor: BRAND,
  sections: [
    {
      title: 'פרטי השובר',
      fields: [
        { key: 'formDate', label: 'תאריך', type: 'date', prefill: 'today' },
        { key: 'voucherNumber', label: 'מספר שובר זכאות', type: 'text' },
      ],
    },
    { title: 'פרטי הזכאי לציוד', fields: personFields('elig', true, false) },
    { title: 'פרטי מקבל הציוד (אם אינו הזכאי הנ"ל)', fields: personFields('recv', false, true) },
    {
      title: 'פרטי הציוד שהתקבל ופרטי המוסר',
      fields: [
        { key: 'equipmentDesc', label: 'תיאור הציוד', type: 'text', prefill: 'items', span: 2 },
        { key: 'equipmentModel', label: 'הדגם', type: 'text', prefill: 'deviceModel' },
        { key: 'supplierName', label: 'שם הספק', type: 'text', prefill: 'supplierName', readOnly: true },
        { key: 'equipmentSerial', label: 'מספר סידורי', type: 'text', prefill: 'deviceSerial' },
        // ⭐ כך מודפס במקור ("שם הציוד", כנראה טעות של מאוחדת במקום "שם המוסר"), והועתק כמו שהוא.
        { key: 'staffName', label: 'שם הציוד', type: 'text', prefill: 'driverName' },
        { key: 'staffRole', label: 'תפקיד', type: 'text' },
        { key: 'staffPhone', label: 'מספר טלפון', type: 'tel' },
      ],
    },
    { title: 'כתב התחייבות להחזרת ציוד: פרטי הציוד שנמסר לזכאי', fields: equipmentRows(5) },
    { title: 'פרטי הערב', fields: personFields('guar', false, true) },
    {
      title: 'מי קיבל את הציוד',
      fields: [
        {
          key: 'receivedBy', label: 'קבלת הציוד', type: 'radio', span: 3,
          options: [
            { value: 'eligible', label: 'הזכאי קיבל את ציוד בעצמו' },
            { value: 'guarantor', label: 'הערב קיבל את ציוד בשם הזכאי ועבורו' },
          ],
        },
      ],
    },
  ],
  declarationStyle: 'plain',
  declarations: [
    'אני החתום מטה, מאשר שקיבלתי את הציוד במצב תקין.',
    'א. הואיל ונמסר היום לזכאי הנ"ל הציוד המפורטים לעיל, אנו, הזכאי ו/או הערב, מצהירים בזאת שידוע לנו כי:',
    '1. הציוד הנ"ל הינו רכוש הספק.',
    '2. הספק מוכן להשאיל את ציוד הנ"ל לזכאי.',
    '3. על הזכאי להחזיר את ציוד לספק עם תום השימוש בו לרבות במקרה של קבלת ציוד חלופי.',
    'ב. לפיכך אני/ו מתחייבים, ביחד ולחוד כלהלן:',
    '1. המבוא להתחייבות זו מהווה חלק בלתי נפרד מן ההתחייבות.',
    '2. להחזיר את ציוד בתום תקופת השימוש לספק ממנו קיבלתי את הציוד.',
    '3. זכאי או מי מטעמו שלא יחזיר / יהיה מוכן להחזיר את ציוד בתום תקופת השימוש, יהיה רשאי להשאיר אצלו את ציוד בתנאי שישלם תמורתו לספק סכום של 10,000 ₪.',
    '4. קופת חולים מאוחדת ו/או הספק לא יישאו בעלות תיקון או באחריות כלשהי על ציוד שנשאר בידי הזכאי ועל הזכאי לוודא שכל סימון של קופת חולים מאוחדת יוסר מהציוד.',
    '5. להקפיד להשתמש בציוד על פי הוראות היצרן/ הספק/ הקופה.',
    '6. לשלם לקופת חולים מאוחדת ו/או לספק, בכפוף לאישור קופת חולים מאוחדת, כל סכום שיידרש ממני בעבור תיקון נזקים '
      + 'שנגרמו לציוד שהוחזר לספק עקב שימוש רשלני או הזנחה.',
    '7. ידוע לי כי סכום ההשתתפות של הזכאי והמשפחה בעבור הציוד מהווה דמי שימוש בלבד ואינו מקנה זכות קניין למשתמש.',
    '8. אם לא אחזיר את הציוד בתום תקופת השימוש ולא יאוחר מ- 30 יום מתום השימוש בו, יהיה עליי לשלם למאוחדת את סכום עלות הציוד בכפוף לסעיף ב.3 לעיל.',
    '9. להבטחת מילוי ההתחייבות הנ"ל אני מצרף בזאת שטר חוב על סך 10,000 ₪.',
    '10. אם לא אחזיר את הציוד כאמור ובכפוף לתנאים המופיעים בסעיף ב.3 לעיל, יהיה הספק זכאי לממש את שטר החוב באמצעות הליך משפטי.',
  ],
  signatures: [
    { key: 'customer', label: 'חתימת הזכאי', nameLabel: 'שם המקבל', required: true },
    { key: 'guarantor', label: 'חתימת הערב', nameLabel: 'שם הערב', required: false },
    { key: 'driver', label: 'חתימת המציע', nameLabel: 'שם המציע (נציג הספק)', required: true },
  ],
  footerNote: 'הערה: על הספק להעביר העתק חתום של מסמך זה, בצירוף שטר החוב, לשרשרת אספקה.',
  photos: [
    {
      key: 'promissoryNote', label: 'שטר חוב לא סחיר וערבות אוואל, חתומים', required: false,
      hint: 'עמוד 4 בטופס מאוחדת. נחתם על נייר ומצולם, יחד עם צילום ת"ז של עושה השטר',
    },
    { key: 'idPhoto', label: 'צילום תעודת זהות של עושה השטר', required: false },
  ],
};
