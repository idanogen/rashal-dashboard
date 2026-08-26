import test from 'node:test';
import assert from 'node:assert/strict';
import { assessHeyy, REQUIRED_EVENTS } from '../supabase/functions/rashal-watchdog/heyy-health.ts';

/**
 * 🔴 שני הגופים כאן הועתקו מהתשובה האמיתית של heyy (25/08/2026), ולא
 * הומצאו. מבנה מומצא היה מאשר את עצמו, וזה בדיוק מה שקרה לנו כשהקוד
 * קרא שדה `waMessageId` שלא קיים בסכימה שלהם בכלל.
 */
const CHANNEL_ID = '3f150cef-982b-4b3e-bb44-36dcbfede6b6';
const URL_BASE = 'https://rashal-dashboard.vercel.app/api/heyy-webhook';

const ev = (type) => ({ type, scopes: [{ type: 'channel', ids: [CHANNEL_ID] }] });

const WEBHOOKS = {
  success: true,
  data: [{
    id: 'e4738a9c-944d-491c-82eb-b219984d50df',
    status: 'active',
    url: `${URL_BASE}?k=c9b79e200b9aa68a0f17c6e7a20ef0b3e6a9a8cac7085e80`,
    events: REQUIRED_EVENTS.map(ev),
  }],
};

const CHANNELS = {
  success: true,
  data: [{
    id: CHANNEL_ID,
    name: 'ר.שעל שירותי עזר לנכים',
    type: 'whatsapp',
    status: 'active',
    vendorDetails: {
      wabaId: '1002459035894051',
      phoneNumber: '+972587373673',
      isVerified: false,
      dailyLimit: 10000,
      qualityRating: 'high',
    },
  }],
};

const base = (over = {}) => ({
  webhooks: structuredClone(WEBHOOKS),
  channels: structuredClone(CHANNELS),
  probeError: null,
  expectedWebhookUrl: URL_BASE,
  expectedChannelId: CHANNEL_ID,
  ...over,
});

test('המצב האמיתי של היום נקרא תקין', () => {
  const h = assessHeyy(base());
  assert.equal(h.verdict, 'ok');
  assert.deepEqual(h.problems, []);
  assert.equal(h.facts.quality, 'high');
  assert.equal(h.facts.webhook_status, 'active');
});

/**
 * 🔴🔴 הבדיקה שמצדיקה את כל הקובץ. זה הכשל שאי אפשר לראות משום מסך:
 * heyy משביתה את הוובהוק בעצמה, והמערכת נראית בדיוק כמו יום שקט.
 * ⭐ בדיקה שרק מוודאת שהמצב התקין נקרא תקין הייתה עוברת גם אילו
 * הפונקציה החזירה 'ok' תמיד. [[guard_must_exercise_the_state_it_guards]]
 */
test('🔴 heyy השביתה את הוובהוק', () => {
  const input = base();
  input.webhooks.data[0].status = 'disabled';
  const h = assessHeyy(input);
  assert.equal(h.verdict, 'down');
  assert.match(h.problems.join(' '), /השביתה את הוובהוק/);
});

test('🔴 הוובהוק נמחק לגמרי', () => {
  const h = assessHeyy(base({ webhooks: { success: true, data: [] } }));
  assert.equal(h.verdict, 'down');
  assert.match(h.problems.join(' '), /אין ב-heyy שום וובהוק/);
});

test('🔴 הוובהוק מצביע על כתובת אחרת', () => {
  const input = base();
  input.webhooks.data[0].url = 'https://webhook.site/abc?k=x';
  assert.equal(assessHeyy(input).verdict, 'down');
});

/**
 * 🔴 מישהו יצר את הוובהוק מחדש בממשק ושכח את הפרמטר. האנדפוינט מחזיר
 * 401 על כל קריאה, ולכן heyy תשבית אותו בעצמה תוך זמן קצר. עדיף לתפוס
 * את זה מיד ולא יומיים אחר כך.
 */
test('🔴 הוובהוק רשום בלי הסוד בכתובת', () => {
  const input = base();
  input.webhooks.data[0].url = URL_BASE;
  const h = assessHeyy(input);
  assert.equal(h.verdict, 'down');
  assert.match(h.problems.join(' '), /בלי הסוד/);
});

test('🔴 חסר אירוע: הודעה נכנסת', () => {
  const input = base();
  input.webhooks.data[0].events = [ev('message.sent'), ev('message.updated')];
  const h = assessHeyy(input);
  assert.equal(h.verdict, 'down');
  assert.match(h.problems.join(' '), /message\.received/);
});

/** אירוע שרשום על ערוץ אחר אינו רשום עלינו, וזה נראה זהה ברשימה. */
test('🔴 האירועים רשומים על ערוץ אחר', () => {
  const input = base();
  input.webhooks.data[0].events = REQUIRED_EVENTS.map((t) => ({
    type: t, scopes: [{ type: 'channel', ids: ['00000000-0000-0000-0000-000000000000'] }],
  }));
  const h = assessHeyy(input);
  assert.equal(h.verdict, 'down');
  assert.match(h.problems.join(' '), /חסרים אירועים/);
});

test('🔴 הערוץ כבוי, ולכן שום הודעה לא תצא', () => {
  const input = base();
  input.channels.data[0].status = 'inactive';
  assert.equal(assessHeyy(input).verdict, 'down');
});

test('🔴 דירוג האיכות במטא ירד לנמוך', () => {
  const input = base();
  input.channels.data[0].vendorDetails.qualityRating = 'low';
  const h = assessHeyy(input);
  assert.equal(h.verdict, 'down');
  assert.match(h.problems.join(' '), /דירוג האיכות/);
});

test('דירוג בינוני מתריע אבל אינו תקלה', () => {
  const input = base();
  input.channels.data[0].vendorDetails.qualityRating = 'medium';
  assert.equal(assessHeyy(input).verdict, 'warn');
});

/**
 * 🔴 "לא הצלחתי לשאול" אינו "תקין" ואינו "תקלה". תקלת רשת אחת מול heyy
 * לא אמורה להעיר את עידן, ולכן המצב מוחזר בנפרד והמתקשר מחליט.
 */
test('🔴 כשל בקריאה מוחזר כלא-ידוע ולא כתקין', () => {
  assert.equal(assessHeyy(base({ probeError: 'HTTP 429' })).verdict, 'unknown');
  assert.equal(assessHeyy(base({ webhooks: null })).verdict, 'unknown');
  assert.equal(assessHeyy(base({ channels: null })).verdict, 'unknown');
});

test('לוכסן מסיים או סוד אחר עדיין אותה כתובת', () => {
  const input = base();
  input.webhooks.data[0].url = `${URL_BASE}/?k=something-else`;
  assert.equal(assessHeyy(input).verdict, 'ok');
});

test('שני כשלים נאמרים שניהם, ולא רק הראשון', () => {
  const input = base();
  input.webhooks.data[0].status = 'disabled';
  input.channels.data[0].vendorDetails.qualityRating = 'low';
  const h = assessHeyy(input);
  assert.equal(h.problems.length, 2);
});
