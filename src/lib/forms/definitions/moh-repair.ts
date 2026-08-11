import type { FormDefinition } from '../types';

/**
 * ✅ טופס אמיתי — משרד הבריאות, אישור ביצוע תיקון / תוספת.
 * הועתק מ"טופס תיקון כללי.pdf". טופס אחד לכל הקופות, ועליו כבר מודפס
 * "ר.שעל" כשם הספק.
 *
 * זה הטופס שמתמלא הכי טוב מעצמו: `service_calls` כבר מחזיק את
 * device_serial · device_name · install_date · warranty_until · fault_desc,
 * הכל מסונכרן מפריוריטי, כך שהטכנאי משלים רק את מה שהוא עשה בפועל.
 *
 * פישוט מודע בגרסה הזו: בטופס המקורי טבלת התקלות היא רב-שורתית
 * (תאור התקלה · חלפים · מק"ט בריאות · עלות). כאן זו שורה אחת מורחבת.
 * ריבוי שורות ייכנס יחד עם טבלת המכשירים של טופס ההחזרה, שהיא אותה בעיה.
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
      title: 'פרטי הקריאה',
      fields: [
        { key: 'supplierName',  label: 'שם הספק',              type: 'text', prefill: 'supplierName', readOnly: true },
        { key: 'callNumber',    label: 'מספר קריאה של הספק',    type: 'text', prefill: 'callNumber', readOnly: true },
        { key: 'formDate',      label: 'תאריך',                type: 'date', prefill: 'today', required: true },
      ],
    },
    {
      title: 'פרטי התושב הזכאי למכשיר',
      fields: [
        { key: 'lastName',    label: 'שם משפחה',              type: 'text', prefill: 'lastName',  required: true },
        { key: 'firstName',   label: 'שם פרטי',                type: 'text', prefill: 'firstName', required: true },
        { key: 'idNumber',    label: 'מספר תעודת זהות',        type: 'id',   prefill: 'idNumber',  required: true,
          hint: 'לא קיים אצלנו במערכת, יש להקליד מהתעודה' },
        { key: 'phone',       label: 'מספר הטלפון',            type: 'tel',  prefill: 'phone', required: true },
        { key: 'contactName', label: 'שם איש הקשר',            type: 'text' },
        { key: 'contactPhone',label: 'טלפון של איש הקשר',      type: 'tel' },
        { key: 'address',     label: 'הרחוב',                  type: 'text', prefill: 'address', span: 2 },
        { key: 'houseNumber', label: 'מספר בית',               type: 'text', prefill: 'houseNumber' },
        { key: 'city',        label: 'שם היישוב',              type: 'text', prefill: 'city', required: true },
        { key: 'zipCode',     label: 'מיקוד',                  type: 'text', prefill: 'zipCode' },
      ],
    },
    {
      title: 'מהות התיקון / תוספת',
      fields: [
        { key: 'deviceDesc',    label: 'תיאור המכשיר',                    type: 'text', prefill: 'deviceName', required: true, span: 2 },
        { key: 'deviceModel',   label: 'דגם',                             type: 'text', prefill: 'deviceModel' },
        { key: 'deviceSerial',  label: 'מספר סודר (סריאלי) של המכשיר',    type: 'text', prefill: 'deviceSerial', required: true,
          hint: 'מודבקת משרד הבריאות' },
        { key: 'purchaseDate',  label: 'תאריך רכישת המכשיר',              type: 'date', prefill: 'installDate' },
        { key: 'receivedDate',  label: 'תאריך פניה וקבלת המכשיר לתיקון',  type: 'date' },
        { key: 'underWarranty', label: 'בתקופת אחריות',                   type: 'radio', required: true,
          options: [
            { value: 'yes',         label: 'כן' },
            { value: 'no',          label: 'לא' },
            { value: 'refurbished', label: 'מחודש' },
          ] },
      ],
    },
    {
      title: 'פירוט הביצוע',
      fields: [
        { key: 'faultDesc',   label: 'תאור התקלה',           type: 'textarea', prefill: 'faultDesc', required: true, span: 3 },
        { key: 'workDone',    label: 'חלפים + ביצוע בפועל',  type: 'textarea', required: true, span: 3 },
        { key: 'mohCatalog',  label: 'מק"ט בריאות',          type: 'text' },
        { key: 'partsCost',   label: 'עלות חלפים',           type: 'money' },
        { key: 'kilometers',  label: 'מספר קילומטרים',       type: 'number' },
        { key: 'travelCost',  label: 'עלות הנסיעה',          type: 'money' },
        { key: 'totalCost',   label: 'סה"כ עלות',            type: 'money', required: true },
        { key: 'servicePlace',label: 'מקום מתן השירות',      type: 'radio', required: true,
          options: [
            { value: 'customer', label: 'בית הלקוח' },
            { value: 'supplier', label: 'אצל הספק' },
            { value: 'other',    label: 'אחר' },
          ] },
        { key: 'repairDate',  label: 'תאריך התיקון',         type: 'date', prefill: 'today', required: true },
        { key: 'notes',       label: 'הערות',                type: 'textarea', span: 3 },
      ],
    },
  ],

  signatures: [
    { key: 'driver',   label: 'חתימת נותן השירות (הטכנאי)', nameLabel: 'שם נותן השירות', required: true },
    { key: 'customer', label: 'חתימת מקבל השירות',          nameLabel: 'שם מקבל השירות', required: true },
  ],

  // 🔴 הערת השוליים במקור מטושטשת בסריקה ולא תועתקה מילה במילה. לפני שימוש
  // מול משרד הבריאות יש להשלים אותה מטופס באיכות קריאה.
  footerNote:
    'על הספק להעביר העתק של טופס זה בצירוף חשבונית למחלקה לסמ"ש בלשכת הבריאות. ' +
    'מענה טלפוני "קול הבריאות" 5400*, פקס 5655969-02.',
};
