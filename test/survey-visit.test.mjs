import test from 'node:test';
import assert from 'node:assert/strict';
import {
  arrivalNote, essenceText, historyText, nowText, outcomeText, visitLine, visitTypeLabel,
} from '../src/lib/survey-visit.ts';

/**
 * 🔴 26/10/2026, עידן על מסך הסקרים: "חסר לי פה תאריך הביקור ומהות
 * הביקור". המקרים כאן לקוחים מהדירוגים הנמוכים האמיתיים של אותו יום.
 */

test('שורת הביקור: סוג, תאריך, טכנאי ומסמך', () => {
  assert.equal(
    visitLine({ visitType: 'service', visitDate: '2026-10-19', docno: 'SC2603692' }, 'דוד גוזלן'),
    'שירות · 19/10 · דוד גוזלן · SC2603692',
  );
  assert.equal(visitLine({ visitType: 'task', visitDate: '2026-10-20', docno: null }, null), 'משימה · 20/10');
});

test('🔴 מהות האספקה בלי שורת "השתתפות עצמית"', () => {
  assert.equal(essenceText({ essence: 'כרית ויסקו 45X40 · השתתפות עצמית' }), 'כרית ויסקו 45X40');
  assert.equal(essenceText({ essence: 'השתתפות עצמית' }), null);
});

test('מהות השירות: שורות מאוחדות ובלי הטלפון שהמוקד הדביק', () => {
  assert.equal(
    essenceText({ essence: 'מדווחת כי הצד הימני נשבר\nנייד 0503340205' }),
    'מדווחת כי הצד הימני נשבר',
  );
  assert.equal(essenceText({ essence: 'הרגלית נופלת .\n0544380864' }), 'הרגלית נופלת');
});

test('מהות ארוכה נחתכת', () => {
  const t = essenceText({ essence: 'א'.repeat(300) }, 20);
  assert.equal(t.length, 21);
  assert.ok(t.endsWith('…'));
});

test('🔴 הגעה אחרי החלון מסומנת כאיחור, ובתוך החלון לא', () => {
  // אליאס אזמי 25/10: חלון 09:00-11:00, הגיע 12:12 (שעון חורף, UTC+2).
  const late = arrivalNote({ arrivedAt: '2026-10-25T10:12:45Z', windowStart: '09:00', windowEnd: '11:00' });
  assert.equal(late.lateMin, 72);
  assert.match(late.text, /איחור 1 ש' 12 ד'/);
  // קלו שגיא 19/10: חלון 12:00-14:00, הגיע 13:01 (שעון קיץ, UTC+3).
  const ok = arrivalNote({ arrivedAt: '2026-10-19T10:01:39Z', windowStart: '12:00', windowEnd: '14:00' });
  assert.equal(ok.lateMin, 0);
  assert.match(ok.text, /בתוך החלון \u206612:00\u201114:00\u2069/);
});

test('בלי חלון או בלי הגעה: לא ממציאים "בזמן"', () => {
  assert.equal(arrivalNote({ arrivedAt: null, windowStart: '09:00', windowEnd: '11:00' }), null);
  const noWindow = arrivalNote({ arrivedAt: '2026-10-20T10:56:13Z', windowStart: null, windowEnd: null });
  assert.equal(noWindow.lateMin, 0);
  assert.doesNotMatch(noWindow.text, /חלון/);
});

test('סיכום הטכנאי', () => {
  assert.equal(
    outcomeText({ stopStatus: 'completed', resolutionKind: null, resolutionNote: 'אין צורך', photos: 0 }),
    'בוצע · "אין צורך"',
  );
  assert.equal(
    outcomeText({ stopStatus: 'not_completed', resolutionKind: 'not_done', resolutionNote: null, photos: 5 }),
    'לא בוצע · 5 תמונות',
  );
  assert.equal(
    outcomeText({ stopStatus: 'completed', resolutionKind: 'follow_up', resolutionNote: null, photos: 1 }),
    'להמשך טיפול · תמונה אחת',
  );
});

test('🔴 המצב עכשיו: ביקור משובץ קודם לקריאה פתוחה', () => {
  const both = {
    nextStopDate: '2026-10-28', nextStopDriver: 'ישראל', nextStopType: 'service',
    openCallDocno: 'SC2603471', openCallStatus: 'להמשך טיפול',
  };
  assert.deepEqual(nowText(both), { text: 'משובץ לשירות ב-28/10 אצל ישראל', tone: 'active' });
  assert.deepEqual(
    nowText({ ...both, nextStopDate: null }),
    { text: 'קריאה פתוחה SC2603471 (להמשך טיפול), לא משובצת', tone: 'open' },
  );
  assert.equal(
    nowText({ nextStopDate: null, nextStopDriver: null, nextStopType: null, openCallDocno: null, openCallStatus: null }),
    null,
  );
});

test('היסטוריה רק כשיש מה לומר: קריאה אחת היא הביקור עצמו', () => {
  assert.equal(historyText({ calls90: 1, priorLow: 0 }), null);
  assert.equal(historyText({ calls90: 3, priorLow: 1 }), '3 קריאות שירות ב-90 יום · דירג נמוך גם בעבר');
});

test('⭐ שמות סוגי הביקור לעמודה "לפי סוג ביקור"', () => {
  // surveys.ts מייבא את לקוח supabase ולכן לא נטען כאן; הקיבוץ עצמו הוא
  // groupAverage הקיים, והשם לכל סוג מגיע מכאן.
  assert.equal(visitTypeLabel('service'), 'שירות');
  assert.equal(visitTypeLabel('customer'), 'אספקה ללקוח חדש');
  assert.equal(visitTypeLabel(null), null);
  assert.equal(visitTypeLabel('future_type'), 'future_type');
});
