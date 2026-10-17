import logo from '@/assets/forms/leumit-logo.png';
import { INK, PEN, box, esc, line, page, stamp, val, type LayoutInput } from './common.ts';

/**
 * לאומית: העתק של "אספקה לאומית.pdf" (עמוד 1) ו"לאומית החזרה.pdf" (עמי,
 * 04/08/2026). בסריקת האספקה הלוגו הישן; בשני הטפסים הלוגו הנוכחי מוויקיפדיה
 * (עידן אישר, 17/10/2026). 🔴 עמוד 2 של האספקה (שטר חוב) נשאר על נייר
 * ומצולם, ולכן לא משורטט כאן; הצילום מצורף כעמוד נוסף.
 */

const FRAME = `border:2px solid ${INK};margin-top:12px`;
const td = `border:1px solid ${INK};padding:3px 6px;`;
const pen = (s: string) => `<span style="font-size:12.5px;color:${PEN};font-weight:600">${esc(s) || '&nbsp;'}</span>`;
/**
 * ערך בתא צר: הגופן קטן לפי האורך במקום לחתוך. 🔴 לעולם לא "…": מספר סידורי
 * שנחתך הוא מספר סידורי שגוי, וזה בדיוק השדה שהקופה בודקת.
 */
const one = (s: string) => {
  const size = s.length <= 12 ? 12 : s.length <= 18 ? 10.5 : 9;
  return `<div style="font-size:${size}px;line-height:1.25;word-break:break-all;color:${PEN};font-weight:600">${esc(s) || '&nbsp;'}</div>`;
};

/** פס הכותרת האפור של כל סעיף בטופסי לאומית ("1. פרטי הלקוח"). */
function bar(n: number, title: string): string {
  return `<div style="background:#cfcfcf;border-bottom:1px solid ${INK};padding:2px 8px;font-size:13px;font-weight:800">${n}. <span style="text-decoration:underline">${title}</span></div>`;
}

function logoBlock(): string {
  return `<div style="display:flex;justify-content:center"><img src="${logo}" style="height:44px;display:block" /></div>`;
}

function footer(page1of: string): string {
  return `<div style="margin-top:14px;border-top:1px solid ${INK};padding-top:6px;text-align:center">
    <div style="font-size:12.5px" dir="rtl"><span dir="ltr">1-700-507-507</span> &nbsp; או חייג מהנייד <span dir="ltr">*507</span> &nbsp; <span dir="ltr">www.leumit.co.il</span></div>
    <div style="font-size:8.5px;margin-top:1px">מס' טופס כללי: <span dir="ltr">02-06 (05/24)</span> עמוד ${page1of}</div>
  </div>`;
}

export function leumitDeliveryLayout({ values: v, signatures, names, meta }: LayoutInput): string {
  const head = (t: string) => `<td style="${td}font-size:12.5px;font-weight:700;vertical-align:top;height:36px">${t}</td>`;
  const items = [1, 2, 3, 4, 5]
    .map((n) => {
      const st = String(v[`item${n}State`] ?? '');
      return `<tr>
        <td style="${td}height:22px">${pen(st === 'new' ? 'חדש' : st === 'refurbished' ? 'מחודש' : '')}</td>
        <td style="${td}">${pen(val(v, `item${n}Treatment`))}</td>
        <td style="${td}">${pen(val(v, `item${n}Commitment`))}</td>
        <td style="${td}">${pen(val(v, `item${n}Catalog`))}</td>
        <td style="${td}">${pen(val(v, `item${n}Model`))}</td>
      </tr>`;
    })
    .join('');
  const decl = [
    'מאשר שקיבלתי את הפריט במצב תקין.',
    'מתחייב להשתמש בפריט ולתחזק אותו בהתאם להוראות הספק וכאמור בעלון שסופק לי.',
    'מתחייב כי בכל תקלה או שבר, אפנה לספק לפי פרטי הקשר המפורטים בטופס זה, ולא אנסה לתקן בעצמי או באמצעות מי מטעמי.',
    'מתחייב כי בסיום השימוש אשיב את הפריט לספק, כשהוא שלם וכולל את כל החלקים שחוברו לו על ידי הספק (באחריות הספק לאסוף את הפריט מבית הלקוח בתיאום מראש).',
    'במקרה שנדרש שטר חוב, אני מאשר כי הספק יוכל לגבות ממני את הסכום הנקוב בשטר, אך ורק אם הפריט לא הושב לספק בסיום השימוש בו.',
  ]
    .map((d, i) => `<div style="display:flex;gap:8px;margin:7px 0;font-size:13px;line-height:1.6"><span>${'אבגדה'[i]}.</span><span>${d}</span></div>`)
    .join('');

  return page(`
    ${logoBlock()}
    <div style="text-align:center;font-size:21px;font-weight:800;margin:18px 0 6px">אישור קבלת פריט שיקום וניידות</div>

    <div style="${FRAME}">
      ${bar(1, 'פרטי הלקוח')}
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <tr>${head('שם מלא')}${head('תעודת זהות')}${head('מספר טלפון')}</tr>
        <tr><td style="${td}height:30px">${pen(val(v, 'fullName'))}</td><td style="${td}">${pen(val(v, 'idNumber'))}</td><td style="${td}">${pen(val(v, 'phone'))}</td></tr>
        <tr><td colspan="3" style="${td}font-size:12.5px;font-weight:700">כתובת מגורים (רחוב, מס' בית, שם היישוב, מיקוד)</td></tr>
        <tr><td colspan="3" style="${td}height:30px">${pen(val(v, 'fullAddress'))}</td></tr>
      </table>
    </div>

    <div style="${FRAME}">
      ${bar(2, 'פרטי מוצר')}
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <tr>${head('פריט חדש/מחודש')}${head('קוד טיפול')}${head('מספר התחייבות')}${head('מספר קטלוגי')}${head('דגם פריט שסופק')}</tr>
        ${items}
      </table>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <tr><td style="${td}width:44%;font-size:12.5px;font-weight:700">שם הספק</td><td style="${td}font-size:12.5px;font-weight:700">מספר טלפון וכתובת דוא"ל ליצירת קשר עם הספק</td></tr>
        <tr><td style="${td}height:32px">${pen(val(v, 'supplierName'))}</td><td style="${td}">${pen(val(v, 'supplierContact'))}</td></tr>
      </table>
    </div>

    <div style="${FRAME}">
      ${bar(3, 'הצהרת הלקוח')}
      <div style="padding:4px 12px 2px">
        <div style="font-size:13px">אני החתום מטה:</div>
        ${decl}
      </div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <tr><td style="${td}font-size:13px;font-weight:700">שם הלקוח</td><td style="${td}font-size:13px;font-weight:700">חתימת הלקוח</td></tr>
        <tr><td style="${td}height:48px">${pen(names.customer ?? '')}</td>
          <td style="${td}text-align:center">${signatures.customer ? `<img src="${signatures.customer}" style="max-height:44px;max-width:240px" />` : ''}</td></tr>
      </table>
    </div>
    ${stamp(meta)}
    ${footer('1 מתוך 2')}
  `);
}

export function leumitReturnLayout({ values: v, signatures, names, meta }: LayoutInput): string {
  const reason = String(v.returnReason ?? '');
  const detail = val(v, 'returnReasonDetail');
  const reasonRow = (label: string, withDetail: boolean, h = 28) =>
    withDetail
      ? `<tr><td style="${td}width:38%;height:${h}px;vertical-align:top">${box(reason === label, `<b>${label}</b>`)}</td>
           <td style="${td}vertical-align:top;font-size:12px">פרט: ${reason === label ? pen(detail) : ''}</td></tr>`
      : `<tr><td colspan="2" style="${td}height:28px">${box(reason === label, `<b>${label}</b>`)}</td></tr>`;
  const devRows = [1, 2, 3, 4]
    .map((n) => {
      const c = String(v[`dev${n}Condition`] ?? '');
      const m = (on: boolean) => `<td style="${td}text-align:center">${box(on, '')}</td>`;
      return `<tr>
        <td style="${td}height:24px">${one(val(v, `dev${n}Name`))}</td>
        <td style="${td}">${one(val(v, `dev${n}Serial`))}</td>
        <td style="${td}">${one(val(v, `dev${n}Request`))}</td>
        <td style="${td}">${one(val(v, `dev${n}Purchase`))}</td>
        ${m(c === 'ok')}${m(c === 'missing')}${m(c === 'broken')}
      </tr>
      <tr><td colspan="7" style="${td}height:22px;font-size:12px">פירוט מצב מכשיר ${n}: ${pen(val(v, `dev${n}Detail`))}</td></tr>`;
    })
    .join('');
  const fate = String(v.noteFate ?? '');
  const head = (t: string, extra = '') => `<td style="${td}font-size:12px;vertical-align:top;${extra}">${t}</td>`;

  return page(`
    ${logoBlock()}
    <div style="text-align:center;font-size:19px;font-weight:800;margin:8px 0 8px">טופס אישור החזרת מכשירי ניידות/שיקום</div>
    <div style="display:flex;justify-content:space-around;align-items:flex-start">
      ${line('כתובת לאיסוף:', val(v, 'pickupAddress'), 230)}
      <div style="display:flex;flex-direction:column;gap:12px">
        ${line('שם הספק:', val(v, 'supplierName'), 140)}
        ${line('תאריך:', val(v, 'formDate'), 140)}
      </div>
    </div>

    <div style="${FRAME}">
      ${bar(1, 'פרטי הלקוח הזכאי למכשיר המוחזר')}
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <tr>${head('שם הלקוח')}${head('מספר תעודת זהות')}${head('טלפון')}${head('טלפון נוסף')}</tr>
        <tr><td style="${td}height:28px">${pen(val(v, 'customerName'))}</td><td style="${td}">${pen(val(v, 'idNumber'))}</td><td style="${td}">${pen(val(v, 'phone'))}</td><td style="${td}">${pen(val(v, 'phoneAlt'))}</td></tr>
        <tr><td colspan="2" style="${td}font-size:12px">שם מחזיר המכשיר</td><td colspan="2" style="${td}font-size:12px">מספר טלפון</td></tr>
        <tr><td colspan="2" style="${td}height:26px">${pen(val(v, 'returnerName'))}</td><td colspan="2" style="${td}">${pen(val(v, 'returnerPhone'))}</td></tr>
      </table>
    </div>

    <div style="${FRAME}">
      ${bar(2, 'סיבת החזרה')}
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        ${reasonRow('החלפת מכשיר', true)}${reasonRow('מעבר לאשפוז סיעודי', true)}${reasonRow('המכשיר אינו מתאים לצרכי הפונה', true, 40)}${reasonRow('פטירה', false)}
      </table>
    </div>

    <div style="${FRAME}">
      ${bar(3, 'פרטי המכשירים שהוחזרו')}
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <tr>
          ${head('שם / סוג המכשיר', 'width:17%')}${head('מספר סודר/<br/>סריאלי', 'width:15%')}${head('מספר בקשה', 'width:15%')}${head('תאריך רכישה', 'width:14%')}
          <td colspan="3" style="${td}padding:0;vertical-align:top">
            <div style="font-size:12px;text-align:center;border-bottom:1px solid ${INK};padding:2px">מצב המכשיר</div>
            <div style="display:flex;font-size:11.5px;text-align:center">
              <div style="flex:1;border-inline-end:1px solid ${INK};padding:2px">שלם</div>
              <div style="flex:1.5;border-inline-end:1px solid ${INK};padding:2px">חסרים חלקים<br/>(פרט)</div>
              <div style="flex:1;padding:2px">פגום<br/>(פרט)</div>
            </div>
          </td>
        </tr>
        ${devRows}
        <tr><td colspan="7" style="${td}height:30px;font-size:12.5px;vertical-align:bottom">הערה: ${pen(val(v, 'notes'))}</td></tr>
      </table>
    </div>

    <div style="${FRAME}">
      ${bar(4, 'פרטי שטר/אישור התחייבות')}
      <div style="padding:6px 10px">
        <div>${box(fate === 'kept', 'נשאר/ו בלאומית. לא יעשה בהם כל שימוש אם המכשירים הוחזרו בשלמותם')}</div>
        <div style="margin-top:10px;display:flex;align-items:flex-end">
          ${box(fate === 'handed', 'נמסרו לידי עושה השטר.')}${box(fate === 'other', 'אחר')}
          <span style="flex:1;border-bottom:1px solid ${INK};margin-inline-start:6px">${fate === 'other' ? pen(val(v, 'noteFateOther')) : '&nbsp;'}</span>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;table-layout:fixed">
        <tr><td style="${td}font-size:12.5px">חתימת מחזיר המכשיר (הרשום לעיל)</td><td style="${td}font-size:12.5px">שם המקבל</td><td style="${td}font-size:12.5px">חתימת המקבל</td></tr>
        <tr>
          <td style="${td}height:46px;text-align:center">${signatures.customer ? `<img src="${signatures.customer}" style="max-height:44px;max-width:200px" />` : ''}</td>
          <td style="${td}">${pen(names.driver ?? '')}</td>
          <td style="${td}text-align:center">${signatures.driver ? `<img src="${signatures.driver}" style="max-height:44px;max-width:200px" />` : ''}</td>
        </tr>
      </table>
    </div>
    ${stamp(meta)}
    ${footer('1 מתוך 1')}
  `);
}
