import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deliveryMail, remindersMail } from '../supabase/functions/rashal-morning-report/mail.ts';

/** הדוחות גם במייל לתיבות המשרד (שלומי, 18/11/2026). */

test('דוח האספקות במייל: אותם מספרים וקישור לדוח של אותו יום', () => {
  const m = deliveryMail('evening', 'יום שלישי 17/11', '2026-11-17', { planned: 44, delivered: 32, not_delivered: 5, follow_up: 2, open: 5 }, '86%');
  assert.match(m.subject, /יום שלישי 17\/11/);
  assert.match(m.html, /\/morning\/2026-11-17/);
  assert.match(m.text, /שובצו לנהגים ולטכנאים: 44/);
  assert.match(m.text, /להמשך טיפול אחרי ביקור: 2/);
  assert.match(m.html, /dir="rtl"/);
});

test('דוח התזכורות במייל, ובלי גרש ארוך בטקסט', () => {
  const m = remindersMail('יום רביעי 18/11', '2026-11-18', 30, 9, 21, 'דברי רפאל: "שלום"');
  assert.match(m.text, /נשלחו אמש: 30/);
  assert.match(m.text, /מה ענו: דברי רפאל/);
  for (const s of [m.html, m.text]) assert.doesNotMatch(s, /[–—]/);
});

test('הפונקציה שולחת לכתובות שבהגדרות, ולא לנמעני הוואטסאפ', () => {
  const src = readFileSync(new URL('../supabase/functions/rashal-morning-report/index.ts', import.meta.url), 'utf8');
  assert.match(src, /cfg\.email_recipients/);
  assert.match(src, /deliveryMail\(/);
  assert.match(src, /remindersMail\(/);
});
