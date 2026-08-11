import type { FormDefinition } from '../types';

/**
 * 🟡 טופס דמו — כללית, אישור קבלת פריט שיקום וניידות.
 *
 * לא הועתק מטופס אמיתי של כללית: טופס האספקה של כללית לא נמסר לנו. השדות כאן
 * הם המכנה המשותף שחוזר בטפסי האספקה של מכבי, לאומית ומאוחדת, ולכן ההחלפה
 * בטופס האמיתי כשיגיע היא עריכה של הקובץ הזה בלבד.
 *
 * כללית היא 414 מתוך ההזמנות הפעילות, השנייה בגודלה אחרי משרד הבריאות, ולכן
 * זה הטופס שנבחר להדגמה.
 */
export const clalitDelivery: FormDefinition = {
  key: 'clalit-delivery',
  kind: 'delivery',
  healthFundMatches: ['כללית'],
  fundLabel: 'כללית',
  title: 'אישור קבלת פריט שיקום וניידות',
  subtitle: 'שירותי בריאות כללית',
  brandColor: '#00A0B0',
  isDemo: true,

  sections: [
    {
      title: 'פרטי הלקוח',
      fields: [
        { key: 'lastName',   label: 'שם משפחה',      type: 'text', prefill: 'lastName',  required: true },
        { key: 'firstName',  label: 'שם פרטי',        type: 'text', prefill: 'firstName', required: true },
        { key: 'idNumber',   label: 'מספר תעודת זהות', type: 'id',   prefill: 'idNumber',  required: true,
          hint: 'לא קיים אצלנו במערכת, יש להקליד מהתעודה' },
        { key: 'phone',      label: 'טלפון',          type: 'tel',  prefill: 'phone',     required: true },
        { key: 'phoneAlt',   label: 'טלפון נוסף',      type: 'tel',  prefill: 'phoneAlt' },
        { key: 'address',    label: 'רחוב',            type: 'text', prefill: 'address',   required: true, span: 2 },
        { key: 'houseNumber',label: 'מספר בית',        type: 'text', prefill: 'houseNumber' },
        { key: 'city',       label: 'יישוב',           type: 'text', prefill: 'city',      required: true },
        { key: 'zipCode',    label: 'מיקוד',           type: 'text', prefill: 'zipCode' },
      ],
    },
    {
      title: 'פרטי הפריט שסופק',
      fields: [
        { key: 'deviceDesc',   label: 'תיאור הפריט',     type: 'text', prefill: 'items', required: true, span: 3 },
        { key: 'deviceModel',  label: 'דגם',             type: 'text', prefill: 'deviceModel' },
        { key: 'deviceSerial', label: 'מספר סידורי',      type: 'text', prefill: 'deviceSerial', required: true,
          hint: 'מהמדבקה על המכשיר' },
        { key: 'condition',    label: 'מצב הפריט',       type: 'radio', required: true,
          options: [
            { value: 'new',       label: 'חדש' },
            { value: 'refurbished', label: 'מחודש' },
          ] },
        { key: 'commitmentNumber', label: 'מספר התחייבות', type: 'text' },
        { key: 'orderNumber',  label: 'מספר הזמנה',      type: 'text', prefill: 'orderNumber', readOnly: true },
        { key: 'supplierName', label: 'שם הספק',         type: 'text', prefill: 'supplierName', readOnly: true },
      ],
    },
    {
      title: 'פרטי מקבל הפריט (אם אינו הלקוח)',
      fields: [
        { key: 'receiverName',     label: 'שם מלא',        type: 'text' },
        { key: 'receiverId',       label: 'תעודת זהות',     type: 'id' },
        { key: 'receiverRelation', label: 'יחס קרבה ללקוח', type: 'text' },
      ],
    },
  ],

  declarations: [
    'אני החתום מטה מאשר כי קיבלתי את הפריט המפורט לעיל במצב תקין.',
    'אני מתחייב להשתמש בפריט ולתחזק אותו בהתאם להוראות הספק וכאמור בעלון שסופק לי.',
    'אני מתחייב כי בכל תקלה או שבר אפנה לספק לפי פרטי הקשר המפורטים בטופס זה, ולא אנסה לתקן בעצמי או באמצעות מי מטעמי.',
    'אני מתחייב כי בסיום השימוש אשיב את הפריט לספק, כשהוא שלם וכולל את כל החלקים שחוברו לו.',
  ],

  signatures: [
    { key: 'customer', label: 'חתימת הלקוח', nameLabel: 'שם החותם', required: true },
  ],

  footerNote: 'טופס זה נחתם דיגיטלית באפליקציית הנהג של ר.שעל ונשמר במערכת.',
};
