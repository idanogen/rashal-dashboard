import logo from '@/assets/forms/moh-logo.png';
import { INK, PEN, box, cell, esc, line, page, signatureLine, stamp, val, type LayoutInput } from './common.ts';

/**
 * משרד הבריאות, "אישור ביצוע תיקון / תוספת": העתק של "טופס תיקון כללי.pdf"
 * (עמי, 04/08/2026). אותו סדר, אותן תוויות ואותה טבלה, והערכים בעט.
 * הלוגו (`assets/forms/moh-logo.png`): הלוגו הרשמי של המשרד וסמל המדינה
 * מוויקישיתוף (נחלת הכלל, 17/10/2026), בדיו שחורה כמו בטופס המודפס.
 */
export function mohRepairLayout({ values: v, signatures, names, meta }: LayoutInput): string {
  const faultRows = [1, 2, 3, 4, 5]
    .map(
      (n) => `<tr>
        <td style="border:1px solid ${INK};height:36px;vertical-align:top;padding:3px 5px;font-size:12px;color:${PEN};font-weight:600">${esc(val(v, `fault${n}`))}</td>
        <td style="border:1px solid ${INK};vertical-align:top;padding:3px 5px;font-size:12px;color:${PEN};font-weight:600">${esc(val(v, `work${n}`))}</td>
        <td style="border:1px solid ${INK};vertical-align:top;padding:3px 5px;font-size:12px;color:${PEN};font-weight:600">${esc(val(v, `catalog${n}`))}</td>
        <td style="border:1px solid ${INK};vertical-align:top;padding:3px 5px;font-size:12px;color:${PEN};font-weight:600">${esc(val(v, `cost${n}`))}</td>
      </tr>`,
    )
    .join('');

  const th = (t: string, w: string) =>
    `<th style="border:1px solid ${INK};font-size:12.5px;font-weight:700;padding:5px;width:${w}">${t}</th>`;

  return page(`
    <!-- כותרת: הלוגו מימין, תיבת הספק משמאל -->
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <img src="${logo}" style="height:86px" />
      <div style="width:250px">
        <div style="font-size:13px;font-weight:700;text-align:center;margin-bottom:3px">♦ מכשירי שיקום וניידות ♦</div>
        <div style="border:1px solid ${INK}">
          <div style="padding:3px 6px;height:66px;border-bottom:1px solid ${INK}">
            <div style="font-size:9.5px;font-weight:700">שם הספק</div>
            <div style="font-size:14px;color:${PEN};font-weight:700;margin-top:6px">${esc(val(v, 'supplierName'))}</div>
          </div>
          <div style="padding:3px 6px;height:34px">
            <div style="font-size:9.5px;font-weight:700">התאריך</div>
            <div style="font-size:13px;color:${PEN};font-weight:600">${esc(val(v, 'formDate'))}</div>
          </div>
        </div>
        <div style="font-size:8.5px;margin-top:3px">הניסוח בלשון זכר אך מתאים לשני המגדרים</div>
        <div style="border:1px solid ${INK};height:26px;margin-top:8px;padding:3px 6px;font-size:13px;color:${PEN};font-weight:700">${esc(val(v, 'callNumber'))}</div>
        <div style="font-size:9.5px;margin-top:2px">מספר קריאה של הספק</div>
      </div>
    </div>

    <div style="text-align:center;font-size:24px;font-weight:800;margin:0 0 8px">אישור ביצוע תיקון / תוספת</div>

    <div style="font-size:13px;font-weight:700;margin-bottom:3px">פרטי התושב הזכאי למכשיר</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>${cell('שם המשפחה', val(v, 'lastName'))}${cell('השם הפרטי', val(v, 'firstName'))}${cell('מספר הזהות', val(v, 'idNumber'), { w: '34%' })}</tr>
      <tr>${cell('מספר הטלפון', val(v, 'phone'))}${cell('שם איש הקשר', val(v, 'contactName'))}${cell('מספר הטלפון של איש הקשר', val(v, 'contactPhone'))}</tr>
    </table>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:-1px">
      <tr>${cell('שם הרחוב', val(v, 'address'), { w: '32%' })}${cell('מספר הבית', val(v, 'houseNumber'), { w: '16%' })}${cell('שם היישוב', val(v, 'city'), { w: '33%' })}${cell('המיקוד', val(v, 'zipCode'))}</tr>
    </table>

    <div style="font-size:13px;font-weight:700;margin:14px 0 3px">מהות התיקון / התוספת</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>${cell('תיאור המכשיר', val(v, 'deviceDesc'), { w: '50%' })}${cell('שם הספק', val(v, 'deviceSupplier'))}</tr>
      <tr>${cell('הדגם', val(v, 'deviceModel'))}${cell('מספר סודר (סריאלי) של המכשיר (מדבקת משרד הבריאות)', val(v, 'deviceSerial'))}</tr>
    </table>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:-1px">
      <tr>
        ${cell('תאריך רכישת המכשיר', val(v, 'purchaseDate'), { w: '24%' })}
        ${cell('תאריך פניית הזכאי לתיקון', val(v, 'requestDate'), { w: '24%' })}
        <td style="border:1px solid ${INK};vertical-align:top;padding:2px 5px">
          <div style="font-size:9.5px">בתקופת אחריות</div>
          <div style="margin-top:6px">${box(v.underWarranty === 'yes', 'כן')}${box(v.underWarranty === 'no', 'לא')}</div>
        </td>
        <td style="border:1px solid ${INK};vertical-align:middle;padding:2px 5px">
          ${box(v.deviceState === 'new', 'חדש')}${box(v.deviceState === 'refurbished', 'מחודש')}
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;table-layout:fixed;margin-top:10px">
      <tr>${th('תאור התקלה', '37%')}${th('חלפים + ביצוע בפועל', '31%')}${th('מק"ט בריאות', '18%')}${th('עלות', '14%')}</tr>
      ${faultRows}
    </table>

    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:12px">
      <div style="display:flex;gap:18px;align-items:flex-end">
        ${line('מספר קילומטרים:', val(v, 'kilometers'), 90)}
        ${line('עלות הנסיעה:', val(v, 'travelCost'), 80)}
        <span style="font-size:9px;line-height:1.1">ללא<br/>מע"מ</span>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <div>
          <div style="font-size:14px;font-weight:800">סה"כ עלות</div>
          <div style="font-size:7.5px">לפני מע"מ, כולל עלות נסיעה</div>
        </div>
        <div style="border:1px solid ${INK};width:120px;height:34px;display:flex;align-items:center;justify-content:center;font-size:14px;color:${PEN};font-weight:700">${esc(val(v, 'totalCost'))}</div>
      </div>
    </div>

    <div style="margin-top:12px;display:flex;align-items:center;flex-wrap:wrap;gap:4px">
      <span style="font-size:11.5px">מקום מתן השירות:</span>
      ${box(v.servicePlace === 'customer', 'בית הלקוח')}${box(v.servicePlace === 'supplier', 'אצל ספק')}${box(v.servicePlace === 'other', 'אחר')}
      ${line('', val(v, 'servicePlaceOther'), 200)}
    </div>

    <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:flex-end">
      ${line('שם נותן השירות (הטכנאי)', names.driver ?? '', 180)}
      ${signatureLine('חתימת נותן השירות (הטכנאי)', signatures.driver)}
    </div>
    <div style="margin-top:10px;display:flex;justify-content:space-between;align-items:flex-end">
      ${line('תאריך התיקון', val(v, 'repairDate'), 90)}
      ${line('שם מקבל השירות', names.customer ?? '', 140)}
      ${signatureLine('חתימת מקבל השירות', signatures.customer, 150)}
    </div>
    <div style="margin-top:10px">${line('הערה:', val(v, 'notes'), 620)}</div>

    <div style="margin-top:14px;font-size:12.5px;font-weight:800">הערה:</div>
    <div style="display:flex;align-items:flex-end;gap:6px;font-size:12.5px;font-weight:800">
      <span>על הספק להעביר העתק מטופס זה בצירוף חשבונית למחלקה לסמ"ש בלשכת הבריאות</span>
      <span style="font-weight:400;font-size:11px">בחר/י</span>
      <span style="flex:1;border-bottom:1px dotted ${INK};font-size:13px;color:${PEN};font-weight:600;text-align:center">${esc(val(v, 'lishka')) || '&nbsp;'}</span>
    </div>
    <div style="font-size:9px;text-align:left;margin-left:60px">שם הלשכה</div>

    <div style="border-top:1px dashed #9a9a9a;margin-top:18px;padding-top:10px;display:flex;justify-content:space-between;font-size:12px">
      <span>מענה טלפוני "קול הבריאות" <b dir="ltr">Tel *5400</b></span>
      <span>פקס מוקד קול הבריאות: <b dir="ltr">Fax 02 - 5655969</b></span>
    </div>
    ${stamp(meta)}
  `);
}
