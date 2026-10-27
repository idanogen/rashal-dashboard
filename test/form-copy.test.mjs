import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanEmail, copyFileName, docTypeLabel, emailOptions, MAX_RECIPIENTS_PER_SEND, parseRecipients, phoneOptions,
} from '../supabase/functions/rashal-form-copy/recipients.ts';
import { isSignedFormPdfPath } from '../api/_lib/signed-form-path.ts';

/** העתק טופס חתום ללקוח (עמי + הכרעות עידן, 27/10/2026). */

// נרמול מדומה: הספרות בלבד, 972 → 0. הנרמול האמיתי הוא `wa_normalize_phone` במסד.
const norm = (raw) => {
  const d = String(raw).replace(/\D/g, '');
  return d.startsWith('972') ? `0${d.slice(3)}` : d || null;
};

test('איש הקשר מוצג עם שם ותפקיד, כי הוא לא תמיד הלקוח (פיזיו של כללית)', () => {
  const opts = emailOptions(null, [{ NAME: 'נוגה בורג', POSITIONDES: 'פיזיו/כללית', EMAIL: 'nogabu@clalit.org.il' }]);
  assert.deepEqual(opts, [{ value: 'nogabu@clalit.org.il', label: 'נוגה בורג · פיזיו/כללית', source: 'contact' }]);
});

test('מייל מהכרטיס ראשון, כפילות ואיש קשר לא פעיל יורדים', () => {
  const opts = emailOptions(' A@B.co.il ', [
    { NAME: 'בת', EMAIL: 'a@b.co.il' },
    { NAME: 'לשעבר', EMAIL: 'old@x.com', STATDES: 'לא פעיל' },
    { NAME: 'בן', EMAIL: 'son@x.com', STATDES: 'פעיל' },
  ]);
  assert.deepEqual(opts.map((o) => [o.value, o.source]), [['a@b.co.il', 'customer'], ['son@x.com', 'contact']]);
});

test('טלפונים: העצירה ראשונה, קווי וכפול יורדים', () => {
  const opts = phoneOptions('050-1234567', ['+972501234567', '03-6221100', '052-7654321'], [{ NAME: 'בן', CELLPHONE: '054-1112222' }], norm);
  assert.deepEqual(opts.map((o) => [o.value, o.source]), [
    ['0501234567', 'stop'], ['0527654321', 'form'], ['0541112222', 'contact'],
  ]);
});

test('כתובת מייל לא תקינה נדחית', () => {
  for (const bad of ['', 'abc', 'a@b', 'a b@c.com', 'a@b.c', 'x@y.com, z@w.com']) assert.equal(cleanEmail(bad), null, bad);
  assert.equal(cleanEmail('Moshe.K@Gmail.com'), 'moshe.k@gmail.com');
});

test('התבנית נפתחת ב"מצורפת", ולכן סוג המסמך בנקבה', () => {
  assert.equal(docTypeLabel('delivery_note', 'delivery'), 'תעודת המשלוח החתומה');
  assert.equal(docTypeLabel('maccabi-return', 'return'), 'תעודת החזרת הציוד החתומה');
  assert.equal(docTypeLabel('clalit-delivery', 'delivery'), 'תעודת קבלת הציוד החתומה');
});

test('שם הקובץ באנגלית בלבד', () => {
  assert.equal(copyFileName('SH2604192', '2026-10-27T08:00:00Z'), 'R-Shaal-signed-SH2604192.pdf');
  assert.equal(copyFileName(null, '2026-10-27T08:00:00Z'), 'R-Shaal-signed-2026-10-27.pdf');
  assert.match(copyFileName('הזמנה 5', null), /^[A-Za-z0-9.-]+$/);
});

test('בקשת שליחה: עד שלושה נמענים, ערוץ ומייל תקינים', () => {
  assert.deepEqual(parseRecipients([{ channel: 'email', value: 'A@b.com', source: 'contact', label: 'בן' }]),
    [{ channel: 'email', value: 'a@b.com', source: 'contact', label: 'בן' }]);
  assert.equal(parseRecipients([]), null);
  assert.equal(parseRecipients([{ channel: 'sms', value: '0501234567' }]), null);
  assert.equal(parseRecipients([{ channel: 'email', value: 'nope' }]), null);
  const many = Array.from({ length: MAX_RECIPIENTS_PER_SEND + 1 }, () => ({ channel: 'whatsapp', value: '0501234567' }));
  assert.equal(parseRecipients(many), null);
  assert.equal(parseRecipients([{ channel: 'whatsapp', value: '0501234567', source: 'hack' }])[0].source, 'typed');
});

test('הנתיב שנשלח ל-heyy-send חייב להיות PDF של טופס חתום', () => {
  assert.equal(isSignedFormPdfPath('e97d4ba1-8516-4aff-8754-a8660b3e7dcd/8512400a-7cfa-48db-ad8c-e4c6dde4d4d9.pdf'), true);
  for (const bad of [
    'e97d4ba1-8516-4aff-8754-a8660b3e7dcd/sling-8512400a-7cfa-48db-ad8c-e4c6dde4d4d9.jpg',
    '../e97d4ba1-8516-4aff-8754-a8660b3e7dcd/8512400a-7cfa-48db-ad8c-e4c6dde4d4d9.pdf',
    'other-bucket/x.pdf', '', null,
  ]) assert.equal(isSignedFormPdfPath(bad), false, String(bad));
});
