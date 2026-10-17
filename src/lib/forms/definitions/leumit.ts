import type { FormDefinition, FormField } from '../types.ts';
import { returnDeviceRows, returnReason } from './shared.ts';

/**
 * ✅ טפסי לאומית, הועתקו מ"אספקה לאומית.pdf" ו"לאומית החזרה.pdf" (עמי,
 * 04/08/2026, אילונה אישרה ב-15/10/2026).
 *
 * 🔴 עמוד 2 של טופס האספקה הוא **שטר חוב לא סחיר**. הוא לא נחתם אצלנו על
 * המסך: נחתם על נייר ומצולם (`photos`), עד שעמי או עורך הדין של ר.שעל יאשרו
 * שחתימה דיגיטלית על שטר מחזיקה. ראה `definitions/README.md`.
 */

const BRAND = '#00843D';

export const leumitDelivery: FormDefinition = {
  key: 'leumit-delivery',
  kind: 'delivery',
  healthFundMatches: ['לאומית'],
  fundLabel: 'לאומית',
  title: 'אישור קבלת פריט שיקום וניידות',
  brandColor: BRAND,
  sections: [
    {
      title: 'פרטי הלקוח',
      fields: [
        { key: 'fullName', label: 'שם מלא', type: 'text', prefill: 'customerName', required: true },
        { key: 'idNumber', label: 'תעודת זהות', type: 'id', prefill: 'idNumber', required: true },
        { key: 'phone', label: 'מספר טלפון', type: 'tel', prefill: 'phone', required: true },
        {
          key: 'fullAddress', label: 'כתובת מגורים (רחוב, מס\' בית, שם היישוב, מיקוד)',
          type: 'text', prefill: 'fullAddress', required: true, span: 3,
        },
      ],
    },
    {
      title: 'פרטי מוצר',
      // ⭐ חמש שורות כמו בטופס. השורה הראשונה חובה, השאר משורות ההזמנה אם יש.
      fields: [
        ...[1, 2, 3, 4, 5].flatMap((n): FormField[] => [
          {
            key: `item${n}State`, label: `${n}. פריט חדש/מחודש`, type: 'radio', required: n === 1,
            options: [{ value: 'new', label: 'חדש' }, { value: 'refurbished', label: 'מחודש' }],
          },
          { key: `item${n}Treatment`, label: 'קוד טיפול', type: 'text' },
          { key: `item${n}Commitment`, label: 'מספר התחייבות', type: 'text' },
          { key: `item${n}Catalog`, label: 'מספר קטלוגי', type: 'text', fromLine: { index: n - 1, prop: 'catalog' } },
          { key: `item${n}Model`, label: 'דגם פריט שסופק', type: 'text', required: n === 1, span: 2,
            fromLine: { index: n - 1, prop: 'name' } },
        ]),
        { key: 'supplierName', label: 'שם הספק', type: 'text', prefill: 'supplierName', readOnly: true },
        { key: 'supplierContact', label: 'מספר טלפון וכתובת דוא"ל ליצירת קשר עם הספק', type: 'text', span: 2 },
      ],
    },
  ],
  declarations: [
    'מאשר שקיבלתי את הפריט במצב תקין.',
    'מתחייב להשתמש בפריט ולתחזק אותו בהתאם להוראות הספק וכאמור בעלון שסופק לי.',
    'מתחייב כי בכל תקלה או שבר, אפנה לספק לפי פרטי הקשר המפורטים בטופס זה, ולא אנסה לתקן בעצמי או באמצעות מי מטעמי.',
    'מתחייב כי בסיום השימוש אשיב את הפריט לספק, כשהוא שלם וכולל את כל החלקים שחוברו לו על ידי הספק (באחריות הספק לאסוף את הפריט מבית הלקוח בתיאום מראש).',
    'במקרה שנדרש שטר חוב, אני מאשר כי הספק יוכל לגבות ממני את הסכום הנקוב בשטר, אך ורק אם הפריט לא הושב לספק בסיום השימוש בו.',
  ],
  signatures: [{ key: 'customer', label: 'חתימת הלקוח', nameLabel: 'שם הלקוח', required: true }],
  photos: [
    {
      key: 'promissoryNote', label: 'שטר חוב לא סחיר, חתום', required: false,
      hint: 'עמוד 2 בטופס לאומית. נחתם על נייר ומצולם, יחד עם צילום ת"ז של עושה השטר',
    },
    { key: 'idPhoto', label: 'צילום תעודת זהות של עושה השטר', required: false },
  ],
};

export const leumitReturn: FormDefinition = {
  key: 'leumit-return',
  kind: 'return',
  healthFundMatches: ['לאומית'],
  fundLabel: 'לאומית',
  title: 'טופס אישור החזרת מכשירי ניידות/שיקום',
  brandColor: BRAND,
  sections: [
    {
      title: 'פרטי הספק',
      fields: [
        { key: 'supplierName', label: 'שם הספק', type: 'text', prefill: 'supplierName', readOnly: true },
        { key: 'formDate', label: 'תאריך', type: 'date', prefill: 'today', required: true },
        { key: 'pickupAddress', label: 'כתובת לאיסוף', type: 'text', prefill: 'fullAddress' },
      ],
    },
    {
      title: 'פרטי הלקוח הזכאי למכשיר המוחזר',
      fields: [
        { key: 'customerName', label: 'שם הלקוח', type: 'text', prefill: 'customerName', required: true },
        { key: 'idNumber', label: 'מספר תעודת זהות', type: 'id', prefill: 'idNumber', required: true },
        { key: 'phone', label: 'טלפון', type: 'tel', prefill: 'phone', required: true },
        { key: 'phoneAlt', label: 'טלפון נוסף', type: 'tel', prefill: 'phoneAlt' },
        { key: 'returnerName', label: 'שם מחזיר המכשיר', type: 'text', prefill: 'customerName', required: true },
        { key: 'returnerPhone', label: 'מספר טלפון', type: 'tel' },
      ],
    },
    {
      title: 'סיבת החזרה',
      fields: returnReason(['החלפת מכשיר', 'מעבר לאשפוז סיעודי', 'המכשיר אינו מתאים לצרכי הפונה', 'פטירה']),
    },
    {
      title: 'פרטי המכשירים שהוחזרו',
      fields: returnDeviceRows({
        rows: 4,
        nameLabel: 'שם / סוג מכשיר',
        serialLabel: 'מספר סודר/ סריאלי',
        requestNumber: true,
        purchaseDate: true,
        conditionLabels: ['שלם', 'חסרים חלקים', 'פגום'],
        detailLabel: (n) => `פירוט מצב מכשיר ${n}`,
      }),
    },
    {
      title: 'פרטי שטר/אישור התחייבות',
      fields: [
        { key: 'notes', label: 'הערה', type: 'textarea', span: 3 },
        {
          key: 'noteFate', label: 'השטר/אישור ההתחייבות', type: 'radio', required: true, span: 3,
          options: [
            { value: 'kept', label: 'נשאר/ו בלאומית. לא יעשה בהם כל שימוש אם המכשירים הוחזרו בשלמותם' },
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
};
