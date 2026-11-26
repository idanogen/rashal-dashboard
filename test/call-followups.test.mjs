import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rowToFollowup, activeByCall, dispatchPlace, needsDecision, etaState, buyStatusLabel, prefillItem,
  followupTimeline, partsList, openCountForDesks, validateDecision, techLine, deskOf, KIND_LABEL,
} from '../src/lib/call-followups.ts';

const f = (o) => rowToFollowup({
  id: o.id ?? 'f1', stop_id: o.stop ?? 's1', service_call_id: o.call ?? 'c1', kind: o.kind ?? 'buy_warehouse',
  item: o.item ?? 'רגליות 90 מעלות', urgency: o.urgency ?? 'normal', note: null, status: o.status ?? 'open',
  eta: o.eta ?? null, po_number: null, unavailable_note: o.unavailableNote ?? null, closed_reason: o.closedReason ?? null,
  decided_by_name: 'אבירם קרמר', decided_at: o.decided ?? '2026-11-15T08:05:00Z',
  ordered_by_name: o.orderedAt ? 'אלכס' : null, ordered_at: o.orderedAt ?? null,
  arrived_by_name: o.arrivedAt ? 'אלכס' : null, arrived_at: o.arrivedAt ?? null,
  unavailable_by_name: null, unavailable_at: o.unavailableAt ?? null, closed_at: o.closedAt ?? null,
  customer_name: 'טליאס שירה שרונה', customer_number: null, city: 'שדה עוזיהו', call_docno: 'SC2604071',
  device: 'כסא ממונע R44', tech_name: 'ישראל', tech_note: o.techNote ?? 'רגליות מתנדנדות', visit_date: '2026-11-11',
  updated_at: o.updated ?? '2026-11-15T08:05:00Z',
});
const TODAY = '2026-11-15';

test('הנוסח של עמי נשמר כמו שהוא (וואטסאפ 15/11 12:07)', () => {
  assert.equal(KIND_LABEL.not_home, 'לקוח לא בבית');
  assert.equal(KIND_LABEL.buy_warehouse, 'המשך טיפול · רכש אלכס מחסן');
  assert.equal(KIND_LABEL.buy_workshop, 'המשך טיפול · רכש אלכס בית מלאכה');
  assert.equal(deskOf('buy_workshop'), 'workshop');
  assert.equal(deskOf('revisit'), null);
});

test('מקום במסך השיבוץ: רכש פתוח או הוזמן יוצא מהרשימה, הגיע עולה למעלה, לא ניתן להשיג חוזר', () => {
  assert.equal(dispatchPlace(undefined), 'list');
  assert.equal(dispatchPlace(f({ kind: 'not_home' })), 'list');
  assert.equal(dispatchPlace(f({ kind: 'revisit' })), 'list');
  assert.equal(dispatchPlace(f({ status: 'open' })), 'buying');
  assert.equal(dispatchPlace(f({ status: 'ordered' })), 'buying');
  assert.equal(dispatchPlace(f({ status: 'arrived' })), 'arrived');
  assert.equal(dispatchPlace(f({ status: 'unavailable' })), 'list');
  assert.equal(needsDecision(undefined), true);
  assert.equal(needsDecision(f({ status: 'unavailable' })), true);
  assert.equal(needsDecision(f({ kind: 'not_home' })), false);
});

test('הכרעה פעילה לקריאה: סגורה לא נחשבת, ובין שתיים מנצחת האחרונה', () => {
  const m = activeByCall([
    f({ id: 'a', call: 'c1', status: 'closed' }),
    f({ id: 'b', call: 'c1', decided: '2026-11-14T08:00:00Z' }),
    f({ id: 'c', call: 'c1', decided: '2026-11-15T09:00:00Z', kind: 'not_home' }),
    f({ id: 'd', call: 'c2' }),
  ]);
  assert.equal(m.get('c1').id, 'c');
  assert.equal(m.get('c2').id, 'd');
  assert.equal(m.size, 2);
});

test('צפי: רק להזמנה שהוזמנה, ותג אדום כשעבר', () => {
  assert.equal(etaState(f({ status: 'ordered', eta: '2026-11-14' }), TODAY), 'overdue');
  assert.equal(etaState(f({ status: 'ordered', eta: '2026-11-15' }), TODAY), 'today');
  assert.equal(etaState(f({ status: 'ordered', eta: '2026-11-19' }), TODAY), 'later');
  assert.equal(etaState(f({ status: 'arrived', eta: '2026-11-14' }), TODAY), 'none');
  assert.deepEqual(buyStatusLabel(f({ status: 'ordered', eta: '2026-11-14' }), TODAY), { text: 'צפי עבר · 14/11', tone: 'red' });
  assert.deepEqual(buyStatusLabel(f({ status: 'ordered', eta: '2026-11-19' }), TODAY), { text: 'הוזמן · צפי 19/11', tone: 'violet' });
  assert.deepEqual(buyStatusLabel(f({ status: 'open' }), TODAY), { text: 'לא הוזמן עדיין', tone: 'amber' });
  assert.equal(buyStatusLabel(f({ status: 'arrived', arrivedAt: '2026-11-15T09:40:00Z' }), TODAY).text, 'הגיע 15/11');
});

test('מה צריך ממולא מההערה של הטכנאי, שורה אחת וחתוך', () => {
  assert.equal(prefillItem("גב' רצועות קרוע.\nחישוק גלגל שמאל שבור"), "גב' רצועות קרוע. / חישוק גלגל שמאל שבור");
  assert.equal(prefillItem(null), '');
  assert.equal(prefillItem('א'.repeat(300)).length, 160);
  assert.equal(techLine({ techName: 'ישראל', visitDate: '2026-11-11', techNote: 'רגליות\nלהחליף' }), 'ישראל, 11/11: רגליות / להחליף');
});

test('ציר ההיסטוריה: חדש למעלה, עם מי ומתי', () => {
  const t = followupTimeline(f({ status: 'arrived', orderedAt: '2026-11-15T09:00:00Z', eta: '2026-11-17', arrivedAt: '2026-11-17T08:00:00Z' }));
  assert.deepEqual(t.map((x) => x.text), ['הגיע · אלכס', 'הוזמן, צפי 17/11 · אלכס', 'נשלח לרכש מחסן · אבירם קרמר']);
  const closed = followupTimeline(f({ kind: 'not_home', status: 'closed', closedReason: 'scheduled', closedAt: '2026-11-16T10:00:00Z' }));
  assert.equal(closed[0].text, 'שובץ מחדש, נסגר');
  assert.equal(closed[1].text, 'לקוח לא בבית · אבירם קרמר');
});

test('רשימת שולחן הרכש: רק שלו, לא הוזמן קודם ודחוף לפני רגיל, אחר כך לפי צפי', () => {
  const list = [
    f({ id: 'w-ord-19', status: 'ordered', eta: '2026-11-19' }),
    f({ id: 'w-ord-17', status: 'ordered', eta: '2026-11-17' }),
    f({ id: 'w-open', status: 'open', decided: '2026-11-15T07:00:00Z' }),
    f({ id: 'w-urgent', status: 'open', urgency: 'urgent', decided: '2026-11-14T07:00:00Z' }),
    f({ id: 'shop', kind: 'buy_workshop' }),
    f({ id: 'w-arr', status: 'arrived', arrivedAt: '2026-11-14T10:00:00Z' }),
    f({ id: 'w-old', status: 'closed', arrivedAt: '2026-10-01T10:00:00Z' }),
  ];
  assert.deepEqual(partsList(list, 'warehouse', 'open', TODAY).map((x) => x.id), ['w-urgent', 'w-open', 'w-ord-17', 'w-ord-19']);
  assert.deepEqual(partsList(list, 'warehouse', 'arrived', TODAY).map((x) => x.id), ['w-arr']);
  assert.deepEqual(partsList(list, 'workshop', 'open', TODAY).map((x) => x.id), ['shop']);
  assert.equal(openCountForDesks(list, ['warehouse']), 2);
  assert.equal(openCountForDesks(list, ['warehouse', 'workshop']), 3);
});

test('שמירה: חייבים לבחור, ורכש חייב מה להזמין', () => {
  assert.equal(validateDecision(null, ''), 'צריך לבחור מה עושים עם הקריאה');
  assert.equal(validateDecision('buy_workshop', '  '), 'צריך לכתוב מה להזמין');
  assert.equal(validateDecision('buy_workshop', 'חישוק'), null);
  assert.equal(validateDecision('not_home', ''), null);
});

test('בית מלאכה שתיקן בלי להזמין: "תוקן", ומיד חוזר לשיבוץ (עמי 26/11)', () => {
  const fixed = f({ kind: 'buy_workshop', status: 'arrived', arrivedAt: '2026-11-26T09:40:00Z' });
  assert.equal(buyStatusLabel(fixed, TODAY).text, 'תוקן 26/11');
  assert.equal(dispatchPlace(fixed), 'arrived');
  assert.equal(followupTimeline(fixed)[0].text.startsWith('תוקן'), true);
  const ordered = f({ kind: 'buy_workshop', status: 'arrived', orderedAt: '2026-11-20T09:00:00Z', arrivedAt: '2026-11-26T09:40:00Z' });
  assert.equal(buyStatusLabel(ordered, TODAY).text, 'הגיע 26/11');
  assert.equal(buyStatusLabel(f({ kind: 'buy_warehouse', status: 'arrived', arrivedAt: '2026-11-26T09:40:00Z' }), TODAY).text, 'הגיע 26/11');
});
