import type { FormDefinition } from '../types.ts';
import { returnDeviceRows, returnReason } from './shared.ts';

/**
 * ✅ טפסי מכבי, הועתקו מ"אספקה מכבי.pdf" ו"מכבי החזרה.pdf" (עמי, 04/08/2026,
 * אילונה אישרה שהם הנכונים ב-15/10/2026). התוויות כפי שהן מודפסות.
 */

const BRAND = '#0B3D91';

export const maccabiDelivery: FormDefinition = {
  key: 'maccabi-delivery',
  kind: 'delivery',
  healthFundMatches: ['מכבי'],
  fundLabel: 'מכבי',
  title: 'אישור קבלת מכשיר שיקום וניידות',
  subtitle: 'מכשיר שיקום וניידות',
  brandColor: BRAND,
  sections: [
    {
      title: 'פרטי הספק',
      fields: [
        { key: 'supplierName', label: 'שם הספק', type: 'text', prefill: 'supplierName', readOnly: true },
        { key: 'formDate', label: 'תאריך', type: 'date', prefill: 'today', required: true },
        { key: 'district', label: 'שייך למחוז', type: 'text' },
        { key: 'pickupAddress', label: 'כתובת לאיסוף', type: 'text', prefill: 'fullAddress', span: 3 },
      ],
    },
    {
      title: 'פרטי חבר הזכאי למכשיר',
      fields: [
        { key: 'lastName', label: 'שם המשפחה', type: 'text', prefill: 'lastName', required: true },
        { key: 'firstName', label: 'השם הפרטי', type: 'text', prefill: 'firstName', required: true },
        { key: 'idNumber', label: 'מספר תעודת הזהות', type: 'id', prefill: 'idNumber', required: true },
        { key: 'address', label: 'כתובת', type: 'text', prefill: 'address', required: true },
        { key: 'houseNumber', label: 'מספר בית', type: 'text', prefill: 'houseNumber' },
        { key: 'city', label: 'עיר', type: 'text', prefill: 'city', required: true },
        // ⭐ כך מודפס בטופס האספקה של מכבי ("מחזיר" ולא "מחזיק"), והועתק כמו שהוא.
        { key: 'holderName', label: 'שם מחזיר המכשיר', type: 'text', prefill: 'customerName' },
        { key: 'phone', label: 'מספר טלפון נייד/בית', type: 'tel', prefill: 'phone', required: true },
        { key: 'phoneAlt', label: 'מספר טלפון נייד נוסף', type: 'tel', prefill: 'phoneAlt' },
      ],
    },
    {
      title: 'פרטי הפריט שסופק לחבר',
      fields: [
        {
          key: 'deviceSource', label: 'המכשיר', type: 'radio', required: true,
          options: [{ value: 'new', label: 'מכשיר חדש' }, { value: 'stock', label: 'מכשיר מהמלאי' }],
        },
        { key: 'deviceDesc', label: 'תיאור המכשיר', type: 'text', prefill: 'items', required: true, span: 2 },
        { key: 'deviceSerial', label: 'מספר סודר (סריאלי) של המכשיר', type: 'text', prefill: 'deviceSerial', required: true },
        { key: 'deviceModel', label: 'הדגם שסופק', type: 'text', prefill: 'deviceModel', span: 2 },
      ],
    },
    {
      title: 'השתתפות עצמית',
      fields: [
        {
          key: 'copay', label: 'השתתפות עצמית', type: 'radio', required: true, span: 2,
          options: [
            { value: 'exempt', label: 'פטור מהשתתפות עצמית' },
            { value: 'pays', label: 'לחבר יש השתתפות עצמית' },
          ],
        },
        { key: 'copayAmount', label: 'גובה השתתפות עצמית', type: 'money' },
      ],
    },
  ],
  declarations: ['אני החתום מטה, מאשר שקיבלתי את הפריט במצב תקין.'],
  signatures: [{ key: 'customer', label: 'חתימת המקבל', nameLabel: 'שם המקבל', required: true }],
};

export const maccabiReturn: FormDefinition = {
  key: 'maccabi-return',
  kind: 'return',
  healthFundMatches: ['מכבי'],
  fundLabel: 'מכבי',
  title: 'אישור החזרת מכשיר ניידות/ שיקום',
  subtitle: 'מכשיר שיקום וניידות',
  brandColor: BRAND,
  sections: [
    {
      title: 'פרטי הספק',
      fields: [
        { key: 'supplierName', label: 'שם הספק', type: 'text', prefill: 'supplierName', readOnly: true },
        { key: 'formDate', label: 'תאריך', type: 'date', prefill: 'today', required: true },
        { key: 'district', label: 'שייך למחוז', type: 'text' },
        { key: 'pickupAddress', label: 'כתובת לאיסוף', type: 'text', prefill: 'fullAddress', span: 3 },
      ],
    },
    {
      title: 'פרטי חבר הזכאי למכשיר המוחזר',
      fields: [
        { key: 'lastName', label: 'שם המשפחה', type: 'text', prefill: 'lastName', required: true },
        { key: 'firstName', label: 'השם הפרטי', type: 'text', prefill: 'firstName', required: true },
        { key: 'idNumber', label: 'מספר תעודת הזהות', type: 'id', prefill: 'idNumber', required: true },
        { key: 'address', label: 'כתובת', type: 'text', prefill: 'address' },
        { key: 'houseNumber', label: 'מספר בית', type: 'text', prefill: 'houseNumber' },
        { key: 'city', label: 'עיר', type: 'text', prefill: 'city' },
        { key: 'returnerName', label: 'שם מחזיר המכשיר', type: 'text', prefill: 'customerName', required: true },
        { key: 'phone', label: 'מספר טלפון נייד/בית', type: 'tel', prefill: 'phone', required: true },
        { key: 'phoneAlt', label: 'מספר טלפון נייד נוסף', type: 'tel', prefill: 'phoneAlt' },
      ],
    },
    {
      title: 'סיבת החזרה',
      fields: returnReason(['החלפת מכשיר', 'מעבר לאשפוז סיעודי', 'פטירה', 'אחר']),
    },
    {
      title: 'פרטי המכשירים שהוחזרו',
      fields: returnDeviceRows({
        rows: 4,
        nameLabel: 'שם / סוג מכשיר',
        serialLabel: 'מספר סודר/ סריאלי',
        purchaseDate: true,
        conditionLabels: ['שלם', 'חסרים חלקים', 'גריטה'],
        detailLabel: () => 'פירוט המכשיר',
      }),
    },
    {
      title: 'הערה',
      fields: [{ key: 'notes', label: 'הערה', type: 'textarea', span: 3 }],
    },
  ],
  signatures: [
    { key: 'customer', label: 'חתימת מחזיר המכשיר', nameLabel: 'שם מחזיר המכשיר', required: true },
    { key: 'driver', label: 'חתימת המקבל', nameLabel: 'שם המקבל', required: true },
  ],
};
