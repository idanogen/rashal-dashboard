import type { FormDefinition } from '../types.ts';

/**
 * ✅ טופס אמיתי — משרד הבריאות, אישור ביצוע תיקון / תוספת.
 * הועתק מ"טופס תיקון כללי.pdf". טופס אחד לכל הקופות, ועליו כבר מודפס
 * "ר.שעל" כשם הספק.
 *
 * זה הטופס שמתמלא הכי טוב מעצמו: `service_calls` כבר מחזיק את
 * device_serial · device_name · install_date · warranty_until · fault_desc,
 * הכל מסונכרן מפריוריטי, כך שהטכנאי משלים רק את מה שהוא עשה בפועל.
 *
 * ⭐ 16/10/2026 (עידן: "העתק הכי קרוב שאפשר לטפסים שעמי שלח"): השדות
 * והתוויות הותאמו אחד לאחד לסריקה, כולל טבלת התקלות בחמש שורות, ו-PDF
 * נבנה בתבנית של הטופס עצמו (`layouts/moh-repair.ts`), לא בתבנית הכללית.
 */
export const mohRepair: FormDefinition = {
  key: 'moh-repair',
  kind: 'repair',
  healthFundMatches: ['משרד הבריאות', 'כללית', 'מכבי', 'לאומית', 'מאוחדת', 'משרד הבטחון'],
  fundLabel: 'משרד הבריאות',
  title: 'אישור ביצוע תיקון / תוספת',
  subtitle: 'מכשירי שיקום וניידות',
  brandColor: '#1F4E79',

  sections: [
    {
      title: 'פרטי הספק',
      fields: [
        { key: 'supplierName', label: 'שם הספק', type: 'text', prefill: 'supplierName', readOnly: true },
        { key: 'formDate', label: 'התאריך', type: 'date', prefill: 'today' },
        { key: 'callNumber', label: 'מספר קריאה של הספק', type: 'text', prefill: 'callNumber', readOnly: true },
      ],
    },
    {
      title: 'פרטי התושב הזכאי למכשיר',
      fields: [
        { key: 'lastName', label: 'שם המשפחה', type: 'text', prefill: 'lastName' },
        { key: 'firstName', label: 'השם הפרטי', type: 'text', prefill: 'firstName' },
        { key: 'idNumber', label: 'מספר הזהות', type: 'id', prefill: 'idNumber',
          hint: 'לא קיים אצלנו במערכת, יש להקליד מהתעודה' },
        { key: 'phone', label: 'מספר הטלפון', type: 'tel', prefill: 'phone' },
        { key: 'contactName', label: 'שם איש הקשר', type: 'text' },
        { key: 'contactPhone', label: 'מספר הטלפון של איש הקשר', type: 'tel' },
        { key: 'address', label: 'שם הרחוב', type: 'text', prefill: 'address' },
        { key: 'houseNumber', label: 'מספר הבית', type: 'text', prefill: 'houseNumber' },
        { key: 'city', label: 'שם היישוב', type: 'text', prefill: 'city' },
        { key: 'zipCode', label: 'המיקוד', type: 'text', prefill: 'zipCode' },
      ],
    },
    {
      title: 'מהות התיקון / התוספת',
      fields: [
        { key: 'deviceDesc', label: 'תיאור המכשיר', type: 'text', prefill: 'deviceDesc', span: 2 },
        { key: 'deviceSupplier', label: 'שם הספק', type: 'text', prefill: 'supplierName' },
        { key: 'deviceModel', label: 'הדגם', type: 'text', prefill: 'deviceName' },
        { key: 'deviceSerial', label: 'מספר סודר (סריאלי) של המכשיר (מדבקת משרד הבריאות)', type: 'text',
          prefill: 'deviceSerial', span: 2 },
        { key: 'purchaseDate', label: 'תאריך רכישת המכשיר', type: 'date', prefill: 'installDate' },
        { key: 'requestDate', label: 'תאריך פניית הזכאי לתיקון', type: 'date' },
        { key: 'underWarranty', label: 'בתקופת אחריות', type: 'radio',
          options: [{ value: 'yes', label: 'כן' }, { value: 'no', label: 'לא' }] },
        { key: 'deviceState', label: 'המכשיר', type: 'radio',
          options: [{ value: 'new', label: 'חדש' }, { value: 'refurbished', label: 'מחודש' }] },
      ],
    },
    {
      title: 'התקלה והביצוע',
      fields: [1, 2, 3, 4, 5].flatMap((n): FormDefinition['sections'][number]['fields'] => [
        { key: `fault${n}`, label: `${n}. תאור התקלה`, type: 'textarea', span: 3,
          prefill: n === 1 ? 'faultDesc' : undefined },
        { key: `work${n}`, label: 'חלפים + ביצוע בפועל', type: 'textarea', span: 3 },
        { key: `catalog${n}`, label: 'מק"ט בריאות', type: 'text' },
        { key: `cost${n}`, label: 'עלות', type: 'money' },
      ]),
    },
    {
      title: 'עלות ומקום השירות',
      fields: [
        { key: 'kilometers', label: 'מספר קילומטרים', type: 'number' },
        { key: 'travelCost', label: 'עלות הנסיעה (ללא מע"מ)', type: 'money' },
        { key: 'totalCost', label: 'סה"כ עלות (לפני מע"מ, כולל עלות נסיעה)', type: 'money' },
        { key: 'servicePlace', label: 'מקום מתן השירות', type: 'radio', span: 2,
          options: [
            { value: 'customer', label: 'בית הלקוח' },
            { value: 'supplier', label: 'אצל ספק' },
            { value: 'other', label: 'אחר' },
          ] },
        { key: 'servicePlaceOther', label: 'אחר, פרט', type: 'text' },
        { key: 'repairDate', label: 'תאריך התיקון', type: 'date', prefill: 'today' },
        { key: 'notes', label: 'הערה', type: 'textarea', span: 3 },
        { key: 'lishka', label: 'שם הלשכה (להעברת העתק בצירוף חשבונית)', type: 'text', span: 2 },
      ],
    },
  ],

  signatures: [
    { key: 'driver', label: 'חתימת נותן השירות (הטכנאי)', nameLabel: 'שם נותן השירות (הטכנאי)', required: true },
    { key: 'customer', label: 'חתימת מקבל השירות', nameLabel: 'שם מקבל השירות', required: true },
  ],

  footerNote:
    'על הספק להעביר העתק מטופס זה בצירוף חשבונית למחלקה לסמ"ש בלשכת הבריאות. ' +
    'מענה טלפוני "קול הבריאות" 5400*, פקס מוקד קול הבריאות 02-5655969.',
};
