import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMobile, formatMobile, buildPhoneBook, addResultLine, addErrorLine } from '../src/lib/contact-phone.ts';

/**
 * 🔴 המספר הולך ל-`customer_add_contact` ומשם לוואטסאפ ולפריוריטי. מספר
 * מעוות שם הוא הודעה לאדם הלא נכון, ולכן רוב הבדיקות על קלט מוזר.
 */

test('כל צורה שמקלידים → 05XXXXXXXX', () => {
  assert.equal(normalizeMobile('052-369-4547'), '0523694547');
  assert.equal(normalizeMobile('+972 52 369 4547'), '0523694547');
  assert.equal(normalizeMobile('972523694547'), '0523694547');
  assert.equal(normalizeMobile('523694547'), '0523694547');
  assert.equal(normalizeMobile(' (052) 3694547 '), '0523694547');
});

test('קווי, קצר, ריק ושטויות → null', () => {
  assert.equal(normalizeMobile('03-5551234'), null);
  assert.equal(normalizeMobile('05236945'), null);
  assert.equal(normalizeMobile('052369454712'), null);
  assert.equal(normalizeMobile(''), null);
  assert.equal(normalizeMobile(null), null);
  assert.equal(normalizeMobile('אבג'), null);
});

test('תצוגה עם מקפים רק לנייד תקין', () => {
  assert.equal(formatMobile('0523694547'), '052-369-4547');
  assert.equal(formatMobile('035551234'), '035551234');
});

test('הספר: ראשי, מקושר, פריוריטי, בלי כפילויות', () => {
  const book = buildPhoneBook('052-3694547', [
    { kind: 'priority', phone_local: '0541111111', label: 'דנה · פיזיותרפיסטית', created_by: null, created_at: '2026-09-01', priority_pushed_at: null },
    { kind: 'linked', phone_local: '0523694547', label: 'כפול של הראשי', created_by: 'עמי', created_at: '2026-10-01', priority_pushed_at: null },
    { kind: 'linked', phone_local: '0587777777', label: 'הבת, מיכל', created_by: 'עמי', created_at: '2026-10-02', priority_pushed_at: '2026-10-02' },
    { kind: 'priority', phone_local: '0587777777', label: 'מיכל', created_by: null, created_at: '2026-09-01', priority_pushed_at: null },
  ]);
  assert.deepEqual(book.map((e) => [e.kind, e.phone, e.label]), [
    ['main', '0523694547', null],
    ['linked', '0587777777', 'הבת, מיכל'],
    ['priority', '0541111111', 'דנה · פיזיותרפיסטית'],
  ]);
  assert.equal(book[1].priorityPushedAt, '2026-10-02');
});

test('בלי טלפון ראשי הספר מתחיל מהמקושרים', () => {
  const book = buildPhoneBook(null, [
    { kind: 'linked', phone_local: '0587777777', label: '', created_by: null, created_at: null, priority_pushed_at: null },
  ]);
  assert.deepEqual(book.map((e) => [e.kind, e.phone, e.label]), [['linked', '0587777777', null]]);
});

test('תוצאת ההוספה והשגיאות במילים של הנציג', () => {
  assert.match(addResultLine('added', '0587777777'), /058-777-7777 נוסף/);
  assert.match(addResultLine('already_linked', '0587777777'), /כבר מקושר/);
  assert.match(addResultLine('is_main_phone', '0587777777'), /הראשי/);
  assert.match(addErrorLine('not a mobile number'), /נייד/);
  assert.match(addErrorLine('not authorized'), /הרשאה/);
  assert.match(addErrorLine('boom'), /נסו שוב/);
});
