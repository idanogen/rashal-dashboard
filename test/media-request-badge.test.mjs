import test from 'node:test';
import assert from 'node:assert/strict';
import { mediaBadge, MEDIA_BADGE_CLASS } from '../src/lib/media-request-badge.ts';

/**
 * החיווי של "תמונה לפני טכנאי" (עמי, 30/08/2026).
 * הבדיקה מגנה על שני כללים: לכל מצב פעיל יש תווית וצבע שאומרים מה
 * לעשות, ומצב חסר-פעולה לא צובע את הכרטיס.
 * [[color_on_everything_is_not_color]]
 */

test('🔴 תמונה התקבלה היא ירוק, המצבים הממתינים ענבר', () => {
  assert.equal(mediaBadge('media_received').tone, 'green');
  assert.equal(mediaBadge('first_sent').tone, 'amber');
  assert.equal(mediaBadge('reminder_sent').tone, 'amber');
});

test('🔴 מה שדורש אדם: אין מענה וכישלון אדומים, ענה-בלי-תמונה כחול', () => {
  assert.equal(mediaBadge('no_response').tone, 'red');
  assert.equal(mediaBadge('failed').tone, 'red');
  assert.equal(mediaBadge('replied_no_media').tone, 'blue');
});

test('🔴 בוטל ודולג לא מוצגים בכלל', () => {
  assert.equal(mediaBadge('cancelled'), null);
  assert.equal(mediaBadge('skipped'), null);
});

test('מצב לא מוכר לא מפיל ולא צובע', () => {
  assert.equal(mediaBadge('something_new'), null);
});

test('לכל טון יש מחלקת עיצוב, כי Tailwind לא יוצר מחלקות בזמן ריצה', () => {
  for (const s of ['media_received', 'pending', 'first_sent', 'reminder_sent', 'replied_no_media', 'no_response', 'failed', 'no_phone']) {
    const b = mediaBadge(s);
    assert.ok(b, `state ${s} has a badge`);
    assert.ok(MEDIA_BADGE_CLASS[b.tone], `tone ${b.tone} has a class`);
  }
});
