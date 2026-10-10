import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_EMOJIS, EMOJI_GROUPS, isEmojiOnly, insertAt } from '../src/lib/emoji.ts';

test('הלוח: שלוש קבוצות, בלי כפילויות', () => {
  assert.equal(EMOJI_GROUPS.length, 3);
  assert.equal(new Set(ALL_EMOJIS).size, ALL_EMOJIS.length);
  assert.ok(ALL_EMOJIS.includes('👍') && ALL_EMOJIS.includes('✅'));
});

test('הודעה שכולה אימוג\'י (עד ארבעה) מוצגת גדול', () => {
  assert.equal(isEmojiOnly('👍'), true);
  assert.equal(isEmojiOnly(' 👍👌 '), true);
  assert.equal(isEmojiOnly('❤️'), true);
  assert.equal(isEmojiOnly('🙏🏽'), true);
  assert.equal(isEmojiOnly('👍 תודה'), false);
  assert.equal(isEmojiOnly('👍👍👍👍👍'), false);
  assert.equal(isEmojiOnly(''), false);
  assert.equal(isEmojiOnly('בסדר'), false);
});

test('הוספה במיקום הסמן, ובסוף כשאין סמן', () => {
  assert.deepEqual(insertAt('שלום', '👍', null), { text: 'שלום👍', cursor: 6 });
  assert.deepEqual(insertAt('אב', '✅', 1), { text: 'א✅ב', cursor: 2 });
  assert.deepEqual(insertAt('', '🙏', 0), { text: '🙏', cursor: 2 });
  assert.deepEqual(insertAt('אב', '✅', 99), { text: 'אב✅', cursor: 3 });
});
