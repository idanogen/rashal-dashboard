import logo from '@/assets/forms/meuhedet-logo.png';
import { INK, PEN, box, esc, fixedPage, line, signatureLine, stamp, val, type LayoutInput } from './common.ts';

/**
 * מאוחדת, "נוסח מעודכן": העתק של עמודים 1-3 של "אספקה מאוחדת.pdf" (עמי,
 * 04/08/2026). 🔴 עמוד 4 (שטר חוב לא סחיר + ערבות אוואל) לא משורטט: הוא
 * נחתם על נייר ומצולם, והצילום מצורף אחרי שלושת העמודים.
 * ⭐ שלושה עמודים בגובה A4 בדיוק (`fixedPage`), כי המרסטר חותך כל A4.
 * הלוגו מוויקיפדיה (עידן אישר, 17/10/2026), ו"רמה אחרת" כטקסט כמו בטופס.
 */

const td = `border:1px solid ${INK};padding:2px 5px;vertical-align:top;`;

/** תא בטבלאות של מאוחדת: תווית רגילה בפינה, הערך בעט. */
function c(label: string, value: string, opts: { w?: string; h?: number; colspan?: number } = {}): string {
  return `<td ${opts.colspan ? `colspan="${opts.colspan}"` : ''} style="${td}height:${opts.h ?? 34}px;${opts.w ? `width:${opts.w};` : ''}">
    <div style="font-size:12px">${label}</div>
    <div style="font-size:12.5px;color:${PEN};font-weight:600;line-height:1.3">${esc(value) || '&nbsp;'}</div>
  </td>`;
}

function top(): string {
  // ⭐ כמו במקור: "נוסח מעודכן" מימין, הלוגו משמאל.
  return `<div style="display:flex;justify-content:space-between;align-items:flex-start">
    <div style="font-size:12.5px;font-weight:700;margin-top:6px">נוסח מעודכן</div>
    <div style="text-align:end">
      <img src="${logo}" style="height:40px;display:block" />
      <div style="font-size:17px;font-weight:700;margin-top:1px;text-align:center">רמה אחרת</div>
    </div>
  </div>`;
}

/** הפס השחור של מאוחדת, חתימת המציע ומספר העמוד, בתחתית כל עמוד. */
function bottom(n: number, driverSig: string | null | undefined, meta: LayoutInput['meta']): string {
  return `<div style="position:absolute;left:0;right:0;bottom:0;height:150px">
    <div style="position:absolute;bottom:92px;left:90px;right:0;height:30px;background:#2e2e2e;border-radius:15px 0 0 15px"></div>
    <div style="position:absolute;bottom:100px;right:0;width:350px;height:40px;background:#000;border-radius:20px 0 0 0"></div>
    <div style="position:absolute;bottom:36px;right:40px;left:40px;display:flex;justify-content:space-between;align-items:flex-end">
      ${signatureLine('חתימת המציע', driverSig, 190)}
      <span style="font-size:13px">${n}</span>
    </div>
    <div style="position:absolute;bottom:14px;left:0;right:0;text-align:center;font-size:11px">מסמך בסיווג חסוי עסקי</div>
    ${n === 1 ? `<div style="position:absolute;bottom:2px;right:40px">${stamp(meta)}</div>` : ''}
  </div>`;
}

const h3 = (t: string, mt = 14) => `<div style="font-size:13px;font-weight:700;margin:${mt}px 0 3px">${t}</div>`;
const tbl = (rows: string) => `<table style="width:100%;border-collapse:collapse;table-layout:fixed">${rows}</table>`;

function eligibleTable(v: LayoutInput['values']): string {
  return tbl(`
    <tr>${c('שם משפחה', val(v, 'eligLastName'))}${c('שם פרטי', val(v, 'eligFirstName'))}${c('מספר זהות', val(v, 'eligIdNumber'), { colspan: 2 })}</tr>
    <tr>${c('מספר טלפון', val(v, 'eligPhone'))}${c('מספר טלפון נייד', val(v, 'eligMobile'))}${c('מספר טלפון נוסף', val(v, 'eligPhoneAlt'), { colspan: 2 })}</tr>
    <tr>${c('שם הרחוב', val(v, 'eligStreet'), { w: '30%' })}${c('מספר הבית', val(v, 'eligHouseNumber'), { w: '14%' })}${c('שם הישוב', val(v, 'eligCity'))}${c('מיקוד', val(v, 'eligZip'), { w: '22%' })}</tr>`);
}

function personWithRelation(v: LayoutInput['values'], p: string): string {
  return tbl(`
    <tr>${c('שם משפחה', val(v, `${p}LastName`))}${c('שם פרטי', val(v, `${p}FirstName`))}${c('מספר זהות', val(v, `${p}IdNumber`))}${c('יחס קרבה לזכאי', val(v, `${p}Relation`))}</tr>
    <tr>${c('מספר טלפון נייד', val(v, `${p}Mobile`), { colspan: 2 })}${c('מספר טלפון נוסף', val(v, `${p}PhoneAlt`), { colspan: 2 })}</tr>
    <tr>${c('שם הרחוב', val(v, `${p}Street`), { w: '30%' })}${c('מספר הבית', val(v, `${p}HouseNumber`), { w: '14%' })}${c('שם הישוב', val(v, `${p}City`))}${c('מיקוד', val(v, `${p}Zip`), { w: '22%' })}</tr>`);
}

const item = (t: string) => `<div style="display:flex;gap:6px;font-size:12.5px;line-height:1.5;margin:2px 0">${t}</div>`;

export function meuhedetDeliveryLayout({ values: v, signatures, names, meta }: LayoutInput): string {
  const eqRows = [1, 2, 3, 4, 5]
    .map(
      (n) => `<tr>${[`eq${n}Catalog`, `eq${n}Desc`, `eq${n}Serial`, `eq${n}SupplyDate`, `eq${n}Cost`]
        .map((k) => `<td style="${td}height:20px;font-size:11.5px;color:${PEN};font-weight:600;word-break:break-all">${esc(val(v, k))}</td>`)
        .join('')}</tr>`,
    )
    .join('');
  const recv = String(v.receivedBy ?? '');

  const page1 = fixedPage(`
    ${top()}
    <div style="text-align:center;font-size:17px;font-weight:800;text-decoration:underline;margin:6px 0 14px">אישור קבלת ציוד שיקום / ניידות</div>
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
      <tr>${c('שם הציוד', val(v, 'staffName'), { w: '30%' })}${c('תפקיד', val(v, 'staffRole'), { w: '29%' })}${c('מספר טלפון', val(v, 'staffPhone'))}</tr>`)}

    <div style="font-size:13px;margin-top:30px">אני החתום מטה, מאשר שקיבלתי את הציוד במצב תקין.</div>
    <div style="display:flex;gap:40px;align-items:flex-end;margin-top:22px">
      ${line('שם המקבל', names.customer ?? '', 150)}
      ${signatureLine('חתימת המקבל', signatures.customer, 170)}
    </div>
    ${bottom(1, signatures.driver, meta)}
  `);

  const page2 = fixedPage(`
    ${top()}
    <div style="text-align:center;font-size:16px;font-weight:800;text-decoration:underline;margin:4px 0 6px">כתב התחייבות להחזרת ציוד שיקום וניידות</div>
    ${h3('פרטי הזכאי לציוד שיקום וניידות', 4)}
    ${eligibleTable(v)}
    ${h3('פרטי הציוד&nbsp; שנמסר לזכאי', 8)}
    <table style="width:100%;border-collapse:collapse;table-layout:fixed">
      <tr>${['מספר קטלוגי', 'תיאור הציוד', 'מספר סידורי<br/>(סיריאלי)', 'תאריך אספקה', 'עלות הציוד בש"ח']
        .map((t) => `<td style="${td}font-size:12px;height:24px">${t}</td>`).join('')}</tr>
      ${eqRows}
    </table>
    ${h3('פרטי הערב', 8)}
    ${personWithRelation(v, 'guar')}
    <div style="margin-top:10px;padding-inline-start:6px">
      ${item('<span>א.</span><span>הואיל ונמסר היום לזכאי הנ"ל הציוד המפורטים לעיל, אנו, הזכאי ו/או הערב, מצהירים בזאת שידוע לנו כי:</span>')}
      <div style="padding-inline-start:22px">
        ${item('<span>1.</span><span>הציוד הנ"ל הינו רכוש הספק.</span>')}
        ${item('<span>2.</span><span>הספק מוכן להשאיל את ציוד הנ"ל לזכאי.</span>')}
        ${item('<span>3.</span><span>על הזכאי להחזיר את ציוד לספק עם תום השימוש בו לרבות במקרה של קבלת ציוד חלופי.</span>')}
        <div style="display:flex;gap:26px;margin:3px 0">${box(recv === 'eligible', 'הזכאי קיבל את ציוד&nbsp; בעצמו')}${box(recv === 'guarantor', 'הערב קיבל את ציוד בשם הזכאי ועבורו')}</div>
      </div>
      ${item('<span>ב.</span><span>לפיכך אני/ו מתחייבים, ביחד ולחוד כלהלן:</span>')}
      <div style="padding-inline-start:22px">
        ${item('<span>1.</span><span>המבוא להתחייבות זו מהווה חלק בלתי נפרד מן ההתחייבות.</span>')}
        ${item('<span>2.</span><span>להחזיר את ציוד בתום תקופת השימוש לספק ממנו קיבלתי את הציוד.</span>')}
        ${item('<span>3.</span><span>זכאי או מי מטעמו שלא יחזיר / יהיה מוכן להחזיר את ציוד בתום תקופת השימוש, יהיה רשאי להשאיר אצלו את ציוד בתנאי שישלם תמורתו לספק סכום של <u>10,000 ₪</u>.</span>')}
        ${item('<span>4.</span><span>קופת חולים מאוחדת ו/או הספק לא יישאו בעלות תיקון או באחריות כלשהי על ציוד שנשאר בידי הזכאי ועל הזכאי לוודא שכל סימון של קופת חולים מאוחדת יוסר מהציוד.</span>')}
        ${item('<span>5.</span><span>להקפיד להשתמש בציוד על פי הוראות היצרן/ הספק/ הקופה.</span>')}
        ${item('<span>6.</span><span>לשלם לקופת חולים מאוחדת ו/או לספק, בכפוף לאישור קופת חולים מאוחדת, כל סכום שיידרש ממני בעבור תיקון נזקים שנגרמו לציוד שהוחזר לספק עקב שימוש רשלני או הזנחה.</span>')}
        ${item('<span>7.</span><span>ידוע לי כי סכום ההשתתפות של הזכאי והמשפחה בעבור הציוד מהווה דמי שימוש בלבד ואינו מקנה זכות קניין למשתמש.</span>')}
        ${item('<span>8.</span><span>אם לא אחזיר את הציוד בתום תקופת השימוש ולא יאוחר מ- 30 יום מתום השימוש בו, יהיה עליי לשלם למאוחדת את סכום עלות הציוד בכפוף לסעיף ב.3 לעיל.</span>')}
      </div>
    </div>
    ${bottom(2, signatures.driver, meta)}
  `);

  const page3 = fixedPage(`
    ${top()}
    <div style="margin-top:10px;padding-inline-start:28px">
      ${item('<span>9.</span><span>להבטחת מילוי ההתחייבות הנ"ל אני מצרף בזאת שטר חוב על סך 10,000 ₪.</span>')}
      ${item('<span>10.</span><span>אם לא אחזיר את הציוד כאמור ובכפוף לתנאים המופיעים בסעיף ב.3 לעיל, יהיה הספק זכאי לממש את שטר החוב באמצעות הליך משפטי.</span>')}
    </div>
    <div style="font-size:12.5px;margin:20px 0 0;padding-inline-start:120px">ולראייה באנו על החתום,</div>
    <div style="display:flex;gap:18px;align-items:flex-end;margin-top:6px;padding-inline-start:120px">
      ${line('תאריך', val(v, 'formDate'), 100)}
      ${signatureLine('חתימת הערב', signatures.guarantor, 140)}
      ${signatureLine('חתימת הזכאי', signatures.customer, 140)}
    </div>
    <div style="font-size:13px;font-weight:800;margin-top:44px">הערה: על הספק להעביר העתק חתום של מסמך זה, בצירוף שטר החוב, לשרשרת אספקה</div>
    ${bottom(3, signatures.driver, meta)}
  `);

  return page1 + page2 + page3;
}
