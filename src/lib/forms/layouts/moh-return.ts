import logo from '@/assets/forms/moh-logo-plain.png';
import { INK, PEN, box, cell, esc, line, page, signatureLine, stamp, val, type LayoutInput } from './common.ts';

/**
 * משרד הבריאות, "אישור החזרת מכשירי ניידות/שיקום": העתק של "טופס החזרה
 * כללית ומאוחדת.pdf" (עמי, 04/08/2026). בטופס הזה הלוגו בלי סמל המדינה,
 * ולכן `moh-logo-plain.png`.
 */
export function mohReturnLayout({ values: v, signatures, names, meta }: LayoutInput): string {
  const reason = String(v.returnReason ?? '');
  const detail = val(v, 'returnReasonDetail');
  const reasonOpt = (label: string, withDetail: boolean, width = 150) =>
    `<span style="display:inline-flex;align-items:flex-end;gap:2px">${box(reason === label, label + (withDetail ? ', פרט:' : ''))}${
      withDetail ? `<span style="display:inline-block;min-width:${width}px;border-bottom:1px solid ${INK};font-size:12.5px;color:${PEN};font-weight:600;padding:0 3px">${reason === label ? esc(detail) : '&nbsp;'}</span>` : ''
    }</span>`;

  const td = `border:1px solid ${INK};padding:3px 6px;`;
  const deviceRows = [1, 2, 3]
    .map((n) => {
      const c = String(v[`dev${n}Condition`] ?? '');
      return `<tr>
        <td style="${td}height:26px;font-size:12.5px;color:${PEN};font-weight:600"><span style="color:${INK};font-weight:400">${n}.</span> ${esc(val(v, `dev${n}Name`))}</td>
        <td style="${td}font-size:12.5px;color:${PEN};font-weight:600">${esc(val(v, `dev${n}Serial`))}</td>
        <td style="${td}white-space:nowrap">${box(c === 'ok', 'שלם')}${box(c === 'missing', 'חסרים חלקים <span style="font-size:9px">(פרט)</span>')}${box(c === 'broken', 'פגום <span style="font-size:9px">(פרט)</span>')}</td>
      </tr>
      <tr><td colspan="3" style="${td}height:22px;font-size:11.5px"><span style="text-decoration:underline">פירוט מצב המכשיר:</span> <span style="font-size:12.5px;color:${PEN};font-weight:600">${esc(val(v, `dev${n}Detail`))}</span></td></tr>`;
    })
    .join('');

  const fate = String(v.noteFate ?? '');

  return page(`
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <img src="${logo}" style="height:62px;margin-top:6px" />
      <div style="width:270px;margin-top:40px">
        <div style="font-size:13px;font-weight:700;text-align:center;margin-bottom:2px">♦ מכשירי שיקום וניידות ♦</div>
        <div style="border:1px solid ${INK}">
          <div style="padding:2px 6px;height:34px;border-bottom:1px solid ${INK}">
            <div style="font-size:9.5px">שם הספק</div>
            <div style="font-size:13px;color:${PEN};font-weight:700">${esc(val(v, 'supplierName'))}</div>
          </div>
          <div style="padding:2px 6px;height:30px">
            <div style="font-size:9.5px">תאריך</div>
            <div style="font-size:13px;color:${PEN};font-weight:600">${esc(val(v, 'formDate'))}</div>
          </div>
        </div>
        <div style="font-size:8.5px;margin-top:2px">הניסוח בלשון זכר אך מתאים לשני המגדרים</div>
      </div>
    </div>

    <div style="text-align:center;font-size:23px;font-weight:800;margin:16px 0 22px">אישור החזרת מכשירי ניידות/שיקום</div>

    <div style="font-size:13.5px;font-weight:700;margin-bottom:3px">פרטי התושב הזכאי למכשיר המוחזר</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>${cell('שם המשפחה', val(v, 'lastName'), { h: 34 })}${cell('השם הפרטי', val(v, 'firstName'), { h: 34 })}${cell('מספר הזהות', val(v, 'idNumber'), { h: 34, w: '37%' })}</tr>
      <tr>${cell('מספר הטלפון', val(v, 'phone'), { h: 34 })}${cell('מספר הטלפון הנייד', val(v, 'mobile'), { h: 34 })}${cell('מספר טלפון נוסף', val(v, 'phoneAlt'), { h: 34 })}</tr>
      <tr>${cell('שם מחזיר המכשיר', val(v, 'returnerName'), { h: 34 })}${cell('מספר הטלפון', val(v, 'returnerPhone'), { h: 34 })}${cell('מספר הטלפון הנייד', val(v, 'returnerMobile'), { h: 34 })}</tr>
    </table>

    <div style="font-size:13.5px;font-weight:700;margin:20px 0 6px">סיבת ההחזרה</div>
    <div style="display:flex;flex-wrap:wrap;gap:10px 18px;align-items:flex-end">
      ${reasonOpt('החלפת מכשיר', true)}${reasonOpt('מעבר לאשפוז סיעודי', true)}${reasonOpt('פטירה', false)}
    </div>
    <div style="margin-top:12px">${reasonOpt('אחר', true, 420)}</div>

    <div style="font-size:13.5px;font-weight:700;margin:20px 0 3px">פרטי המכשירים שהוחזרו</div>
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>
        <td style="${td}width:33%;font-size:12.5px">שם/ סוג המכשיר</td>
        <td style="${td}width:24%;font-size:12.5px">מספר סודר (סריאלי)</td>
        <td style="${td}font-size:12.5px">מצב המכשיר</td>
      </tr>
      ${deviceRows}
    </table>

    <div style="margin-top:16px">${line('הערה:', val(v, 'notes'), 640)}</div>

    <div style="margin-top:16px;font-size:12px">שטר/י החוב בעבור המכשירים:</div>
    <div style="margin-top:4px">${box(fate === 'kept', 'נשאר/ו בלשכת הבריאות. לא יעשה בהם כל שימוש אם המכשירים הוחזרו בשלמותם.')}</div>
    <div style="margin-top:14px;display:flex;align-items:flex-end;gap:30px">
      ${box(fate === 'handed', 'נמסרו לידי עושה השטר.')}
      <span style="display:inline-flex;align-items:flex-end">${box(fate === 'other', 'אחר:')}
        <span style="display:inline-block;min-width:380px;border-bottom:1px solid ${INK};font-size:12.5px;color:${PEN};font-weight:600;padding:0 3px">${fate === 'other' ? esc(val(v, 'noteFateOther')) : '&nbsp;'}</span>
      </span>
    </div>

    <div style="margin-top:30px;display:flex;justify-content:space-between;align-items:flex-end">
      ${signatureLine('חתימת מחזיר המכשיר (הרשום לעיל):', signatures.customer, 140)}
      ${line('שם המקבל', names.driver ?? '', 110)}
      ${signatureLine('חתימת המקבל', signatures.driver, 130)}
    </div>

    <div style="text-align:center;font-size:12.5px;font-weight:800;margin-top:24px;line-height:1.5">
      אם החזרת המכשיר/ים והחתימה על אישור ההחזרה לא נעשו בלשכת הבריאות,<br/>
      יש להעביר את הטופס הזה אל חברת נטלי/ המחסן הארצי ברחוב יהודה ונח מוזס 15 תל אביב
    </div>
    ${stamp(meta)}
  `);
}
