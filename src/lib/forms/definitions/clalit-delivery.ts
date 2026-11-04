import type { FormDefinition } from '../types.ts';
import { personFields } from './meuhedet.ts';

/**
 * ✅ כללית, אספקה: טופס על המסך מ-04/11/2026 (עידן), במקום צילום טופס הפורטל.
 * הבסיס: **עמוד 1 בלבד** של טופס מאוחדת "אישור קבלת ציוד שיקום / ניידות" (הסריקה
 * ששלח עידן 04/11 13:54 היא העמוד הזה), עם לוגו כללית במקום מאוחדת, בלי הפס
 * השחור ובלי מספר העמוד. עמודים 2-4 של מאוחדת (כתב התחייבות, ערב, שטר חוב)
 * לא נכנסים, לפי עידן ("כן, עמוד אחד").
 * ⭐ השדות מגיעים מאותו `personFields` של מאוחדת, מקור אחד.
 * 🔴 עד 04/11 היה כאן `photoOnly` (עמי, 04/08: "אין בהם שורת החתמה"). צילום
 *    טופס הפורטל נשאר כצילום רשות, למקרה שהמשרד הדפיס אותו.
 */
export const clalitDelivery: FormDefinition = {
  key: 'clalit-delivery',
  kind: 'delivery',
  healthFundMatches: ['כללית'],
  fundLabel: 'כללית',
  title: 'אישור קבלת ציוד שיקום / ניידות',
  brandColor: '#1F7A4D',
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
        { key: 'staffName', label: 'שם המוסר', type: 'text', prefill: 'driverName' },
        { key: 'staffRole', label: 'תפקיד', type: 'text' },
        { key: 'staffPhone', label: 'מספר טלפון', type: 'tel' },
      ],
    },
  ],
  declarationStyle: 'plain',
  declarations: ['אני החתום מטה, מאשר שקיבלתי את הציוד במצב תקין.'],
  signatures: [
    { key: 'customer', label: 'חתימת המקבל', nameLabel: 'שם המקבל', required: true },
    { key: 'driver', label: 'חתימת המציע', nameLabel: 'שם המציע (נציג הספק)', required: true },
  ],
  photos: [
    {
      key: 'portalForm', label: 'טופס האספקה מהפורטל של כללית, אם הודפס וחתום', required: false,
      hint: 'רשות. אם המשרד הדפיס את טופס הפורטל והלקוח חתם עליו, לצלם את כל הדף',
    },
  ],
};
