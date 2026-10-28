import type { FormDefinition } from '../types.ts';
import { returnDeviceRows, returnReason } from './shared.ts';

/**
 * ✅ משרד הבריאות, אישור החזרת מכשירי ניידות/שיקום. הועתק מ"טופס החזרה
 * כללית ומאוחדת.pdf" (עמי, 04/08/2026, אילונה אישרה ב-15/10/2026).
 * לפי עמי זה טופס ההחזרה של כללית ושל מאוחדת. ⏸️ לקוחות שהקופה שלהם
 * בפריוריטי היא "משרד הבריאות" ממופים לכאן כהנחה, כי זה הטופס של המשרד;
 * לאשר מול עמי.
 */
export const mohReturn: FormDefinition = {
  key: 'moh-return',
  kind: 'return',
  healthFundMatches: ['כללית', 'מאוחדת', 'משרד הבריאות'],
  fundLabel: 'משרד הבריאות',
  title: 'אישור החזרת מכשירי ניידות/שיקום',
  subtitle: 'מכשירי שיקום וניידות',
  brandColor: '#1F4E79',
  sections: [
    {
      title: 'פרטי הספק',
      fields: [
        { key: 'supplierName', label: 'שם הספק', type: 'text', prefill: 'supplierName', readOnly: true },
        { key: 'formDate', label: 'תאריך', type: 'date', prefill: 'today' },
      ],
    },
    {
      title: 'פרטי התושב הזכאי למכשיר המוחזר',
      fields: [
        { key: 'lastName', label: 'שם המשפחה', type: 'text', prefill: 'lastName' },
        { key: 'firstName', label: 'השם הפרטי', type: 'text', prefill: 'firstName' },
        { key: 'idNumber', label: 'מספר הזהות', type: 'id', prefill: 'idNumber' },
        { key: 'phone', label: 'מספר הטלפון', type: 'tel', prefill: 'phone' },
        { key: 'mobile', label: 'מספר הטלפון הנייד', type: 'tel' },
        { key: 'phoneAlt', label: 'מספר טלפון נוסף', type: 'tel', prefill: 'phoneAlt' },
        { key: 'returnerName', label: 'שם מחזיר המכשיר', type: 'text', prefill: 'customerName' },
        { key: 'returnerPhone', label: 'מספר הטלפון', type: 'tel' },
        { key: 'returnerMobile', label: 'מספר הטלפון הנייד', type: 'tel' },
      ],
    },
    {
      title: 'סיבת ההחזרה',
      fields: returnReason(['החלפת מכשיר', 'מעבר לאשפוז סיעודי', 'פטירה', 'אחר']),
    },
    {
      title: 'פרטי המכשירים שהוחזרו',
      fields: returnDeviceRows({
        rows: 3,
        nameLabel: 'שם/ סוג המכשיר',
        serialLabel: 'מספר סודר (סריאלי)',
        conditionLabels: ['שלם', 'חסרים חלקים', 'פגום'],
        detailLabel: () => 'פירוט מצב המכשיר',
      }),
    },
    {
      title: 'שטר/י החוב בעבור המכשירים',
      fields: [
        { key: 'notes', label: 'הערה', type: 'textarea', span: 3 },
        {
          key: 'noteFate', label: 'שטר/י החוב', type: 'radio', span: 3,
          options: [
            { value: 'kept', label: 'נשאר/ו בלשכת הבריאות. לא יעשה בהם כל שימוש אם המכשירים הוחזרו בשלמותם' },
            { value: 'handed', label: 'נמסרו לידי עושה השטר' },
            { value: 'other', label: 'אחר' },
          ],
        },
        { key: 'noteFateOther', label: 'אחר, פרט', type: 'text', span: 3 },
      ],
    },
  ],
  signatures: [
    { key: 'customer', label: 'חתימת מחזיר המכשיר (הרשום לעיל)', nameLabel: 'שם מחזיר המכשיר', required: true },
    { key: 'driver', label: 'חתימת המקבל', nameLabel: 'שם המקבל', required: true },
  ],
  // ⭐ הועתק מהסריקה ברזולוציה גבוהה (17/10/2026): "יהודה ונח מוזס 15".
  footerNote:
    'אם החזרת המכשיר/ים והחתימה על אישור ההחזרה לא נעשו בלשכת הבריאות, ' +
    'יש להעביר את הטופס הזה אל חברת נטלי/ המחסן הארצי ברחוב יהודה ונח מוזס 15 תל אביב',
};
