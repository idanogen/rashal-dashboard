import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  codeForVerdict, httpStatusFor, normalizeMobile, requestMessage,
} from '../api/_lib/reset-request.ts';

/**
 * איפוס סיסמה בשירות עצמי ממסך ההתחברות (עידן, 18/09/2026).
 * ההחלטות: מזהים לפי טלפון · מספר שאינו רשום מקבל תשובה מפורשת.
 */

test('נייד ישראלי מתקבל בכל צורה שאנשים מקלידים בה', () => {
  for (const raw of ['0541234567', '054-123-4567', '054 1234567', '+972541234567', '972541234567', ' 054–1234567 ']) {
    assert.equal(normalizeMobile(raw), '+972541234567', raw);
  }
  assert.equal(normalizeMobile('0585393000'), '+972585393000');
});

test('🔴 מה שאי אפשר לשלוח אליו וואטסאפ נפסל מיד', () => {
  assert.equal(normalizeMobile('031234567'), null, 'קו נייח');
  assert.equal(normalizeMobile('054123456'), null, 'ספרה חסרה');
  assert.equal(normalizeMobile('05412345678'), null, 'ספרה עודפת');
  assert.equal(normalizeMobile('+15551234567'), null, 'מספר זר');
  assert.equal(normalizeMobile(''), null);
  assert.equal(normalizeMobile('שלום'), null);
});

test('פסק הדין של השער מתורגם לקוד אחד שהאדם רואה', () => {
  assert.equal(codeForVerdict('ok'), null, 'עובר הלאה, אין מה להציג');
  assert.equal(codeForVerdict('disabled'), 'disabled');
  // 🔴 ארבע התקרות נראות זהות לאדם: לומר לו *איזו* תקרה נגע בה מספר
  //    למי שסורק מספרים כמה מהם כבר נוסו.
  for (const v of ['phone_hour', 'phone_day', 'ip_hour', 'global_hour']) {
    assert.equal(codeForVerdict(v), 'rate', v);
  }
});

test('🔴 מספר שאינו רשום מקבל תשובה מפורשת (החלטת עידן), ותמיד עם דרך המשך', () => {
  const noUser = requestMessage('no_user');
  assert.match(noUser, /לא רשום/);
  assert.match(noUser, /מנהל/, 'אסור להשאיר אדם בלי מה לעשות עכשיו');
  for (const code of ['no_user', 'ambiguous', 'rate', 'disabled', 'suppressed', 'failed']) {
    assert.match(requestMessage(code), /מנהל/, code);
  }
});

test('הודעת ההצלחה נושאת את תוקף הקישור בפועל', () => {
  assert.match(requestMessage('sent', 15), /15 דקות/);
  assert.match(requestMessage('sent', 30), /30 דקות/);
});

test('🔴 אין קוד מצב שמסגיר אם המספר קיים', () => {
  // תשובה 404 על "אין משתמש" ו-200 על "נשלח" הופכות את הכתובת הזאת
  // למנוע סריקה נוח, גם כשהטקסט זהה.
  assert.equal(httpStatusFor('sent'), 200);
  assert.equal(httpStatusFor('no_user'), 200);
  assert.equal(httpStatusFor('rate'), 200);
  assert.equal(httpStatusFor('ambiguous'), 200);
  assert.equal(httpStatusFor('failed'), 502, 'תקלת שרת אמיתית כן נבדלת');
});

test('🔴🔴 השרת קורא את הטלפון מכרטיס העובד ולעולם לא שולח למספר מגוף הבקשה', () => {
  const src = readFileSync(new URL('../api/password-reset.ts', import.meta.url), 'utf8');
  const seg = src.slice(src.indexOf('async function handleRequest'), src.indexOf('export default async function'));
  assert.match(seg, /\.eq\('phone_e164', phone\)/, '🔴 החיפוש חייב להיות לפי העמודה בכרטיס');
  assert.match(seg, /\.eq\('disabled', false\)/, '🔴 חשבון מושבת לא מקבל דרך חזרה');
  assert.match(seg, /rows\.length > 1/, '🔴 מספר על שני חשבונות חייב לעצור, לא לבחור');
  assert.match(seg, /password_reset_request_gate/, '🔴 אין שער תקרות לפני הפנייה למסד');
  // השער נספר לפני שמגיעים למסד ולטלפון של מישהו.
  assert.ok(seg.indexOf('password_reset_request_gate') < seg.indexOf("from('profiles')"),
    '🔴 התקרה נבדקת אחרי החיפוש, כלומר סורק מספרים לא נעצר');
});

test('🔴 המספר עצמו לא נרשם ביומן הבקשות, רק גיבוב', () => {
  const src = readFileSync(new URL('../api/password-reset.ts', import.meta.url), 'utf8');
  assert.match(src, /createHash\('sha256'\)\.update\(`\$\{HASH_PEPPER\}:\$\{phone\}`\)/,
    '🔴 טבלה שמוזנת מנקודת קצה פתוחה לא תחזיק ניידים של עובדים');
  assert.doesNotMatch(src, /p_phone_hash: phone\b/, '🔴 נשלח המספר במקום הגיבוב');
});
