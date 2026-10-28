import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFieldChangeEmail, changedRows, priorityLines, recipientEmails } from '../supabase/functions/rashal-field-change-mail/mail.ts';

const base = {
  id: 'x', customer_number: '213217904', customer_name: 'קלינלרר משה', source_type: 'service', delivery_date: '2026-10-28',
  driver: 'דוד גוזלן', doc_number: 'SC2603870', changed_by_name: 'דוד גוזלן', changed_by_role: 'driver', scope: 'once',
  old_address: 'יוסי בר חלפתא 11', new_address: 'עלה שיח, הרצל 3', old_city: null, new_city: null, old_phone: null, new_phone: null,
  other_stops_updated: 0, priority_contact_added: false, priority_event_id: null, created_at: '2026-10-28T11:30:00Z',
};

test('רק השדות שהשתנו נכנסים לטבלה, בסדר קבוע', () => {
  const rows = changedRows({ ...base, new_phone: '0501234567', old_phone: '' });
  assert.deepEqual(rows.map((r) => r.label), ['כתובת', 'טלפון']);
  assert.equal(rows[1].before, 'ריק');
});

test('חד פעמי: המייל אומר שבפריוריטי לא השתנה כלום', () => {
  const m = buildFieldChangeEmail(base, { dashboardUrl: 'https://x' });
  assert.match(m.subject, /^חד פעמי · כתובת של קלינלרר משה/);
  assert.ok(m.html.includes('בפריוריטי לא השתנה כלום'));
  assert.ok(m.html.includes('line-through'));
  assert.ok(m.html.includes('dir="rtl"'));
  // 🔴 בלי גרש ארוך בשום טקסט (כלל ברזל #0)
  assert.ok(!/[—–]/.test(m.html) && !/[—–]/.test(m.text));
});

test('קבוע: איש קשר ודו-שיח פנימי, והכרטיס לא נדרס', () => {
  const lines = priorityLines({ ...base, scope: 'permanent', priority_contact_added: true, priority_event_id: 'fcp-1' });
  assert.equal(lines.length, 3);
  assert.ok(lines[0].includes('איש קשר'));
  assert.ok(lines[2].includes('רק מוסיפים ולא דורסים'));
  const none = priorityLines({ ...base, scope: 'permanent', customer_number: null });
  assert.ok(none[0].includes('אין מספר לקוח'));
});

test('תווים מסוכנים בשם הלקוח מקודדים', () => {
  const m = buildFieldChangeEmail({ ...base, customer_name: '<b>x</b>' }, { dashboardUrl: 'https://x' });
  assert.ok(m.html.includes('&lt;b&gt;x&lt;/b&gt;'));
  assert.ok(!m.html.includes('<b>x</b>'));
});

test('נמענים: תקינים בלבד, בלי כפילויות, באותיות קטנות', () => {
  const to = recipientEmails([{ email: 'Ami@mishal.co.il' }, { email: 'ami@mishal.co.il' }, { email: 'לא כתובת' }, { name: 'x' }, 'junk']);
  assert.deepEqual(to, ['ami@mishal.co.il']);
  assert.deepEqual(recipientEmails(null), []);
});
