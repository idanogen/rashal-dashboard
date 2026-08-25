import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { stockLine, warrantyState, itemTitle, itemSubtitle, sourceLabels } from '../src/lib/customer-answer.ts';

/**
 * נעילת המשפט שנאמר ללקוח על הציוד שלו, בשני המימושים.
 *
 * 🔴 **למה זה קיים:** אותו משפט נבנה פעמיים, ב-TypeScript
 * (`src/lib/customer-answer.ts`) וב-JavaScript של התוסף
 * (`~/Projects/ogen-wa-priority/src/stock.js`). שניהם ניזונים מאותה
 * פונקציה במסד, ולכן **הנתונים** לא יכולים להיפרד. הניסוח כן.
 * נציגה שרואה בפריוריטי "באחריות עד 20/09" ובדשבורד "האחריות נגמרת
 * ב-20/09" מפסיקה להאמין לשניהם.
 *
 * 🔴 **וההפרדה כבר קרתה פעם אחת, ביום שנבנה הרכיב:** סף 60 היום נכנס
 * לדשבורד ולא לתוסף, כך שאחריות שנגמרה בעוד שבועיים נצבעה במסך אחד
 * ולא בשני.
 *
 * הבדיקה מדלגת בשקט אם התוסף אינו על המכונה, כדי שהדשבורד ייבנה גם
 * בלעדיו. 🔴 ומדווחת על הדילוג, כי בדיקה ששותקת נראית כמו בדיקה שעברה.
 */

const PANEL = new URL('../../ogen-wa-priority/src/stock.js', import.meta.url);
const here = new URL(import.meta.url).pathname;

const g = {};
const available = existsSync(PANEL);
if (available) new Function('window', readFileSync(PANEL, 'utf8'))(g);
const S = g.RashalStock;

const NOW = new Date('2026-08-25T12:00:00Z').getTime();
const DEVICE = {
  part: 'G175', desc: '"מנוף חשמלי SUNRISE MEDICAL"', qty: 1,
  serials: ['17517098728'], installedAt: null, warrantyEnd: '2028-01-12',
  lastSeen: '2026-07-07', sources: ['delivery', 'service'], match: 'number',
};
const stock = (o) => ({ devices: [], accessories: [], returned: [], since: '2026-01-01', ...o });

test('התוסף נמצא לצד הדשבורד', () => {
  assert.ok(available,
    `🔴 לא נמצא ${PANEL.pathname}. בלי זה שאר הבדיקות כאן חסרות משמעות, והן ידולגו. (${here})`);
});

test('🔴🔴 סף האחריות זהה בשני המימושים', { skip: !available }, () => {
  for (const end of ['2026-08-01', '2026-09-20', '2026-10-24', '2026-11-01', null, 'בלגן']) {
    assert.equal(S.warrantyState(end, NOW).tone, warrantyState(end, NOW).tone,
      `🔴 המצב שונה בין התוסף לדשבורד עבור ${end}`);
    assert.equal(S.warrantyState(end, NOW).text.replace(/(\d{2})\/(\d{2})\/(\d{4})/, '$1.$2.$3'),
      warrantyState(end, NOW).text,
      `🔴 הניסוח שונה בין התוסף לדשבורד עבור ${end}`);
  }
});

test('🔴 המשפט הראשי זהה בשני המימושים', { skip: !available }, () => {
  const CASES = [
    ['מכשיר אחד', stock({ devices: [DEVICE] })],
    ['אחריות שפגה', stock({ devices: [{ ...DEVICE, warrantyEnd: '2024-01-01' }] })],
    ['שני מכשירים', stock({ devices: [DEVICE, DEVICE] })],
    ['שלושה מכשירים', stock({ devices: [DEVICE, DEVICE, DEVICE] })],
    ['בלי סידורי', stock({ devices: [{ ...DEVICE, serials: [] }] })],
    ['שני סידוריים', stock({ devices: [{ ...DEVICE, serials: ['A', 'B'] }] })],
    ['אביזרים בלבד', stock({ accessories: [{ ...DEVICE, part: null, desc: 'חגורת פרפר', serials: [] }] })],
    ['הכל נאסף', stock({ returned: [{ part: 'G175', desc: 'מנוף', at: '2026-05-26' }] })],
    ['ריק לגמרי', stock()],
    ['בלי נתונים בכלל', null],
  ];
  for (const [name, data] of CASES) {
    // 🔴 התוסף כותב תאריך עם לוכסנים והדשבורד עם נקודות, כי `he-IL`
    // בדפדפן מנקד. זה ההבדל היחיד המותר, וכל שאר המילים חייבות להתלכד.
    const panel = S.stockText(data).text.replace(/(\d{2})\/(\d{2})\/(\d{4})/g, '$1.$2.$3');
    // (התאריך הקצר dd/mm זהה בשני הצדדים ואינו מומר.)
    const dash = stockLine(data, NOW).text;
    assert.equal(panel, dash, `🔴 "${name}": התוסף והדשבורד אומרים דברים שונים`);
  }
});

test('🔴 שם הפריט, התיאור והמקורות זהים', { skip: !available }, () => {
  for (const it of [DEVICE, { part: null, desc: 'חגורת פרפר' }, { part: null, desc: '' }, {}]) {
    assert.equal(S.stockName(it), itemTitle({ part: it.part ?? null, desc: it.desc ?? null }));
    assert.equal(S.stockSub(it), itemSubtitle({ part: it.part ?? null, desc: it.desc ?? null }));
  }
  const srcs = ['register', 'delivery', 'service'];
  assert.equal(S.stockFoot({ sources: srcs }).text, sourceLabels(srcs).join(' · '));
});
