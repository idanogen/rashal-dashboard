import logo from '@/assets/forms/clalit-logo.png';
import { line, page, signatureLine, stamp, val, type LayoutInput } from './common.ts';
import { c, eligibleTable, h3, personWithRelation, tbl } from './meuhedet.ts';

/**
 * כללית (04/11/2026): עמוד 1 של טופס מאוחדת, אותן טבלאות בדיוק (מיובאות משם,
 * מקור אחד), עם שלושה הבדלים שעידן ביקש: לוגו כללית בפינה השמאלית במקום
 * מאוחדת והסיסמה שלה, בלי הפס השחור בתחתית, ובלי מספר העמוד. הלוגו בשחור-לבן
 * מהוויקיפדיה העברית (Clalit_Logo_Clean_2020.svg), כמו שעידן ביקש.
 * עמוד יחיד, ולכן `page` ולא `fixedPage`.
 */
export function clalitDeliveryLayout({ values: v, signatures, names, meta }: LayoutInput): string {
  return page(`
    <div style="display:flex;justify-content:flex-end">
      <img src="${logo}" style="height:40px;display:block" />
    </div>
    <div style="text-align:center;font-size:17px;font-weight:800;text-decoration:underline;margin:6px 0 14px">
      אישור קבלת ציוד שיקום / ניידות
    </div>
    <div style="display:flex;justify-content:flex-end;padding-inline-end:40px">
      <table style="border-collapse:collapse;width:210px">
        <tr>${c('תאריך :', val(v, 'formDate'), { h: 50 })}</tr>
        <tr>${c('מספר שובר זכאות', val(v, 'voucherNumber'), { h: 50 })}</tr>
      </table>
    </div>

    ${h3('פרטי הזכאי לציוד', 24)}
    ${eligibleTable(v)}
    ${h3('פרטי מקבל הציוד (אם אינו הזכאי הנ"ל)')}
    ${personWithRelation(v, 'recv')}
    ${h3('פרטי הציוד שהתקבל ופרטי המוסר')}
    ${tbl(`
      <tr>${c('תיאור הציוד', val(v, 'equipmentDesc'), { colspan: 2, h: 40 })}${c('הדגם', val(v, 'equipmentModel'), { h: 40 })}</tr>
      <tr>${c('שם הספק', val(v, 'supplierName'), { colspan: 2, h: 40 })}${c('מספר סידורי', val(v, 'equipmentSerial'), { h: 40 })}</tr>
      <tr>${c('שם המוסר', val(v, 'staffName'), { w: '30%' })}${c('תפקיד', val(v, 'staffRole'), { w: '29%' })}
        ${c('מספר טלפון', val(v, 'staffPhone'))}</tr>`)}

    <div style="font-size:13px;margin-top:30px">אני החתום מטה, מאשר שקיבלתי את הציוד במצב תקין.</div>
    <div style="display:flex;gap:40px;align-items:flex-end;margin-top:22px">
      ${line('שם המקבל', names.customer ?? '', 150)}
      ${signatureLine('חתימת המקבל', signatures.customer, 170)}
    </div>
    <div style="display:flex;justify-content:flex-start;margin-top:40px">
      ${signatureLine('חתימת המציע', signatures.driver, 190)}
    </div>
    ${stamp(meta)}
  `);
}
