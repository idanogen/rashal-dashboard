import logo from '@/assets/forms/maccabi-logo.png';
import { INK, PEN, box, cell, esc, line, page, signatureLine, stamp, val, type LayoutInput } from './common.ts';

/**
 * מכבי: העתק של "אספקה מכבי.pdf" ו"מכבי החזרה.pdf" (עמי, 04/08/2026).
 * הלוגו מוויקיפדיה (עידן אישר, 17/10/2026), והסיסמה "בריאות זה הכול"
 * כטקסט, כי כך היא מודפסת בטופס (בלוגו שבוויקיפדיה כתוב "שירותי בריאות").
 */

const u = (t: string) => `<span style="text-decoration:underline;text-underline-offset:3px">${t}</span>`;

function header(v: LayoutInput['values'], title: string): string {
  return `
    <div style="display:flex;justify-content:flex-start">
      <div style="text-align:start">
        <img src="${logo}" style="height:58px;display:block" />
        <div style="font-size:19px;font-weight:700;margin-top:4px">בריאות זה הכול</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:4px">
      <div style="padding-top:34px;display:flex;flex-direction:column;gap:8px">
        ${line('שייך למחוז', val(v, 'district'), 150)}
        ${line('כתובת לאיסוף', val(v, 'pickupAddress'), 220)}
      </div>
      <div style="width:290px">
        <div style="font-size:12.5px;font-weight:700;text-align:center;margin-bottom:4px">*מכשיר שיקום וניידות</div>
        <div style="border:1.5px solid ${INK};padding:14px 14px;display:flex;flex-direction:column;gap:14px">
          ${line('שם הספק', val(v, 'supplierName'), 130)}
          ${line('תאריך', val(v, 'formDate'), 100)}
        </div>
      </div>
    </div>
    <div style="text-align:center;font-size:19px;font-weight:800;margin:22px 0 16px">${u(title)}</div>`;
}

function memberTable(v: LayoutInput['values'], nameOfReturner: string): string {
  return `<table style="width:100%;border-collapse:collapse;table-layout:fixed">
    <tr>${cell('שם המשפחה', val(v, 'lastName'), { h: 44 })}${cell('השם הפרטי', val(v, 'firstName'), { h: 44 })}${cell('מספר תעודת הזהות', val(v, 'idNumber'), { h: 44 })}</tr>
    <tr>${cell('כתובת', val(v, 'address'), { h: 44 })}${cell('מספר בית', val(v, 'houseNumber'), { h: 44 })}${cell('עיר', val(v, 'city'), { h: 44 })}</tr>
    <tr>${cell('שם מחזיר המכשיר', val(v, nameOfReturner), { h: 44 })}${cell('מספר טלפון נייד /בית', val(v, 'phone'), { h: 44 })}${cell('מספר טלפון נייד נוסף', val(v, 'phoneAlt'), { h: 44 })}</tr>
  </table>`;
}

export function maccabiDeliveryLayout({ values: v, signatures, names, meta }: LayoutInput): string {
  const copay = String(v.copay ?? '');
  const amount = val(v, 'copayAmount');
  return page(`
    ${header(v, 'אישור קבלת מכשיר שיקום וניידות')}

    <div style="font-size:14px;font-weight:700;margin-bottom:8px">${u('פרטי חבר הזכאי למכשיר')}</div>
    ${memberTable(v, 'holderName')}

    <div style="font-size:14px;font-weight:700;margin:22px 0 8px">${u('פרטי הפריט שסופק לחבר')}</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>
        <td style="border:1px solid ${INK};width:50%;height:120px;vertical-align:top;padding:12px 8px">
          <div style="display:flex;flex-direction:column;gap:10px">
            ${box(v.deviceSource === 'new', '<b>מכשיר חדש</b>')}
            ${box(v.deviceSource === 'stock', '<b>מכשיר מהמלאי</b>')}
          </div>
        </td>
        <td style="border:1px solid ${INK};vertical-align:top;padding:12px 8px">
          ${line('תיאור המכשיר :', val(v, 'deviceDesc'), 210)}
        </td>
      </tr>
      <tr>${cell('מספר סודר (סריאלי) של המכשיר', val(v, 'deviceSerial'), { h: 52 })}${cell('הדגם שסופק', val(v, 'deviceModel'), { h: 52 })}</tr>
      <tr><td colspan="2" style="border:1px solid ${INK};padding:4px 8px;font-size:13px;font-weight:700">השתתפות עצמית:</td></tr>
      <tr><td colspan="2" style="border:1px solid ${INK};padding:12px 8px;height:190px;vertical-align:top">
        <div style="display:flex;flex-direction:column;gap:14px;font-weight:700">
          ${box(copay === 'exempt', '<b>פטור מהשתתפות עצמית</b>')}
          ${box(copay === 'pays', '<b>לחבר יש השתתפות עצמית</b>')}
          <span style="display:inline-flex;align-items:flex-end">${box(!!amount, '<b>גובה השתתפות עצמית :</b>')}
            <span style="display:inline-block;min-width:90px;border-bottom:1px solid ${INK};font-size:13px;color:${PEN};font-weight:600;text-align:center;margin-inline-start:6px">${esc(amount) || '&nbsp;'}</span><span style="font-size:12px">₪</span>
          </span>
        </div>
      </td></tr>
    </table>

    <div style="font-size:14.5px;font-weight:700;margin:32px 0 0">*אני החתום מטה, מאשר שקיבלתי את הפריט במצב תקין.</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:30px;font-weight:700">
      ${line('<b style="font-size:14px">שם המקבל</b> <b style="font-size:20px">X</b>', names.customer ?? '', 200)}
      ${signatureLine('<b style="font-size:14px">חתימת המקבל</b> <b style="font-size:20px">X</b>', signatures.customer, 220)}
    </div>
    ${stamp(meta)}
  `);
}

export function maccabiReturnLayout({ values: v, signatures, names, meta }: LayoutInput): string {
  const reason = String(v.returnReason ?? '');
  const detail = val(v, 'returnReasonDetail');
  const opt = (label: string, withDetail: boolean, w = 110) =>
    `<span style="display:inline-flex;align-items:flex-end">${box(reason === label, `<b>${label}</b>${withDetail ? ' , פרט :' : ''}`)}${
      withDetail ? `<span style="display:inline-block;min-width:${w}px;border-bottom:1px solid ${INK};font-size:12.5px;color:${PEN};font-weight:600;padding:0 3px">${reason === label ? esc(detail) : '&nbsp;'}</span>` : ''
    }</span>`;
  const td = `border:1px solid ${INK};padding:3px 6px;`;
  const rows = [1, 2, 3, 4]
    .map((n) => {
      const c = String(v[`dev${n}Condition`] ?? '');
      const mark = (on: boolean) => `<td style="${td}text-align:center">${box(on, '')}</td>`;
      return `<tr>
        <td style="${td}height:34px;font-size:12.5px;color:${PEN};font-weight:600;vertical-align:bottom"><span style="color:${INK};font-weight:700">.${n}</span> ${esc(val(v, `dev${n}Name`))}</td>
        <td style="${td}font-size:12.5px;color:${PEN};font-weight:600">${esc(val(v, `dev${n}Serial`))}</td>
        <td style="${td}font-size:12.5px;color:${PEN};font-weight:600">${esc(val(v, `dev${n}Purchase`))}</td>
        ${mark(c === 'ok')}${mark(c === 'missing')}${mark(c === 'broken')}
      </tr>
      ${n < 4 ? `<tr><td colspan="6" style="${td}height:30px;vertical-align:top;font-size:11.5px;font-weight:700">פירוט המכשיר: <span style="font-size:12.5px;color:${PEN};font-weight:600">${esc(val(v, `dev${n}Detail`))}</span></td></tr>` : ''}`;
    })
    .join('');

  return page(`
    ${header(v, 'אישור החזרת מכשיר ניידות/ שיקום')}

    <div style="font-size:14px;font-weight:700;margin-bottom:8px">${u('פרטי חבר הזכאי למכשיר המוחזר')}</div>
    ${memberTable(v, 'returnerName')}

    <div style="font-size:14px;font-weight:700;margin:16px 0 6px">${u('סיבת החזרה :')}</div>
    <div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap">${opt('החלפת מכשיר', true)}${opt('מעבר לאשפוז סיעודי', true, 70)}${opt('פטירה', false)}</div>
    <div style="margin-top:10px">${opt('אחר', true, 480)}</div>

    <div style="font-size:14px;font-weight:700;margin:18px 0 8px">${u('פרטי המכשירים שהוחזרו')}</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>
        <td rowspan="2" style="${td}width:26%;vertical-align:top;font-size:11.5px">שם / סוג מכשיר</td>
        <td rowspan="2" style="${td}width:20%;vertical-align:top;font-size:11.5px">מספר סודר/ סריאלי</td>
        <td rowspan="2" style="${td}width:17%;vertical-align:top;font-size:11.5px">תאריך רכישה</td>
        <td colspan="3" style="${td}font-size:11.5px;height:22px">מצב מכשיר</td>
      </tr>
      <tr>
        <td style="${td}font-size:11.5px;vertical-align:top">שלם</td>
        <td style="${td}font-size:11.5px;vertical-align:top">חסרים חלקים<br/>(פרט)</td>
        <td style="${td}font-size:11.5px;vertical-align:top">גריטה</td>
      </tr>
      ${rows}
    </table>

    <div style="margin-top:12px">${line('הערה:', val(v, 'notes'), 640)}</div>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:22px">
      ${signatureLine('חתימת מחזיר המכשיר', signatures.customer, 150)}
      ${line('שם המקבל', names.driver ?? '', 140)}
      ${signatureLine('חתימת המקבל', signatures.driver, 150)}
    </div>
    ${stamp(meta)}
  `);
}
