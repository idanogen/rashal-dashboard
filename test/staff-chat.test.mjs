import test from 'node:test';
import assert from 'node:assert/strict';
import { rowToMessage, buildConversations, threadWith, totalUnread, displayName, notificationText, peerOf } from '../src/lib/staff-chat.ts';

const msg = (o) => rowToMessage({ id: o.id, sender_id: o.from, sender_name: o.from, recipient_id: o.to, recipient_name: o.to, body: o.body ?? 'היי', created_at: o.at, read_at: o.read ?? null });
const people = [
  { id: 'me', name: 'אילונה', role: 'viewer' },
  { id: 'ami', name: 'עמי גז', role: 'team_manager' },
  { id: 'avi', name: 'אבי', role: 'driver', linkedDriver: 'אבי' },
  { id: 'shura', name: 'שורה', role: 'viewer' },
];
const messages = [
  msg({ id: '1', from: 'ami', to: 'me', at: '2026-10-09T07:00:00Z', read: '2026-10-09T07:05:00Z' }),
  msg({ id: '2', from: 'me', to: 'ami', at: '2026-10-09T07:10:00Z' }),
  msg({ id: '3', from: 'avi', to: 'me', at: '2026-10-09T06:00:00Z' }),
  msg({ id: '4', from: 'avi', to: 'me', at: '2026-10-09T06:01:00Z', body: 'הגעתי ללקוח אבל אין מענה' }),
  msg({ id: '5', from: 'me', to: 'shura', at: '2026-10-08T12:00:00Z' }),
];

test('הצד השני של הודעה', () => {
  assert.equal(peerOf(messages[0], 'me'), 'ami');
  assert.equal(peerOf(messages[1], 'me'), 'ami');
});

test('רשימת השיחות: לא-נקרא למעלה, ואז לפי ההודעה האחרונה, בלי אני', () => {
  const convs = buildConversations(people, messages, 'me');
  assert.deepEqual(convs.map((c) => [c.peer.id, c.unread, c.lastMessage?.id ?? null]), [
    ['avi', 2, '4'],
    ['ami', 0, '2'],
    ['shura', 0, '5'],
  ]);
});

test('אדם בלי שיחה עדיין ברשימה, בסוף לפי שם', () => {
  const convs = buildConversations([...people, { id: 'oleg', name: 'אולג', role: 'driver' }], messages, 'me');
  assert.equal(convs[convs.length - 1].peer.id, 'oleg');
  assert.equal(convs[convs.length - 1].lastMessage, null);
});

test('השרשור מול אדם אחד, מהישנה לחדשה, ורק שלנו', () => {
  assert.deepEqual(threadWith(messages, 'me', 'ami').map((m) => m.id), ['1', '2']);
  assert.deepEqual(threadWith(messages, 'me', 'avi').map((m) => m.id), ['3', '4']);
  assert.deepEqual(threadWith(messages, 'ami', 'avi').map((m) => m.id), []);
});

test('מונה כולל, שם לתצוגה, וטקסט התראה', () => {
  assert.equal(totalUnread(messages, 'me'), 2);
  assert.equal(totalUnread(messages, 'ami'), 1);
  assert.equal(displayName({ fullName: ' עמי גז ' }), 'עמי גז');
  assert.equal(displayName({ fullName: null, linkedDriver: 'אבי', username: 'avi1' }), 'אבי');
  assert.equal(displayName({ username: 'nat' }), 'nat');
  assert.deepEqual(notificationText(messages[3]), { title: 'הודעה מavi', body: 'הגעתי ללקוח אבל אין מענה' });
  assert.equal(notificationText(msg({ id: 'x', from: 'a', to: 'b', at: '', body: 'א'.repeat(200) })).body.length, 118);
});

// ─── סדר ונעיצה (09/10/2026) ───────────────────────────────────────────
import { applyPrefs, togglePinned, reorderPrefs, EMPTY_PREFS } from '../src/lib/staff-chat.ts';

test('בלי העדפות הרשימה כמו שהייתה', () => {
  const convs = buildConversations(people, messages, 'me');
  assert.deepEqual(applyPrefs(convs, EMPTY_PREFS).map((c) => c.peer.id), ['avi', 'ami', 'shura']);
});

test('נעוצים למעלה בסדר הנעיצה, אחר כך סדר ידני, אחר כך השאר', () => {
  const convs = buildConversations(people, messages, 'me');
  let prefs = togglePinned(EMPTY_PREFS, 'shura');
  assert.deepEqual(applyPrefs(convs, prefs).map((c) => c.peer.id), ['shura', 'avi', 'ami']);
  prefs = togglePinned(prefs, 'ami');
  assert.deepEqual(applyPrefs(convs, prefs).map((c) => c.peer.id), ['shura', 'ami', 'avi']);
  prefs = togglePinned(prefs, 'shura');
  assert.deepEqual(applyPrefs(convs, prefs).map((c) => c.peer.id), ['ami', 'avi', 'shura']);
  // סדר ידני על הלא-נעוצים, ומי שלא ברשימה הידנית נשאר בסוף
  const manual = { pinned: ['ami'], sortOrder: ['shura'] };
  assert.deepEqual(applyPrefs(convs, manual).map((c) => c.peer.id), ['ami', 'shura', 'avi']);
  // מזהה שכבר לא קיים לא מפיל כלום
  assert.deepEqual(applyPrefs(convs, { pinned: ['ghost'], sortOrder: ['ghost2', 'avi'] }).map((c) => c.peer.id), ['avi', 'ami', 'shura']);
});

test('גרירה בתוך הקבוצה משנה סדר, בין קבוצות לא', () => {
  const shown = ['ami', 'avi', 'shura'];
  const prefs = { pinned: ['ami'], sortOrder: [] };
  assert.deepEqual(reorderPrefs(prefs, shown, 'shura', 'avi'), { pinned: ['ami'], sortOrder: ['shura', 'avi'] });
  assert.deepEqual(reorderPrefs(prefs, shown, 'shura', 'ami'), prefs);
  assert.deepEqual(reorderPrefs(prefs, shown, 'avi', 'avi'), prefs);
  const two = { pinned: ['ami', 'shura'], sortOrder: [] };
  assert.deepEqual(reorderPrefs(two, ['ami', 'shura', 'avi'], 'shura', 'ami'), { pinned: ['shura', 'ami'], sortOrder: [] });
});
